.DEFAULT_GOAL := help

NPM ?= npm
NODE ?= node
DOCKER_COMPOSE ?= docker compose

.PHONY: help doctor install bootstrap model install-playwright \
	dev-web dev-desktop dev-desktop-native build-web build-desktop preview \
	lint typecheck test test-unit test-coverage test-regression test-ui test-desktop test-ci check \
	docker-build docker-up docker-down clean clean-desktop-temp

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
	@echo Development:
	@echo   make dev-web               Start the Next.js development server
	@echo   make dev-desktop           Start the desktop app with the trusted-path launcher
	@echo   make dev-desktop-native    Start Tauri directly without the trusted-path workaround
	@echo.
	@echo Build:
	@echo   make build-web             Build the static web export
	@echo   make build-desktop         Build the desktop application with Tauri
	@echo   make preview               Serve the built web export from ./out
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
	@echo Docker:
	@echo   make docker-build          Build the web Docker image
	@echo   make docker-up             Run the web container with docker compose
	@echo   make docker-down           Stop the docker compose services
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
	npx playwright install chromium

dev-web:
	$(NPM) run dev

dev-desktop:
	$(NPM) run desktop:dev

dev-desktop-native:
	$(NPM) run desktop:tauri

build-web:
	$(NPM) run build

build-desktop:
	$(NPM) run desktop:build

preview:
	$(NPM) start

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

docker-build:
	$(DOCKER_COMPOSE) build

docker-up:
	$(DOCKER_COMPOSE) up --build

docker-down:
	$(DOCKER_COMPOSE) down

clean:
	$(NODE) -e "const fs=require('fs'); ['.next','out','coverage','playwright-report','test-results'].forEach((p)=>fs.rmSync(p,{recursive:true,force:true}));"

clean-desktop-temp:
	$(NODE) -e "const fs=require('fs'); const os=require('os'); const path=require('path'); fs.rmSync(path.join(os.tmpdir(),'smart-file-explorer-tauri-dev'),{recursive:true,force:true});"
