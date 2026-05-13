# Implementation Plan: Maintenance Persona & Control

**Plan ID**: `PLAN-MAINTENANCE-001`
**Spec**: `spec_maintenance.md`

## 1. Backend Changes

### 1.1 RBAC Roles
- **File**: `backend/users.py` / `backend/auth.py`
- **Action**: Ensure `role` validation supports `insumos` and `manutencao`.

### 1.2 Maintenance Logic Enhancements
- **File**: `backend/core/services/maintenance.py`
- **Action**: 
    - Implement `get_backups_aging()`: Calculate days between `DataEntrada` and `now()`.
    - Enhance `get_divergences()`: Return list of active discrepancies for the notification bell.
    - Implement `get_teams_script_os()`: Fix script template to match prompt exactly (including the "Equipamento Entrando/Saindo" section).

## 2. Frontend Changes

### 2.1 Role-Based Navigation
- **File**: `frontend/src/components/Layout.jsx`
- **Action**: Filter `navItems` array based on `user.role`.
    - `insumos`: [Pendências, Novo Protocolo, Entregas, Estoque, Rotas]
    - `manutencao`: [Manutenção, Equipamentos, Solicitantes, BI]
    - `admin`/`superadmin`: [All]

### 2.2 Global Divergence Notification
- **File**: `frontend/src/components/Layout.jsx` / `header` section.
- **Action**: Add a `NotificationBell` specifically for Map Divergences.
- **Logic**: Fetch `/maintenance/divergences` count and display as badge.

### 2.3 Maintenance Dashboard Updates
- **File**: `frontend/src/components/Maintenance/MaintenanceDashboard.jsx`
- **Action**: Add a "Backups em Alerta" widget (SLA > 10 days).

### 2.4 Conflict Resolution Modal
- **File**: `frontend/src/components/Mapa/ConflictResolutionModal.jsx`
- **Action**: Audit and refine the UI to ensure it clearly shows the "Técnico" vs "Oficial" comparison.

## 3. Verification Plan

### 3.1 Unit Testing
- Test `MaintenanceService.get_backups_aging()`.
- Test role filtering logic.

### 3.2 Manual Audit
- Login as `insumos` -> Verify "Manutenção" menu is hidden.
- Login as `manutencao` -> Verify "Estoque" menu is hidden.
- Upload Mapa with known technical edit -> Verify Conflict Modal appears.
