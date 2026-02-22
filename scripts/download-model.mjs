/**
 * Model Download Script
 *
 * Downloads the Xenova/all-MiniLM-L6-v2 ONNX model files from Hugging Face
 * into public/models/ so the app can run fully OFFLINE (no CDN required).
 *
 * This script runs automatically before every build via the "prebuild" npm hook.
 * Vercel runs "npm run build", which triggers "prebuild" first.
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
const BASE_URL = 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main';

// All files needed by @xenova/transformers for this model
const FILES = [
    'config.json',
    'tokenizer.json',
    'tokenizer_config.json',
    'special_tokens_map.json',
    'onnx/model_quantized.onnx',
];

async function download(url, dest) {
    // Skip if file already exists and is non-empty (avoids re-downloading on every build)
    const MIN_VALID_SIZE = 100;
    if (fs.existsSync(dest) && fs.statSync(dest).size > MIN_VALID_SIZE) {
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

async function main() {
    console.log('🤖 Downloading AI model assets for offline use...');
    console.log(`   Model: Xenova/all-MiniLM-L6-v2`);
    console.log(`   Destination: public/models/\n`);

    // Ensure directories exist
    fs.mkdirSync(path.join(MODEL_DIR, 'onnx'), { recursive: true });

    for (const file of FILES) {
        const url = `${BASE_URL}/${file}`;
        const dest = path.join(MODEL_DIR, file);

        process.stdout.write(`  ↓ ${file}... `);
        try {
            await download(url, dest);
        } catch (err) {
            process.stdout.write(`\n`);
            console.error(`  ✗ ERROR: ${err.message}`);
            process.exit(1);
        }
    }

    console.log(`\n✅ AI model assets ready!`);
}

main();
