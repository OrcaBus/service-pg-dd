.PHONY: *

COMMAND ?= "load --exists-ok"

install:
	@poetry update

lint: install
	@poetry run ruff format .

check: lint
	@poetry run ruff check .

fix: lint
	@poetry run ruff check --fix

cli: install
	@poetry run cli $(COMMAND)

clean:
	rm -rf data && rm -rf .ruff_cache
