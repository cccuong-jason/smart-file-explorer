# Desktop Release and CI Pipeline

Smart File Explorer ships as a Tauri desktop app. Every pull request and pushed feature branch is expected to pass automated testing, desktop packaging, and security scanning before it is considered ready to merge.

## GitHub Actions

The main workflow lives at `.github/workflows/test-pipeline.yml` and runs on pull requests to `main`, pushes to `main`, feature/fix branches, and manual dispatch.

The workflow contains these gates:

- `quality`
  Runs `npm run lint`, `npm run typecheck`, `npm run test:coverage`, and `npm run test:regression` on Ubuntu.
- `ui-smoke`
  Installs Chromium with Playwright and runs `npm run test:ui`.
- `desktop-smoke`
  Runs `npm run test:desktop` on both `windows-latest` and `macos-latest`.
- `security`
  Runs `npm audit --audit-level=high`, `cargo audit --file src-tauri/Cargo.lock`, and CodeQL analysis.
- `desktop-package`
  Waits for the other gates, then runs `npm run desktop:bundle` on both Windows and macOS. The generated installers are uploaded as workflow artifacts named `smart-file-explorer-windows` and `smart-file-explorer-macos`.

## Local Verification

Before opening or updating a pull request, run the closest local equivalent:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:coverage
npm run test:regression
npm run test:ui
npm run test:desktop
npm run security:npm
```

For Rust dependency scanning, install `cargo-audit` once and run:

```bash
cargo install cargo-audit --locked
npm run security:rust
```

## Desktop Packaging

The production packaging command is:

```bash
npm run desktop:bundle
```

The script builds inside a trusted temporary Tauri workspace and copies generated bundle output into `artifacts/desktop/<platform>`. CI sets `SMART_FILE_EXPLORER_BUNDLE_ARTIFACT_DIR` so uploaded artifacts come from a stable path.

Windows artifacts are produced on `windows-latest`; macOS artifacts are produced on `macos-latest`. Cross-compiling desktop installers is not used because Tauri packaging depends on native platform tooling.
