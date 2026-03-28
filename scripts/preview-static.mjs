import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || '3000');

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function resolveFilePath(urlPath) {
  const normalizedPath = decodeURIComponent(urlPath.split('?')[0]);
  const requestedPath = normalizedPath === '/' ? '/index.html' : normalizedPath;
  const withHtmlFallback = requestedPath.endsWith('/') ? `${requestedPath}index.html` : requestedPath;
  const candidatePaths = [
    path.join(OUT_DIR, withHtmlFallback),
    path.join(OUT_DIR, `${requestedPath}.html`),
    path.join(OUT_DIR, requestedPath, 'index.html'),
    path.join(OUT_DIR, 'index.html'),
  ];

  return candidatePaths.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
}

if (!fs.existsSync(OUT_DIR)) {
  console.error(`Missing build output at ${OUT_DIR}. Run "make build-web" first.`);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const filePath = resolveFilePath(req.url || '/');

  if (!filePath) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Serving ${OUT_DIR} at http://127.0.0.1:${PORT}`);
});
