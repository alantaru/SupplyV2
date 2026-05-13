# Project Constitution — Supply_2026

## Development Principles
1. **SDD First**: No code change without an approved `spec.md` and `plan.md`.
2. **Caveman Communication**: Concise, technical signal. No verbosity.
3. **Memory-Oriented (MOM)**: Maintain state in `.mom/` to prevent context drift.
4. **Test-Driven Hardening**: 100% backend coverage is non-negotiable. 0% linting errors.
5. **Clean Architecture**: Modular backend (FastAPI) and frontend (React).

## Quality Gates
- **Phase 1 (PM)**: `spec.md` approved.
- **Phase 2 (Engineer)**: `plan.md` approved.
- **Phase 3 (Delivery)**: `tasks.md` tracked, tests passing, coverage met.

## Operational Constraints
- Deploy frontend after every change.
- Commit to `main` after every task.
- Use `specify-cli` for governance.
