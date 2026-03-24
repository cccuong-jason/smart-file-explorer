# Smart File Explorer

Smart File Explorer is a local-first file exploration experience built with Next.js and Tauri. It combines browser-based search and preview workflows with native desktop capabilities such as filesystem watching, global shortcuts, native file opening, and tray integration.

The repository supports two main surfaces:

- A static web application built with Next.js.
- A Tauri desktop application that wraps the web UI with native Rust-backed integrations.

## Features

- Local-first file scanning and indexing.
- Keyword search and semantic search powered by Transformers.js.
- Desktop integrations for file watching, tray actions, and native file open.
- File metadata inspection and preview-oriented workflows.
- Privacy-focused design: data stays on the local machine.
- Automated unit, UI, regression, and desktop test coverage.

## Tech Stack

- Frontend: Next.js 16, React 19, TypeScript, Tailwind CSS.
- Desktop shell: Tauri 2 with Rust.
- Search and storage: Fuse.js, IndexedDB, Transformers.js.
- Testing: Vitest, Playwright, Node test runner, Cargo test.
- Packaging and deployment: static web export, Docker, Tauri bundling.

## Repository Layout

```text
.
|-- src/                    Next.js application source
|-- src-tauri/              Tauri application, Rust commands, desktop config
|-- public/                 Static assets and downloaded model files
|-- scripts/                Local automation helpers for model download and desktop launch
|-- tests/                  Unit, UI, regression, and test setup files
|-- .github/workflows/      CI workflows
|-- Dockerfile              Web image definition
|-- docker-compose.yml      Local web container orchestration
|-- Makefile                Cross-platform development shortcuts
`-- README.md               Project documentation
```

## Requirements

### Common

- Node.js 22 or later
- npm 11 or later
- Rust stable toolchain with `cargo`

### Desktop prerequisites by OS

- Windows
  WebView2 and Microsoft C++ build tools are required for Tauri desktop development. The official Tauri prerequisites page covers the Windows setup.
- macOS
  Xcode Command Line Tools are required for desktop builds.
- Linux
  Desktop builds require WebKitGTK and related native packages. Package names vary by distribution.

Official reference:

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri webview runtimes: https://v2.tauri.app/reference/webview-versions/

## Quick Start

### With Make

```bash
make bootstrap
make dev-web
```

For the desktop app:

```bash
make dev-desktop
```

### Without Make

```bash
npm ci
npm run download-model
npm run dev
```

For the desktop app:

```bash
npm run desktop:dev
```

## Local Development

### Web application

Start the Next.js development server:

```bash
make dev-web
```

The app will be available at `http://localhost:3000`.

### Desktop application

Start the cross-platform desktop launcher:

```bash
make dev-desktop
```

This launcher is the recommended default because it handles the Windows untrusted mount-point issue by copying `src-tauri` into a trusted temporary workspace before starting the Rust side.

If your machine does not need that workaround and you want the direct Tauri CLI flow, use:

```bash
make dev-desktop-native
```

### Build locally

Build the web export:

```bash
make build-web
```

Build the desktop application bundle:

```bash
make build-desktop
```

Preview the exported web app:

```bash
make preview
```

## Testing and Quality

Install the Playwright browser once before running UI tests locally:

```bash
make install-playwright
```

Available quality and test commands:

```bash
make lint
make typecheck
make test-unit
make test-coverage
make test-regression
make test-ui
make test-desktop
make test-ci
make check
```

## Docker

The repository includes a Docker setup for the web build only. It does not package the Tauri desktop shell.

Build and run the web container:

```bash
make docker-up
```

Stop containers:

```bash
make docker-down
```

## CI

The GitHub Actions pipeline in `.github/workflows/test-pipeline.yml` currently runs:

- TypeScript type-checking
- Vitest coverage tests
- Regression tests
- Playwright UI smoke tests
- Windows desktop Rust tests

## Troubleshooting

### Windows desktop launch and untrusted mount points

If `tauri dev` or `cargo metadata` fails with an untrusted mount-point error, use:

```bash
make dev-desktop
```

That path uses `scripts/desktop-dev.mjs` and avoids the direct Tauri workspace lookup that can fail on redirected, mounted, or junctioned paths.

### Local model files

Model files are downloaded into `public/models` by `scripts/download-model.mjs`. They are ignored by Git and can be refreshed with:

```bash
make model
```

### Make on Windows

The `Makefile` is cross-platform in command content, but Windows does not ship `make` by default. On Windows, use one of these:

- Git Bash with `make`
- WSL
- MSYS2 or `mingw32-make`
- The underlying `npm run ...` commands directly

## Additional Project Documents

- `PRD.md`
- `NEXTJS_TECHNICAL_FEASIBILITY.md`
- `WEB_MIGRATION_FEASIBILITY_ANALYSIS.md`

## License

This repository does not currently include a license file.
