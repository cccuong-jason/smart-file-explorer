/**
 * Model Download Script
 *
 * Downloads the Xenova/all-MiniLM-L6-v2 ONNX model files from Hugging Face
 * into public/models/ so the app can run fully OFFLINE (no CDN required).
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
const MODELS = [
    {
        id: 'Xenova/all-MiniLM-L6-v2',
        requiredFiles: [
            'config.json',
            'tokenizer.json',
            'tokenizer_config.json',
            'special_tokens_map.json',
            'onnx/model_quantized.onnx',
        ],
        optionalFiles: [
            'added_tokens.json',
            'preprocessor_config.json',
        ],
    },
    {
        id: 'Xenova/clip-vit-base-patch32',
        requiredFiles: [
            'config.json',
            'merges.txt',
            'preprocessor_config.json',
            'special_tokens_map.json',
            'tokenizer.json',
            'tokenizer_config.json',
            'vocab.json',
            'onnx/text_model_quantized.onnx',
            'onnx/vision_model_quantized.onnx',
        ],
        optionalFiles: [
            'added_tokens.json',
        ],
    },
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

async function main() {
    console.log('Downloading AI model assets for offline use...');
    console.log(`   Destination: public/models/\n`);

    for (const model of MODELS) {
        const modelDir = path.join(ROOT, 'public', 'models', ...model.id.split('/'));
        const baseUrl = `https://huggingface.co/${model.id}/resolve/main`;

        console.log(`   Model: ${model.id}`);
        fs.mkdirSync(path.join(modelDir, 'onnx'), { recursive: true });

        for (const file of model.requiredFiles) {
            const url = `${baseUrl}/${file}`;
            const dest = path.join(modelDir, file);

            process.stdout.write(`  - ${file}... `);
            try {
                await download(url, dest);
            } catch (err) {
                process.stdout.write(`\n`);
                console.error(`  ERROR: ${err.message}`);
                process.exit(1);
            }
        }

        for (const file of model.optionalFiles) {
            const url = `${baseUrl}/${file}`;
            const dest = path.join(modelDir, file);
            process.stdout.write(`  - ${file} (optional)... `);
            try {
                await download(url, dest, 1);
            } catch (err) {
                if (String(err.message).includes('404')) {
                    const stub = file === 'added_tokens.json' ? { added_tokens: [] } : {};
                    fs.writeFileSync(dest, JSON.stringify(stub));
                    process.stdout.write(`stubbed\n`);
                } else {
                    process.stdout.write(`\n`);
                    console.error(`  Skipped optional file due to error: ${err.message}`);
                }
            }
        }

        console.log('');
    }

    console.log('AI model assets ready.');
}

main();
