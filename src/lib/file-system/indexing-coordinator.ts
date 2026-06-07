import type { FileMetadata } from './db';
import {
  processFile,
  stageFileForIndexing,
  type TauriFileMetadata,
} from './scanner';
import {
  createEmptyScanSessionProgress,
  type ScanSessionProgress,
  type ScanSessionScope,
} from './scan-session';
import { logEvent } from '@/lib/telemetry/logger';

export type IndexingCoordinatorEvent =
  | {
      type: 'scan-progress';
      progress: ScanSessionProgress;
    }
  | {
      type: 'file-updated';
      file: FileMetadata;
    }
  | {
      type: 'scan-complete';
      progress: ScanSessionProgress;
    };

type Subscriber = (event: IndexingCoordinatorEvent) => void;

type ProcessIndexedFileHandlers = {
  onFileUpdated: (file: FileMetadata) => void;
};

type IndexingCoordinatorDependencies = {
  stageMetadata: (file: TauriFileMetadata) => Promise<FileMetadata>;
  processIndexedFile: (
    file: TauriFileMetadata,
    handlers: ProcessIndexedFileHandlers
  ) => Promise<void>;
  concurrency?: number;
};

type QueueItem = {
  file: TauriFileMetadata;
  sessionId: string;
};

type QueueOptions = {
  sessionId?: string;
  scope?: ScanSessionScope;
  watchPath?: string;
};

type SessionState = ScanSessionProgress & {
  discoveryComplete: boolean;
  pendingPaths: Set<string>;
  activePaths: Set<string>;
  failedPaths: Set<string>;
  completionEmitted: boolean;
};

function waitForTurn() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

function cloneProgress(session: SessionState): ScanSessionProgress {
  return {
    sessionId: session.sessionId,
    scope: session.scope,
    phase: session.phase,
    discoveredCount: session.discoveredCount,
    queuedCount: session.queuedCount,
    processedCount: session.processedCount,
    failedCount: session.failedCount,
    totalKnownCount: session.totalKnownCount,
    currentPath: session.currentPath,
    isPaused: session.isPaused,
    watchPath: session.watchPath,
  };
}

export class IndexingCoordinator {
  private readonly subscribers = new Set<Subscriber>();
  private readonly queue: QueueItem[] = [];
  private readonly sessions = new Map<string, SessionState>();
  private readonly stageMetadata: IndexingCoordinatorDependencies['stageMetadata'];
  private readonly processIndexedFile: IndexingCoordinatorDependencies['processIndexedFile'];
  private readonly concurrency: number;
  private activeCount = 0;
  private fallbackSessionCounter = 0;
  private latestForegroundSessionId?: string;

  constructor({
    stageMetadata,
    processIndexedFile,
    concurrency = 1,
  }: IndexingCoordinatorDependencies) {
    this.stageMetadata = stageMetadata;
    this.processIndexedFile = processIndexedFile;
    this.concurrency = Math.max(1, concurrency);
  }

  subscribe(handler: Subscriber) {
    this.subscribers.add(handler);
    return () => {
      this.subscribers.delete(handler);
    };
  }

  pause(sessionId = this.latestForegroundSessionId) {
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session || session.isPaused) {
      return;
    }

    session.isPaused = true;
    this.emitProgress(session);
  }

  resume(sessionId = this.latestForegroundSessionId) {
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session || !session.isPaused) {
      return;
    }

    session.isPaused = false;
    this.emitProgress(session);
    this.pump();
  }

  getSnapshot(sessionId: string) {
    const session = this.sessions.get(sessionId);
    return session ? cloneProgress(session) : null;
  }

  startSession(sessionId: string, options: Omit<QueueOptions, 'sessionId'> = {}) {
    const scope = options.scope ?? 'foreground';
    const session: SessionState = {
      ...createEmptyScanSessionProgress(sessionId, scope),
      watchPath: options.watchPath,
      pendingPaths: new Set<string>(),
      activePaths: new Set<string>(),
      failedPaths: new Set<string>(),
      discoveryComplete: false,
      completionEmitted: false,
    };

    if (scope === 'foreground') {
      this.latestForegroundSessionId = sessionId;
      this.queue.length = 0;
      this.activeCount = 0;
      for (const existing of this.sessions.values()) {
        if (existing.scope === 'foreground') {
          existing.pendingPaths.clear();
          existing.activePaths.clear();
          existing.queuedCount = 0;
          existing.phase = 'finalizing';
          existing.completionEmitted = true;
        }
      }
    }

    this.sessions.set(sessionId, session);
    void logEvent({
      level: 'info',
      area: 'indexing',
      event: 'session.started',
      message: `Started ${scope} indexing session`,
      sessionId,
      data: { scope, watchPath: options.watchPath },
    });
    this.emitProgress(session);
    return cloneProgress(session);
  }

  async appendDiscoveredFiles(
    sessionId: string,
    files: TauriFileMetadata[],
    options: Omit<QueueOptions, 'sessionId'> = {}
  ) {
    if (files.length === 0) {
      return;
    }

    let session = this.sessions.get(sessionId);
    if (!session) {
      this.startSession(sessionId, options);
      session = this.sessions.get(sessionId)!;
    }

    if (options.watchPath !== undefined) {
      session.watchPath = options.watchPath;
    }

    for (const file of files) {
      if (session.pendingPaths.has(file.path) || session.activePaths.has(file.path)) {
        continue;
      }

      const stagedFile = await this.stageMetadata(file);
      session.discoveredCount += 1;
      session.totalKnownCount += 1;
      session.pendingPaths.add(file.path);
      session.queuedCount = session.pendingPaths.size + session.activePaths.size;
      session.currentPath = file.path;
      session.phase = 'discovering';
      this.queue.push({ file, sessionId });
      this.emit({ type: 'file-updated', file: stagedFile });
      this.emitProgress(session);
      void logEvent({
        level: 'debug',
        area: 'indexing',
        event: 'file.staged',
        message: 'Staged file for indexing',
        sessionId,
        path: file.path,
        data: { scope: session.scope, queuedCount: session.queuedCount },
      });

      if (session.discoveredCount % 25 === 0) {
        await waitForTurn();
      }
    }

    this.pump();
  }

  completeDiscovery(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.discoveryComplete = true;
    session.phase = session.queuedCount > 0 ? 'indexing' : 'finalizing';
    void logEvent({
      level: 'info',
      area: 'indexing',
      event: 'discovery.completed',
      message: 'Completed file discovery for indexing session',
      sessionId,
      data: {
        discoveredCount: session.discoveredCount,
        queuedCount: session.queuedCount,
        scope: session.scope,
      },
    });
    this.emitProgress(session);
    this.maybeEmitCompletion(session);
    this.pump();
  }

  failSession(sessionId: string, currentPath: string, error?: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    session.discoveryComplete = true;
    session.phase = 'finalizing';
    session.currentPath = currentPath || error || session.currentPath;
    void logEvent({
      level: 'error',
      area: 'indexing',
      event: 'session.failed',
      message: 'Indexing session failed',
      sessionId,
      path: currentPath,
      error,
    });
    this.emitProgress(session);
    this.maybeEmitCompletion(session);
  }

  async start(files: TauriFileMetadata[], options: QueueOptions = {}) {
    const sessionId = options.sessionId ?? `scan-${++this.fallbackSessionCounter}`;
    this.startSession(sessionId, {
      scope: options.scope ?? 'foreground',
      watchPath: options.watchPath,
    });
    await this.appendDiscoveredFiles(sessionId, files, options);
    this.completeDiscovery(sessionId);
    await this.pumpUntilSessionIdle(sessionId);
  }

  async enqueue(files: TauriFileMetadata[], options: QueueOptions = {}) {
    if (files.length === 0) {
      return;
    }

    const scope = options.scope ?? 'background';
    const sessionId =
      options.sessionId
      ?? (scope === 'background'
        ? `background:${options.watchPath ?? 'global'}`
        : `scan-${++this.fallbackSessionCounter}`);

    if (!this.sessions.has(sessionId) || this.isSessionIdle(sessionId)) {
      this.startSession(sessionId, { scope, watchPath: options.watchPath });
    } else {
      const session = this.sessions.get(sessionId)!;
      session.phase = 'discovering';
      session.discoveryComplete = false;
      session.completionEmitted = false;
      if (options.watchPath !== undefined) {
        session.watchPath = options.watchPath;
      }
      this.emitProgress(session);
    }

    await this.appendDiscoveredFiles(sessionId, files, { scope, watchPath: options.watchPath });
    this.completeDiscovery(sessionId);
    await this.pumpUntilSessionIdle(sessionId);
  }

  private async pumpUntilSessionIdle(sessionId: string) {
    this.pump();

    while (!this.isSessionIdle(sessionId)) {
      await waitForTurn();
      this.pump();
    }
  }

  private isSessionIdle(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return true;
    }

    return (
      session.discoveryComplete
      && session.pendingPaths.size === 0
      && session.activePaths.size === 0
    );
  }

  private pump() {
    while (this.activeCount < this.concurrency) {
      const nextIndex = this.queue.findIndex((item) => {
        const session = this.sessions.get(item.sessionId);
        return Boolean(session && !session.isPaused);
      });

      if (nextIndex < 0) {
        return;
      }

      const next = this.queue.splice(nextIndex, 1)[0];
      const session = this.sessions.get(next.sessionId);
      if (!session) {
        continue;
      }

      session.pendingPaths.delete(next.file.path);
      session.activePaths.add(next.file.path);
      session.queuedCount = session.pendingPaths.size + session.activePaths.size;
      session.phase = session.discoveryComplete ? 'indexing' : 'discovering';
      session.currentPath = next.file.path;
      this.activeCount += 1;
      this.emitProgress(session);

      void this.processIndexedFile(next.file, {
        onFileUpdated: (file) => {
          if (file.processingStatus === 'failed' && !session.failedPaths.has(file.path)) {
            session.failedPaths.add(file.path);
            session.failedCount = session.failedPaths.size;
            void logEvent({
              level: 'error',
              area: 'indexing',
              event: 'file.failed',
              message: 'File indexing failed',
              sessionId: next.sessionId,
              path: file.path,
              data: { failedCount: session.failedCount },
            });
            this.emitProgress(session);
          }
          this.emit({ type: 'file-updated', file });
        },
      })
        .finally(() => {
          this.activeCount -= 1;
          session.activePaths.delete(next.file.path);
          session.processedCount += 1;
          session.queuedCount = session.pendingPaths.size + session.activePaths.size;
          session.phase =
            session.discoveryComplete && session.queuedCount === 0
              ? 'finalizing'
              : session.discoveryComplete
                ? 'indexing'
                : 'discovering';
          session.currentPath = next.file.path;
          this.emitProgress(session);
          this.maybeEmitCompletion(session);
          this.pump();
        });
    }
  }

  private maybeEmitCompletion(session: SessionState) {
    if (
      session.completionEmitted
      || !session.discoveryComplete
      || session.pendingPaths.size > 0
      || session.activePaths.size > 0
    ) {
      return;
    }

    session.phase = 'finalizing';
    session.completionEmitted = true;
    void logEvent({
      level: 'info',
      area: 'indexing',
      event: 'session.completed',
      message: 'Indexing session completed',
      sessionId: session.sessionId,
      data: {
        scope: session.scope,
        processedCount: session.processedCount,
        failedCount: session.failedCount,
        totalKnownCount: session.totalKnownCount,
      },
    });
    const progress = cloneProgress(session);
    this.emit({ type: 'scan-complete', progress });
  }

  private emit(event: IndexingCoordinatorEvent) {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private emitProgress(session: SessionState) {
    this.emit({
      type: 'scan-progress',
      progress: cloneProgress(session),
    });
  }
}

let indexingCoordinator: IndexingCoordinator | undefined;

export function getIndexingCoordinator() {
  if (!indexingCoordinator) {
    indexingCoordinator = new IndexingCoordinator({
      stageMetadata: stageFileForIndexing,
      processIndexedFile: async (file, handlers) => {
        await processFile(file, {
          skipInitialStage: true,
          onFileUpdated: handlers.onFileUpdated,
        });
      },
      concurrency: 2,
    });
  }

  return indexingCoordinator;
}
