# Tasks: Total Quality Engine (Supply 2026)

- [x] **Phase 1: Knowledge Formalization (MOM Wiki)**
    - [x] Establish MOM Wiki Structure
    - [x] Ingest Domain Logic: `Stock`, `Refinery`, `RefineryHardening`, `Protocol`, `BI`, `Equipment`, `Contract`, `Security`
    - [x] Ingest Infrastructure: `Storage`, `Database`, `Constants`, `ContractTruth`, `Map`
    - [x] Ingest Frontend: `StateManagement`, `FrontendHardening`, `FrontendLogic`

- [x] **Phase 2: Backend Stability & Regressions**
    - [x] Fix `adapters.py` normalization issues (serial numbers, location fallbacks)
    - [x] Refactor `ProtocolService`: Consolidate `_apply_filters` for screen/export consistency
    - [x] Resolve all test failures in `test_adapters_extended.py`
    - [x] Validate full backend test suite (100% pass)
    - [x] Achieve 99% coverage on `bi.py` (Perfect logic coverage)

- [/] **Phase 3: Frontend Environment & Linting**
    - [x] Resolve Vitest/Node incompatibility (Downgrade to 1.6.0)
    - [/] Fresh `npm install` for Playwright and Vitest (In progress)
    - [/] Clean ESLint violations (0% Errors Goal)
        - [x] `components/Analytics/` (Clean)
        - [x] `context/` (Clean)
        - [ ] `components/Shared/`
        - [ ] `components/Protocol/`
        - [ ] `hooks/`

- [ ] **Phase 4: E2E Verification (Playwright)**
    - [ ] Execute `npx playwright test` (Needs `npm install` finish)
    - [ ] Flow: Authentication & RBAC
    - [ ] Flow: CSV Upload & Refinery Mapping
    - [ ] Flow: Route Analysis & Protocol Generation

- [ ] **Phase 5: Final Audit & Visual Perfection**
    - [ ] Verify Glassmorphism across all screens
    - [ ] Check all buttons, modals, and filters
    - [ ] Final 100% coverage & 0 lint report

- [x] **Phase 6: Maintenance Persona & RBAC (Prompt Compliance)
    - [x] Implement Backend insumos/manutencao roles logic
    - [x] Refactor Layout.jsx for Role-Based Sidebar filtering
    - [x] Add Global Divergence Notification (Header)
    - [x] Implement Backup Aging (10-day SLA) logic and UI alerts
    - [x] Refine OS Teams Script to match official model exactly
