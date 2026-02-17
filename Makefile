SHELL := /bin/bash
.PHONY: dev build build-web build-worker migrate worker docker-up docker-down setup clean deploy-worker deploy-web deploy logs-worker logs-web

dev:
	npm run dev

build: build-web

build-web:
	cd web && npm run build

build-worker:
	cd worker-py && source .venv/bin/activate && pip install -e .

migrate:
	cd web && npx prisma migrate dev

worker:
	cd worker-py && source .venv/bin/activate && python -m worker.main

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

setup: docker-up
	npm install
	cd worker-py && source .venv/bin/activate && pip install -e .
	@echo "Waiting for PostgreSQL to be ready..."
	@until docker-compose exec postgres pg_isready -U quickgithub -d quickgithub > /dev/null 2>&1; do sleep 1; done
	$(MAKE) migrate
	@echo "Setup complete. Run 'make dev' to start the development server."

deploy-worker:
	cd worker-py && source .venv/bin/activate && pip install .
	sudo systemctl restart quickgithub-worker

deploy-web:
	cd web && npm run build
	pm2 restart quickgithub-web

deploy: deploy-worker deploy-web

logs-worker:
	sudo journalctl -u quickgithub-worker.service -f

logs-web:
	pm2 logs quickgithub-web

clean:
	docker-compose down -v
	rm -rf node_modules .next
