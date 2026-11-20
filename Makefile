PYTHON_VERSION ?= 3.13
PYTHON ?= .venv/bin/python
RUFF ?= .venv/bin/ruff
DJLINT ?= .venv/bin/djlint
NPM ?= npm

.PHONY: install test test-browser check-distribution build fix-codestyle demo

install:
	uv venv --python $(PYTHON_VERSION)
	uv pip install --python $(PYTHON) -e ".[test]"
	$(NPM) ci

build:
	$(NPM) run build

test:
	$(PYTHON) tests/test_project/manage.py check
	$(PYTHON) tests/test_project/manage.py makemigrations --check --dry-run
	$(RUFF) check src tests
	$(RUFF) format src tests --check
	$(RUFF) check scripts/*.py
	$(RUFF) format scripts/*.py --check
	$(DJLINT) src/wagtail_table/templates tests/test_project --lint --check
	$(PYTHON) -X dev -m pytest $(ARGS)
	$(NPM) run typecheck
	$(NPM) test
	$(NPM) run check:assets

test-browser:
	$(NPM) run test:browser

check-distribution:
	$(PYTHON) scripts/check_distribution.py

fix-codestyle:
	$(RUFF) check --fix src tests
	$(RUFF) format src tests
	$(DJLINT) src/wagtail_table/templates tests/test_project --reformat

demo:
	$(PYTHON) tests/test_project/manage.py migrate
	$(PYTHON) tests/test_project/manage.py create_content
	$(PYTHON) tests/test_project/manage.py create_examples
	$(PYTHON) tests/test_project/manage.py runserver
