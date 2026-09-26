.PHONY: up down build logs restart backend frontend seed clean

## Start everything (build if needed)
up:
	docker compose up -d --build

## Start without rebuilding
start:
	docker compose up -d

## Stop everything
down:
	docker compose down

## Stop and remove volumes
clean:
	docker compose down -v --remove-orphans

## Rebuild images
build:
	docker compose build --no-cache

## Follow all logs
logs:
	docker compose logs -f

## Backend logs only
logs-backend:
	docker compose logs -f backend

## Frontend logs only
logs-frontend:
	docker compose logs -f frontend

## Restart a specific service
restart:
	docker compose restart $(service)

## Seed Supabase via backend container
seed:
	docker compose exec backend python -m app.seed

## Create Supabase tables (non-interactive, needs DB_PASSWORD in .env)
setup-db:
	docker compose exec backend python setup_db.py

## Create tables AND seed in one shot (DB_PASSWORD must be in backend/.env)
db-and-seed:
	docker compose exec backend python setup_db.py && docker compose exec backend python -m app.seed

## Create Supabase tables (interactive, prompts for password)
tables:
	docker compose exec -it backend python create_tables.py

## Open a shell in backend container
shell-backend:
	docker compose exec backend bash

## Open a shell in frontend container
shell-frontend:
	docker compose exec frontend sh

## Show running containers status
ps:
	docker compose ps
