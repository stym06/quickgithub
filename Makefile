.PHONY: dev build migrate worker docker-up docker-down setup clean

dev:
	npm run dev

build:
	npm run build

migrate:
	npx drizzle-kit push

worker:
	cd worker && go run ./cmd/worker

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

setup: docker-up
	npm install
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker-compose exec postgres pg_isready -U quickgithub -d quickgithub > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	@echo "Setup complete. Run 'make dev' to start the development server."

clean:
	docker-compose down -v
	rm -rf node_modules .next
