# Project Agent Instructions

## Project Overview
Supply_2026 — Sistema de gerenciamento de supply chain/rota. Backend Python/FastAPI, frontend modular.

## Tech Stack
- **Backend**: Python 3.11+, FastAPI, PostgreSQL, SQLAlchemy
- **Frontend**: TypeScript/React (ou estrutura similar — verificar)
- **Testing**: pytest, e2e tests
- **Infra**: Docker, AWS (EC2, S3), nginx

## Coding Standards
- **Python**: Black formatter, isort imports, Ruff linter, mypy type checking
- **TypeScript/JS**: Prettier, ESLint
- **Conventions**: snake_case para Python, camelCase para JS/TS; PascalCase para classes
- **Imports**: Ordem: stdlib → third-party → local; agrupados com linha vazia

## Architecture Notes
- `backend/` — API FastAPI, models SQLAlchemy, services
- `frontend/` — aplicação web
- `contracts/` — schemas/contratos de dados
- `tests/` — pytest + e2e
- `docs/` — documentação

## Common Commands
```bash
# Backend
cd backend
uvicorn main:app --reload          # dev server
pytest                             # unit tests
pytest tests/e2e/                  # e2e tests
ruff check .                       # lint
black .                            # format
mypy backend/                      # typecheck

# Frontend (se aplicável)
cd frontend
npm run dev                        # dev server
npm run build                      # production build
npm test                           # unit tests
```

## Environment
- Use `.env` para secrets (não commitar!)
- `.env.example` disponível para referência
- Variáveis principais: `DATABASE_URL`, `AWS_*`, `SUPPLY_*`

## Git Workflow
- Branch: `feature/<desc>` ou `bugfix/<desc>`
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`)
- PRs: Descrição clara, linked issues, screenshots para UI

## Key Decisions
- Arquitetura limpa (clean architecture) com camadas claras
- Type safety como prioridade
- Observabilidade: logs estruturados, métricas
- Idempotência em operações críticas

## Agent Behavior
- Sempre verifique arquivos existentes antes de criar novos
- Siga padrões do código existente
- Execute testes antes de fazer PR
- Documente mudanças públicas
- Use `deepseek-v4-flash` para tarefas gerais, `deepseek-v4-pro` + `reasoning_effort: high` para lógica complexa
