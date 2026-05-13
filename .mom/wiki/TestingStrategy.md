# Testing Strategy

O Supply 2026 segue a pirâmide de testes para garantir 100% de confiabilidade.

## 1. Unit Tests (Backend)
- **Local**: `backend/tests/`
- **Ferramenta**: `pytest`
- **Foco**: Lógica pura nos Services (`StockService`, `ProtocolService`, `RefineryValidator`).
- **Target**: 100% de cobertura nos arquivos core.

## 2. Integration Tests (Backend)
- **Foco**: Roteamento FastAPI, persistência em CSV e Database Locks.
- **Ferramenta**: `pytest` com `TestClient`.

## 3. Unit Tests (Frontend)
- **Local**: `frontend/src/tests/` (a ser expandido)
- **Ferramenta**: `vitest` + `React Testing Library`.
- **Foco**: Renderização de componentes, hooks e lógica de filtros.

## 4. E2E Tests (System)
- **Ferramenta**: `Playwright`.
- **Foco**: Fluxos críticos:
  - Login e troca de contrato.
  - Upload de MAPA e validação de erros.
  - Geração de protocolos e SmartStock.
  - Impressão de rotas.

## Pipeline CI/CD
- **Linting**: Ruff (Backend), ESLint (Frontend).
- **Security**: Verificação de tokens JWT e RBAC.
- **Validation**: 0% de warnings/errors permitidos.

## Referências
- Backend Tests: `backend/tests/`
- Frontend Config: `frontend/vitest.config.js` (a ser criado).
