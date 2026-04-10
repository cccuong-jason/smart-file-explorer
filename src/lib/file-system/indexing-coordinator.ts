import type { FileMetadata } from './db';
import {
  processFile,
  stageFileForIndexing,
  type TauriFileMetadata,
} from './scanner';

export type IndexingCoordinatorEvent =
  | {
      type: 'scan-progress';
      total: number;
      discovered: number;
      completed: number;
      currentFile?: string;
      isPaused: boolean;
    }
  | {
      type: 'file-updated';
      file: FileMetadata;
    }
  | {
      type: 'scan-complete';
      total: number;
      completed: number;
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

function waitForTurn() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

export class IndexingCoordinator {
  private readonly subscribers = new Set<Subscriber>();
  private readonly queue: TauriFileMetadata[] = [];
  private readonly stageMetadata: IndexingCoordinatorDependencies['stageMetadata'];
  private readonly processIndexedFile: IndexingCoordinatorDependencies['processIndexedFile'];
  private readonly concurrency: number;
  private activeCount = 0;
  private paused = false;
  private total = 0;
  private discovered = 0;
  private completed = 0;

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

  pause() {
    this.paused = true;
    this.emitProgress();
  }

  resume() {
    if (!this.paused) {
      return;
    }

    this.paused = false;
    this.emitProgress();
    this.pump();
  }

  async start(files: TauriFileMetadata[]) {
    this.queue.length = 0;
    this.activeCount = 0;
    this.total = files.length;
    this.discovered = 0;
    this.completed = 0;
    this.paused = false;
    this.emitProgress();

    for (const file of files) {
      const stagedFile = await this.stageMetadata(file);
      this.discovered += 1;
      this.queue.push(file);
      this.emit({ type: 'file-updated', file: stagedFile });
      this.emitProgress(stagedFile.name);

      if (this.discovered % 25 === 0) {
        await waitForTurn();
      }
    }

    await this.pumpUntilIdle();
    this.emit({
      type: 'scan-complete',
      total: this.total,
      completed: this.completed,
    });
  }

  private async pumpUntilIdle() {
    this.pump();

    while (this.queue.length > 0 || this.activeCount > 0) {
      await waitForTurn();
      this.pump();
    }
  }

  private pump() {
    if (this.paused) {
      return;
    }

    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        return;
      }

      this.activeCount += 1;
      this.emitProgress(next.name);

      void this.processIndexedFile(next, {
        onFileUpdated: (file) => {
          this.emit({ type: 'file-updated', file });
        },
      })
        .finally(() => {
          this.activeCount -= 1;
          this.completed += 1;
          this.emitProgress(next.name);
          this.pump();
        });
    }
  }

  private emit(event: IndexingCoordinatorEvent) {
    for (const subscriber of this.subscribers) {
      subscriber(event);
    }
  }

  private emitProgress(currentFile?: string) {
    this.emit({
      type: 'scan-progress',
      total: this.total,
      discovered: this.discovered,
      completed: this.completed,
      currentFile,
      isPaused: this.paused,
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
