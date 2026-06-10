import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('vector engine runtime assets', () => {
  afterEach(() => {
    vi.doUnmock('@xenova/transformers');
    vi.resetModules();
  });

  it('points Transformers ONNX wasm loading at local public runtime assets', async () => {
    const mockedEnv = {
      allowLocalModels: false,
      allowRemoteModels: true,
      localModelPath: '',
      backends: {
        onnx: {
          wasm: {} as { wasmPaths?: string },
        },
      },
    };

    vi.doMock('@xenova/transformers', () => ({
      env: mockedEnv,
      pipeline: vi.fn(),
    }));

    await import('@/lib/search/vector-engine');

    expect(mockedEnv.backends.onnx.wasm.wasmPaths).toBe('/ort/');
  });

  it('stages the ONNX runtime module and wasm files during model download', () => {
    const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/download-model.mjs'), 'utf8');

    expect(script).toContain("node_modules', 'onnxruntime-web', 'dist'");
    expect(script).toContain("public', 'ort'");
    expect(script).toContain('ort-wasm-simd-threaded.jsep.mjs');
    expect(script).toContain('ort-wasm-simd-threaded.jsep.wasm');
  });

  it('retries transient model asset download failures before failing the build', () => {
    const script = fs.readFileSync(path.resolve(process.cwd(), 'scripts/download-model.mjs'), 'utf8');

    expect(script).toContain('MAX_DOWNLOAD_ATTEMPTS');
    expect(script).toContain('isRetryableDownloadError');
    expect(script).toMatch(/attempt\s*<\s*MAX_DOWNLOAD_ATTEMPTS/);
  });
});
