.PHONY: test deep scan

check:
	@pnpm audit
	@pre-commit run --all-files

check-all: check
	@(cd app && make check)

fix:
	@pnpm prettier-fix
	@pnpm lint-fix

fix-all: fix
	@(cd app && make fix)

install:
	@pnpm install --frozen-lockfile

install-all: install
	@(cd app && $(MAKE) install)

test:
	@pnpm test
