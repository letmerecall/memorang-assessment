.PHONY: dev test test-agent test-frontend down

dev:
	docker compose up --build

down:
	docker compose down

test: test-agent test-frontend

test-agent:
	cd agent && uv run pytest tests/ -v

test-frontend:
	cd frontend && npm test -- --run
