import { describe, expect, it, vi } from 'vitest';

import { IndexingCoordinator, type IndexingCoordinatorEvent } from '@/lib/file-system/indexing-coordinator';

const files = [
  { path: '/docs/a.pdf', name: 'a.pdf', size: 100, type: 'application/pdf', lastModified: 1 },
  { path: '/docs/b.docx', name: 'b.docx', size: 100, type: 'application/docx', lastModified: 2 },
];

describe('indexing coordinator', () => {
  it('emits metadata-first updates before deeper processing finishes', async () => {
    const events: IndexingCoordinatorEvent[] = [];
    const stageMetadata = vi.fn(async (file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      group: 'documents' as const,
      subtype: file.name.endsWith('.pdf') ? 'pdf' as const : 'word' as const,
      processingStatus: 'processing' as const,
      indexingStage: 'metadata' as const,
    }));
    const processIndexedFile = vi.fn(async (file, handlers) => {
      handlers.onFileUpdated({
        path: file.path,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        group: 'documents',
        subtype: file.name.endsWith('.pdf') ? 'pdf' : 'word',
        processingStatus: 'processing',
        indexingStage: 'content',
      });
      handlers.onFileUpdated({
        path: file.path,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        group: 'documents',
        subtype: file.name.endsWith('.pdf') ? 'pdf' : 'word',
        processingStatus: 'completed',
        indexingStage: 'semantic',
      });
    });

    const coordinator = new IndexingCoordinator({
      stageMetadata,
      processIndexedFile,
      concurrency: 1,
    });

    const unsubscribe = coordinator.subscribe((event) => events.push(event));
    await coordinator.start(files, { sessionId: 'scan-1' });
    unsubscribe();

    const fileEvents = events.filter((event) => event.type === 'file-updated');
    expect(fileEvents.slice(0, 2)).toEqual([
      expect.objectContaining({
        type: 'file-updated',
        file: expect.objectContaining({ path: '/docs/a.pdf', indexingStage: 'metadata' }),
      }),
      expect.objectContaining({
        type: 'file-updated',
        file: expect.objectContaining({ path: '/docs/b.docx', indexingStage: 'metadata' }),
      }),
    ]);
    expect(fileEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'file-updated',
          file: expect.objectContaining({ path: '/docs/a.pdf', indexingStage: 'content' }),
        }),
        expect.objectContaining({
          type: 'file-updated',
          file: expect.objectContaining({ path: '/docs/a.pdf', indexingStage: 'semantic' }),
        }),
      ])
    );
    expect(processIndexedFile).toHaveBeenCalledTimes(2);
  });

  it('starts indexing before discovery completes and grows totals as batches arrive', async () => {
    const events: IndexingCoordinatorEvent[] = [];
    let releaseFirstTask: (() => void) | undefined;
    let notifyFirstTaskStarted: (() => void) | undefined;
    const firstTaskStarted = new Promise<void>((resolve) => {
      notifyFirstTaskStarted = resolve;
    });
    const stageMetadata = vi.fn(async (file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      group: 'documents' as const,
      subtype: 'text' as const,
      processingStatus: 'processing' as const,
      indexingStage: 'metadata' as const,
    }));
    const processIndexedFile = vi
      .fn()
      .mockImplementationOnce(async (file, handlers) =>
        new Promise<void>((resolve) => {
          notifyFirstTaskStarted?.();
          releaseFirstTask = () => {
            handlers.onFileUpdated({
              path: file.path,
              name: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified,
              group: 'documents',
              subtype: 'text',
              processingStatus: 'completed',
              indexingStage: 'semantic',
            });
            resolve();
          };
        })
      )
      .mockImplementation(async (file, handlers) => {
        handlers.onFileUpdated({
          path: file.path,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          group: 'documents',
          subtype: 'text',
          processingStatus: 'completed',
          indexingStage: 'semantic',
        });
      });

    const coordinator = new IndexingCoordinator({
      stageMetadata,
      processIndexedFile,
      concurrency: 1,
    });

    const unsubscribe = coordinator.subscribe((event) => events.push(event));
    coordinator.startSession('scan-2');
    await coordinator.appendDiscoveredFiles('scan-2', [files[0]]);
    await firstTaskStarted;
    await coordinator.appendDiscoveredFiles('scan-2', [files[1]]);
    coordinator.completeDiscovery('scan-2');
    releaseFirstTask?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    unsubscribe();

    const progressEvents = events
      .filter((event): event is Extract<IndexingCoordinatorEvent, { type: 'scan-progress' }> => event.type === 'scan-progress')
      .map((event) => event.progress);

    expect(processIndexedFile).toHaveBeenCalledTimes(2);
    expect(progressEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sessionId: 'scan-2',
          phase: 'discovering',
          discoveredCount: 1,
          totalKnownCount: 1,
          processedCount: 0,
        }),
        expect.objectContaining({
          sessionId: 'scan-2',
          phase: 'discovering',
          discoveredCount: 2,
          totalKnownCount: 2,
          processedCount: 0,
        }),
        expect.objectContaining({
          sessionId: 'scan-2',
          phase: 'indexing',
          discoveredCount: 2,
          totalKnownCount: 2,
          processedCount: 1,
        }),
      ])
    );
    expect(progressEvents.every((progress) => progress.processedCount <= progress.totalKnownCount)).toBe(true);
  });

  it('supports pausing and resuming the queue', async () => {
    let releaseFirstTask: (() => void) | undefined;
    let notifyFirstTaskStarted: (() => void) | undefined;
    const firstTaskStarted = new Promise<void>((resolve) => {
      notifyFirstTaskStarted = resolve;
    });
    const stageMetadata = vi.fn(async (file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      group: 'documents' as const,
      subtype: file.name.endsWith('.pdf') ? 'pdf' as const : 'word' as const,
      processingStatus: 'processing' as const,
      indexingStage: 'metadata' as const,
    }));
    const processIndexedFile = vi
      .fn()
      .mockImplementationOnce(
        async (_file, handlers) =>
          await new Promise<void>((resolve) => {
            notifyFirstTaskStarted?.();
            releaseFirstTask = () => {
              handlers.onFileUpdated({
                path: '/docs/a.pdf',
                name: 'a.pdf',
                size: 100,
                type: 'application/pdf',
                lastModified: 1,
                group: 'documents',
                subtype: 'pdf',
                processingStatus: 'completed',
                indexingStage: 'semantic',
              });
              resolve();
            };
          })
      )
      .mockImplementationOnce(async (file, handlers) => {
        handlers.onFileUpdated({
          path: file.path,
          name: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          group: 'documents',
          subtype: file.name.endsWith('.pdf') ? 'pdf' : 'word',
          processingStatus: 'completed',
          indexingStage: 'semantic',
        });
      });

    const coordinator = new IndexingCoordinator({
      stageMetadata,
      processIndexedFile,
      concurrency: 1,
    });

    const runPromise = coordinator.start(files, { sessionId: 'scan-3' });
    await firstTaskStarted;
    coordinator.pause('scan-3');
    releaseFirstTask?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(processIndexedFile).toHaveBeenCalledTimes(1);

    coordinator.resume('scan-3');
    await runPromise;
    expect(processIndexedFile).toHaveBeenCalledTimes(2);
  });

  it('enqueues background files without overwriting foreground session metadata', async () => {
    const events: IndexingCoordinatorEvent[] = [];
    const stageMetadata = vi.fn(async (file) => ({
      path: file.path,
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      group: 'documents' as const,
      subtype: 'text' as const,
      processingStatus: 'processing' as const,
      indexingStage: 'metadata' as const,
    }));
    const processIndexedFile = vi.fn(async (file, handlers) => {
      handlers.onFileUpdated({
        path: file.path,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        group: 'documents',
        subtype: 'text',
        processingStatus: 'completed',
        indexingStage: 'semantic',
      });
    });

    const coordinator = new IndexingCoordinator({
      stageMetadata,
      processIndexedFile,
      concurrency: 1,
    });

    const unsubscribe = coordinator.subscribe((event) => events.push(event));
    await coordinator.start([{ path: '/docs/spec.md', name: 'spec.md', size: 10, type: 'text/markdown', lastModified: 4 }], {
      sessionId: 'scan-foreground',
      scope: 'foreground',
    });
    await coordinator.enqueue(
      [{ path: '/docs/live.md', name: 'live.md', size: 50, type: 'text/markdown', lastModified: 3 }],
      { watchPath: 'C:/Users/jason/Documents/Acme' }
    );
    unsubscribe();

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'scan-progress',
          progress: expect.objectContaining({
            sessionId: 'background:C:/Users/jason/Documents/Acme',
            scope: 'background',
            watchPath: 'C:/Users/jason/Documents/Acme',
            totalKnownCount: 1,
            processedCount: 1,
          }),
        }),
        expect.objectContaining({
          type: 'scan-complete',
          progress: expect.objectContaining({
            sessionId: 'scan-foreground',
            scope: 'foreground',
          }),
        }),
      ])
    );
  });
});
