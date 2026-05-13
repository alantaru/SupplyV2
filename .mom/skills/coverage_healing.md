# Skill: Backend Coverage Healing

## Objective
Reach 100% statement coverage in the `backend/` directory while maintaining 0 linting errors.

## Protocol
1. **Identify Gaps**: Run `pytest --cov=backend --cov-report=term-missing`.
2. **Strict Exclusions**: Check `.coveragerc` to ensure only dead code/standalone scripts are omitted.
3. **PBT (Property-Based Testing)**: Use `hypothesis` for edge cases in Refinery and Stock domains.
4. **Integration Testing**: Use `TestClient` for router endpoints, specifically CRUD in `admin.py`.

## Constraints
- Never skip a test unless explicitly requested.
- Always run `ruff check` after adding tests.
