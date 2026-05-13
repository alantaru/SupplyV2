# Plan: Total Quality & Reliability Engine

Implementar a suíte definitiva de testes e governança técnica para atingir perfeição absoluta.

## User Review Required

> [!IMPORTANT]
> **Dívida Técnica**: Cobertura atual em 41%. O plano exige expansão agressiva para 100% em todas as camadas da pirâmide.
> **Linting**: 144 erros no frontend e 7 no backend serão zerados.

## Proposed Changes

### [PHASE 1] Linting & Fixes
- [MODIFY] [backend/](file:///c:/Users/uz02095/Documents/Supply_2026/backend/) (Ruff fixes)
- [MODIFY] [frontend/](file:///c:/Users/uz02095/Documents/Supply_2026/frontend/) (ESLint fixes)
- [FIX] [test_logic_upload.py](file:///c:/Users/uz02095/Documents/Supply_2026/tests/unit/test_logic_upload.py) (Fixing errors)

### [PHASE 2] Unit & Integration (100% Coverage)
- [NEW] Tests for Core Services (Stock, Protocol, BI, Solicitantes)
- [NEW] Tests for Routers (Admin, Auth, Data, Upload, Refinery)

### [PHASE 3] E2E Playwright
- [NEW] Complete user flows verification.
- [NEW] Validation of all modals, buttons, and filters.

## Verification Plan

### Automated Tests
- `pytest --cov=backend` -> Alvo: 100%.
- `ruff check backend/` -> Alvo: 0 erros.
- `npm run lint` -> Alvo: 0 erros.
- `npx playwright test` -> Alvo: 100% pass.

### Manual Verification
- Auditoria de UX/UI para conformidade com Glassmorphism.
