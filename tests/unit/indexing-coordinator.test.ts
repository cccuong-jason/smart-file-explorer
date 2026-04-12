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
    await coordinator.start(files);
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

    const runPromise = coordinator.start(files);
    await firstTaskStarted;
    coordinator.pause();
    releaseFirstTask?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(processIndexedFile).toHaveBeenCalledTimes(1);

    coordinator.resume();
    await runPromise;
    expect(processIndexedFile).toHaveBeenCalledTimes(2);
  });
});
