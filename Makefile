SHELL := sh

env_value = $(strip $(shell awk -F= '$$1 == "$(1)" { sub(/^[^=]*=/, ""); print; exit }' .env 2>/dev/null))

IMAGE_REGISTRY ?= $(call env_value,IMAGE_REGISTRY)
IMAGE_NAMESPACE ?= $(call env_value,IMAGE_NAMESPACE)
IMAGE_TAG ?= local
FRONTEND_PORT ?= 8080
LOCAL_POSTGRES_PORT ?= $(call env_value,LOCAL_POSTGRES_PORT)

ifeq ($(IMAGE_REGISTRY),)
IMAGE_REGISTRY := ghcr.io
endif
ifeq ($(IMAGE_NAMESPACE),)
IMAGE_NAMESPACE := mikeknight85
endif
ifeq ($(LOCAL_POSTGRES_PORT),)
LOCAL_POSTGRES_PORT := 5432
endif
HOST_ARCH := $(shell uname -m)

ifeq ($(HOST_ARCH),x86_64)
BUILD_ARCH := amd64
else ifeq ($(HOST_ARCH),amd64)
BUILD_ARCH := amd64
else ifeq ($(HOST_ARCH),aarch64)
BUILD_ARCH := arm64
else ifeq ($(HOST_ARCH),arm64)
BUILD_ARCH := arm64
else
BUILD_ARCH := $(HOST_ARCH)
endif

BUILD_PLATFORM ?= linux/$(BUILD_ARCH)

IMAGE_REPOSITORY := $(IMAGE_REGISTRY)/$(IMAGE_NAMESPACE)
BACKEND_IMAGE := $(IMAGE_REPOSITORY)/pricestalker-backend:$(IMAGE_TAG)
FRONTEND_IMAGE := $(IMAGE_REPOSITORY)/pricestalker-frontend:$(IMAGE_TAG)
REMOTESCRAPER_IMAGE := $(IMAGE_REPOSITORY)/pricestalker-remotescraper:$(IMAGE_TAG)
DEV_COMPOSE := LOCAL_POSTGRES_PORT=$(LOCAL_POSTGRES_PORT) docker compose -f docker-compose.yaml -f docker-compose.dev.yaml

.DEFAULT_GOAL := help

.PHONY: help check-tools check-env check-local-tools check-local-env dev-env dev dev-backend dev-frontend dev-migrate dev-db-up dev-db-down dev-db-logs build build-backend build-frontend build-remotescraper up up-remotescraper down status logs logs-backend logs-frontend verify diagrams

define build_image
	@if docker buildx version >/dev/null 2>&1; then \
		docker buildx build --platform $(BUILD_PLATFORM) --load -t $(1) -f $(2) .; \
	else \
		echo "Docker Buildx is unavailable; using the legacy builder for $(BUILD_PLATFORM)."; \
		docker build --build-arg BUILDPLATFORM=$(BUILD_PLATFORM) -t $(1) -f $(2) .; \
	fi
endef

help: ## Show available commands.
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_-]+:.*##/ {printf "  %-22s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

check-tools: ## Verify Docker and Compose v2 are available.
	@command -v docker >/dev/null || { echo "Docker is required."; exit 1; }
	@docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required."; exit 1; }
	@docker --version
	@docker compose version
	@if docker buildx version >/dev/null 2>&1; then \
		docker buildx version; \
	else \
		echo "Docker Buildx: unavailable (legacy builder fallback enabled)"; \
		echo "Recommendation: install Buildx for faster, multi-platform builds: https://docs.docker.com/build/buildx/"; \
	fi
	@echo "Build platform: $(BUILD_PLATFORM)"

check-env: ## Verify that .env exists and required secrets have been set.
	@test -f .env || { echo "Missing .env. Copy .env.example to .env and set POSTGRES_PASSWORD and JWT_SECRET."; exit 1; }
	@grep -qE '^POSTGRES_PASSWORD=.+$$' .env && ! grep -q '^POSTGRES_PASSWORD=replace-with-a-strong-password$$' .env || { echo "Set a non-placeholder POSTGRES_PASSWORD in .env."; exit 1; }
	@grep -qE '^JWT_SECRET=.+$$' .env && ! grep -q '^JWT_SECRET=replace-with-a-long-random-string$$' .env || { echo "Set a non-placeholder JWT_SECRET in .env."; exit 1; }

check-local-tools: ## Verify Node.js and pnpm needed for host-based development.
	@command -v node >/dev/null || { echo "Node.js 24 is required for local development."; exit 1; }
	@command -v pnpm >/dev/null || { echo "pnpm 11 is required for local development. Run: corepack enable"; exit 1; }
	@node --version
	@pnpm --version

check-local-env: ## Verify native development configuration in .env or the environment.
	@test -n "$$DATABASE_URL" || { test -f .env && grep -qE '^DATABASE_URL=.+$$' .env; } || { echo "Set DATABASE_URL in .env or the environment, for example: postgresql://postgres:password@localhost:5432/priceghost"; exit 1; }
	@test -n "$$JWT_SECRET" && test "$$JWT_SECRET" != "replace-with-a-long-random-string" || { test -f .env && grep -qE '^JWT_SECRET=.+$$' .env && ! grep -q '^JWT_SECRET=replace-with-a-long-random-string$$' .env; } || { echo "Set a non-placeholder JWT_SECRET in .env or the environment."; exit 1; }

dev-env: ## Add missing local-development settings to .env without replacing configured values.
	@command -v node >/dev/null || { echo "Node.js 24 is required to create the local environment file."; exit 1; }
	@LOCAL_POSTGRES_PORT=$(LOCAL_POSTGRES_PORT) node scripts/create-local-env.mjs

dev: check-local-tools dev-env check-local-env dev-db-up ## Start backend and frontend with hot reload and a Docker PostgreSQL database.
	pnpm --parallel --filter pricestalker-backend --filter pricestalker-frontend run dev

dev-backend: check-local-tools check-local-env ## Start only the backend with hot reload on port 3001.
	pnpm --filter pricestalker-backend run dev

dev-frontend: check-local-tools ## Start only the Vite frontend on port 5173.
	pnpm --filter pricestalker-frontend run dev

dev-migrate: check-local-tools check-local-env ## Apply migrations to the DATABASE_URL configured for local development.
	pnpm --filter pricestalker-backend run db:migrate:dev

dev-db-up: check-tools check-env ## Start only PostgreSQL for local development; does not build application images.
	@$(DEV_COMPOSE) up -d postgres
	@echo "PostgreSQL is available at 127.0.0.1:$(LOCAL_POSTGRES_PORT)."

dev-db-down: check-tools ## Stop the local-development PostgreSQL container and preserve its data volume.
	@$(DEV_COMPOSE) stop postgres

dev-db-logs: check-tools ## Follow logs for the local-development PostgreSQL container.
	@$(DEV_COMPOSE) logs --follow --tail=100 postgres

build: check-tools ## Build local backend and frontend images.
	@$(MAKE) --no-print-directory build-backend build-frontend

build-backend: check-tools ## Build the local backend image.
	$(call build_image,$(BACKEND_IMAGE),backend/Dockerfile)

build-frontend: check-tools ## Build the local frontend image.
	$(call build_image,$(FRONTEND_IMAGE),frontend/Dockerfile)

build-remotescraper: check-tools ## Build the optional local remote-scraper image.
	$(call build_image,$(REMOTESCRAPER_IMAGE),remotescraper/Dockerfile)

up: check-env build ## Build and start the local stack on FRONTEND_PORT (default: 8080).
	IMAGE_REGISTRY=$(IMAGE_REGISTRY) IMAGE_NAMESPACE=$(IMAGE_NAMESPACE) IMAGE_TAG=$(IMAGE_TAG) FRONTEND_PORT=$(FRONTEND_PORT) docker compose up -d

up-remotescraper: check-env build build-remotescraper ## Start the stack with the optional remote scraper.
	IMAGE_REGISTRY=$(IMAGE_REGISTRY) IMAGE_NAMESPACE=$(IMAGE_NAMESPACE) IMAGE_TAG=$(IMAGE_TAG) FRONTEND_PORT=$(FRONTEND_PORT) docker compose --profile remotescraper up -d

down: ## Stop the stack while preserving database and application volumes.
	docker compose down

status: ## Show stack service status.
	docker compose ps

logs: ## Follow logs from all stack services.
	docker compose logs --follow --tail=100

logs-backend: ## Follow backend logs.
	docker compose logs --follow --tail=100 backend

logs-frontend: ## Follow frontend logs.
	docker compose logs --follow --tail=100 frontend

verify: ## Run a clean install, all builds, and backend tests.
	PUPPETEER_SKIP_DOWNLOAD=true pnpm install --frozen-lockfile
	pnpm run build:all
	pnpm --filter pricestalker-backend exec vitest run

diagrams: ## Rebuild product lifecycle diagrams from .dot file.
	dot -Tsvg assets/product_lifecycle.dot -o assets/product_lifecycle.svg
	dot -Tpng assets/product_lifecycle.dot -o assets/product_lifecycle.png
