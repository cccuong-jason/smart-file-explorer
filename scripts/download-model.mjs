/**
 * Model Download Script
 *
 * Downloads the Xenova/all-MiniLM-L6-v2 ONNX model files from Hugging Face
 * into public/models/ and stages ONNX runtime assets into public/ort/ so the
 * app can run fully OFFLINE (no CDN required).
 *
 * This script runs automatically before every build via the "prebuild" npm hook.
 *
 * Files are skipped (not re-downloaded) if they already exist and are non-empty,
 * so subsequent deployments re-use the cache.
 *
 * Requires Node.js 18+ (uses native fetch).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MODEL_DIR = path.join(ROOT, 'public', 'models', 'Xenova', 'all-MiniLM-L6-v2');
const ORT_SOURCE_DIR = path.join(ROOT, 'node_modules', 'onnxruntime-web', 'dist');
const ORT_DEST_DIR = path.join(ROOT, 'public', 'ort');
const BASE_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main';

// Required files for @xenova/transformers
const REQUIRED_FILES = [
  'config.json',
  'tokenizer.json',
  'tokenizer_config.json',
  'special_tokens_map.json',
  'onnx/model_quantized.onnx',
];

// Optional files that some model variants may request; provide stubs if missing
const OPTIONAL_FILES = [
  'added_tokens.json',
  'preprocessor_config.json',
];

const ORT_RUNTIME_REQUIRED_FILES = [
  'ort-wasm-simd-threaded.jsep.mjs',
  'ort-wasm-simd-threaded.jsep.wasm',
];

async function download(url, dest, minValidSize = 100) {
    // Skip if file already exists and is non-empty (avoids re-downloading on every build)
    if (fs.existsSync(dest) && fs.statSync(dest).size > minValidSize) {
        process.stdout.write(`done (cached)\n`);
        return;
    }

    // fetch() natively follows all redirects (301, 302, 307, 308)
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buffer);
    const sizeKB = (buffer.byteLength / 1024).toFixed(1);
    process.stdout.write(`done (${sizeKB} KB)\n`);
}

function stageOrtRuntimeAssets() {
    console.log('\nStaging ONNX runtime assets for offline use...');
    console.log(`   Source: node_modules/onnxruntime-web/dist`);
    console.log(`   Destination: public/ort/\n`);

    if (!fs.existsSync(ORT_SOURCE_DIR)) {
        throw new Error('onnxruntime-web runtime assets were not found. Run npm install and try again.');
    }

    const runtimeFiles = fs
        .readdirSync(ORT_SOURCE_DIR)
        .filter((file) => file.startsWith('ort-wasm') && ['.mjs', '.wasm'].includes(path.extname(file)))
        .sort();

    for (const file of ORT_RUNTIME_REQUIRED_FILES) {
        if (!runtimeFiles.includes(file)) {
            throw new Error(`Missing required ONNX runtime asset: ${file}`);
        }
    }

    fs.mkdirSync(ORT_DEST_DIR, { recursive: true });

    for (const file of runtimeFiles) {
        const source = path.join(ORT_SOURCE_DIR, file);
        const dest = path.join(ORT_DEST_DIR, file);
        const sourceSize = fs.statSync(source).size;

        process.stdout.write(`  - ${file}... `);
        if (fs.existsSync(dest) && fs.statSync(dest).size === sourceSize) {
            process.stdout.write(`done (cached)\n`);
            continue;
        }

        fs.copyFileSync(source, dest);
        const sizeKB = (sourceSize / 1024).toFixed(1);
        process.stdout.write(`done (${sizeKB} KB)\n`);
    }
}

async function main() {
    console.log('Downloading AI model assets for offline use...');
    console.log(`   Model: Xenova/all-MiniLM-L6-v2`);
    console.log(`   Destination: public/models/\n`);

    // Ensure directories exist
    fs.mkdirSync(path.join(MODEL_DIR, 'onnx'), { recursive: true });

    // Download required files
    for (const file of REQUIRED_FILES) {
        const url = `${BASE_URL}/${file}`;
        const dest = path.join(MODEL_DIR, file);

        process.stdout.write(`  - ${file}... `);
        try {
            await download(url, dest);
        } catch (err) {
            process.stdout.write(`\n`);
            console.error(`  ERROR: ${err.message}`);
            process.exit(1);
        }
    }

    // Handle optional files: try to download; if 404, create minimal stub
    for (const file of OPTIONAL_FILES) {
        const url = `${BASE_URL}/${file}`;
        const dest = path.join(MODEL_DIR, file);
        process.stdout.write(`  - ${file} (optional)... `);
        try {
            await download(url, dest, 1);
        } catch (err) {
            if (String(err.message).includes('404')) {
                // Create minimal valid JSON stub to satisfy loaders
                const stub =
                  file === 'added_tokens.json'
                    ? { added_tokens: [] }
                    : {};
                fs.writeFileSync(dest, JSON.stringify(stub));
                process.stdout.write(`stubbed\n`);
            } else {
                process.stdout.write(`\n`);
                console.error(`  Skipped optional file due to error: ${err.message}`);
            }
        }
    }

    stageOrtRuntimeAssets();

    console.log('\nAI model assets ready.');
}

main();
