.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node

.PHONY: help doctor install bootstrap model install-playwright \
	dev dev-web dev-desktop build build-web build-desktop build-desktop-bundle production preview \
	lint typecheck test test-unit test-coverage test-regression test-ui test-desktop test-ci check \
	clean clean-desktop-temp

help:
	@echo Smart File Explorer Make targets
	@echo.
	@echo Setup:
	@echo   make doctor                Show local toolchain versions
	@echo   make install               Install Node dependencies with npm ci
	@echo   make bootstrap             Install dependencies and download local model assets
	@echo   make model                 Download or refresh local model assets
	@echo   make install-playwright    Install the Chromium browser used by Playwright
	@echo.
	@echo Canonical:
	@echo   make dev                   Install what is missing, detect the OS, and start desktop development
	@echo   make build                 Build the desktop frontend and desktop release binary
	@echo   make production            Build the desktop production bundle or installer
	@echo.
	@echo Advanced Development:
	@echo   make dev-web               Start the Vite frontend development server only
	@echo   make dev-desktop           Start the desktop app with the trusted-path launcher
	@echo.
	@echo Advanced Build:
	@echo   make build-web             Build the static desktop frontend assets
	@echo   make build-desktop         Build the desktop release binary in a trusted workspace
	@echo   make build-desktop-bundle  Build the desktop bundle in a trusted workspace
	@echo   make preview               Serve the built frontend assets from ./dist
	@echo.
	@echo Quality:
	@echo   make lint                  Run ESLint
	@echo   make typecheck             Run TypeScript type-checking
	@echo   make test                  Run the default test suite
	@echo   make test-unit             Run Vitest unit tests
	@echo   make test-coverage         Run Vitest with coverage thresholds
	@echo   make test-regression       Run Node-based regression checks
	@echo   make test-ui               Run Playwright UI smoke tests
	@echo   make test-desktop          Run Rust desktop tests
	@echo   make test-ci               Run the combined CI test command
	@echo   make check                 Run lint, typecheck, unit, and desktop tests
	@echo.
	@echo Cleanup:
	@echo   make clean                 Remove local build and test artifacts
	@echo   make clean-desktop-temp    Remove the trusted temp Tauri workspace

doctor:
	@$(NODE) --version
	@$(NPM) --version
	@cargo --version
	@rustc --version

install:
	$(NPM) ci

bootstrap: install model

model:
	$(NPM) run download-model

install-playwright:
	$(NODE) scripts/run-node-script.mjs node_modules/playwright/cli.js install chromium

dev:
	$(NODE) scripts/workflow.mjs dev

dev-web:
	$(NPM) run dev

dev-desktop:
	$(NPM) run desktop:dev

build:
	$(NODE) scripts/workflow.mjs build

build-web:
	$(NPM) run build

build-desktop:
	$(NPM) run desktop:build

build-desktop-bundle:
	$(NPM) run desktop:bundle

preview:
	$(NPM) start

production:
	$(NODE) scripts/workflow.mjs production

lint:
	$(NPM) run lint

typecheck:
	$(NPM) run typecheck

test:
	$(NPM) test

test-unit:
	$(NPM) run test:unit

test-coverage:
	$(NPM) run test:coverage

test-regression:
	$(NPM) run test:regression

test-ui:
	$(NPM) run test:ui

test-desktop:
	$(NPM) run test:desktop

test-ci:
	$(NPM) run test:ci

check: lint typecheck test-unit test-desktop

clean:
	$(NODE) -e "const fs=require('fs'); ['dist','coverage','playwright-report','test-results'].forEach((p)=>fs.rmSync(p,{recursive:true,force:true}));"

clean-desktop-temp:
	$(NODE) -e "const fs=require('fs'); const os=require('os'); const path=require('path'); let root; if (process.env.SMART_FILE_EXPLORER_TAURI_TMP) { root=path.resolve(process.env.SMART_FILE_EXPLORER_TAURI_TMP); } else if (process.platform==='win32') { const projectRoot=process.cwd(); const projectDrive=path.parse(projectRoot).root.toLowerCase(); const systemDrive=path.parse(process.env.SystemRoot || 'C:\\\\Windows').root.toLowerCase(); root=projectDrive && projectDrive!==systemDrive ? path.join(projectRoot,'.smart-file-explorer-workspaces') : path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'smart-file-explorer-workspaces'); } else { root=os.tmpdir(); } fs.rmSync(root,{recursive:true,force:true});"
