# Smart File Explorer

Smart File Explorer is a local-first desktop application built with Tauri, Rust, React, and Vite. It focuses on fast local search, private indexing, native desktop workflows, and a polished file-browsing experience without depending on a Node runtime in the packaged app.

The repository is maintained as a desktop-first product. The frontend-only commands are kept only as developer utilities for UI debugging and previewing.

## Highlights

- Local file scanning and indexing
- Keyword and semantic search powered by Transformers.js
- Native desktop integrations for shortcuts, drag and drop, and file opening
- Main window and Spotlight-style search window
- Theme and language switching
- Unit, UI, regression, and desktop test coverage

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS
- Desktop shell: Tauri 2, Rust
- Search and storage: Fuse.js, IndexedDB, Transformers.js
- Testing: Vitest, Playwright, Node test runner, Cargo test

## Repository Layout

```text
.
|-- src/               Desktop frontend source
|-- src-tauri/         Tauri application and Rust commands
|-- public/            Static assets and downloaded model files
|-- scripts/           Build, launch, preview, and trusted-workspace helpers
|-- tests/             Unit, UI, regression, and setup files
|-- Makefile           Cross-platform developer commands
`-- README.md          Project documentation
```

## Requirements

### Common

- Node.js 22 or later
- npm 11 or later
- Rust stable toolchain with `cargo`

### Desktop prerequisites by OS

- Windows
  Install WebView2 and Visual Studio Build Tools with the C++ workload.
- macOS
  Install Xcode Command Line Tools.
- Linux
  Install WebKitGTK and the native Tauri desktop dependencies required by your distribution.

Official reference:

- Tauri prerequisites: https://v2.tauri.app/start/prerequisites/
- Tauri webview runtimes: https://v2.tauri.app/reference/webview-versions/

## Canonical Commands

```bash
make dev
make build
make production
```

- `make dev`
  Starts desktop development. It installs missing Node dependencies, downloads local model assets if needed, detects the operating system, and launches the trusted-path Tauri developer flow.
- `make build`
  Builds the desktop frontend assets and the desktop release binary.
- `make production`
  Builds the production desktop bundle or installer.

## Advanced Commands

### Development Helpers

```bash
make dev-web
make dev-desktop
```

- `make dev-web`
  Starts the Vite frontend development server only for UI debugging. This is not a production target.
- `make dev-desktop`
  Starts the trusted desktop launcher directly.

### Build and Preview Helpers

```bash
make build-web
make build-desktop
make build-desktop-bundle
make preview
```

- `make build-web`
  Builds static frontend assets into `dist/`.
- `make build-desktop`
  Builds the desktop release binary in a trusted workspace.
- `make build-desktop-bundle`
  Builds the desktop bundle or installer in a trusted workspace.
- `make preview`
  Serves the built frontend assets from `dist/` for UI checks.

## Testing and Quality

Install the Playwright browser once before running UI tests locally:

```bash
make install-playwright
```

Available checks:

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

## Troubleshooting

### Windows untrusted mount points

Desktop launch, build, and bundle commands use trusted workspace copies on Windows so they can still work when the repository itself lives on a redirected or mounted path.

### Local model files

Model files are downloaded into `public/models` by `scripts/download-model.mjs`. Refresh them with:

```bash
make model
```

### Make on Windows

Windows does not ship `make` by default. Use Git Bash, WSL, or another environment that provides `make`, or run the underlying `npm` and `node` commands directly.
