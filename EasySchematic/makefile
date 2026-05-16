.DEFAULT_GOAL := help

.PHONY: help build build-clean up down restart logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

build: ## Build the Docker image
	docker compose build

build-clean: ## Build with no cache
	docker compose build --no-cache --pull

up: ## Start the container
	docker compose up -d

down: ## Stop the container
	docker compose down

restart: ## Restart the container
	docker compose restart

logs: ## Tail container logs
	docker compose logs -f
