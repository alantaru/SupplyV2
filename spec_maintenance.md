# Feature Specification: Maintenance Persona & Control System

**Feature ID**: `FEAT-MAINTENANCE-RBAC`
**Status**: COMPLETED
**Related Specs**: `spec.md` (Total Quality)

## 1. Context & User Story
The system currently treats all operational users equally. We need to segregate the "Insumos" (Supplies) operations from the "Manutenção" (Maintenance) operations, while sharing the same contract database (Mapa and Contadores).

**User Persona 1: Almoxarife (Insumos)**
- Handles: Deliveries, Stock, Routes.
- Constraint: **Must NOT** see maintenance-related panels.

**User Persona 2: Técnico de Manutenção**
- Handles: Equipment Swaps, OS, Parts Life Cycle, Backups, NF Management.
- Constraint: **Must NOT** see supplies-related panels.

## 2. Operational Requirements

### 2.1 Maintenance Flow (O.S. & Swaps)
- **Corrective Maintenance**: Técnico vai a campo. Se houver troca, máquina original vem para laboratório (Backup).
- **10-Day Rule**: Backup não deve ficar mais de 10 dias na área. Sistema deve monitorar esse tempo.
- **OS Requirement**: Informar contador atualizado + comprovante (foto/folha config).
- **Mau Uso**: Se dano for por usuário, colher fotos + "Termo de Ciência" assinado. Redirecionar custo.

### 2.2 Preventive Maintenance (MP)
- Monitorar vida útil: UnidImg, Fusão, Belt, Disposal.
- **Regra de Vida**: Default 60k impressões.
- **Meta**: Troca preventiva na chegada da peça, peça antiga fica como sobressalente.

### 2.3 Map Management (Divergences)
- Técnico pode editar o Mapa manualmente (Divergências).
- **Lógica de Conflito**: Ao subir mapa oficial (mensal), checar se há edições técnicas não aplicadas.
- **Resolução**: Modal permite escolher entre "Manter Técnico" ou "Aplicar Oficial".
- **Notificação**: Divergências geram alerta persistente até serem sanadas via Teams Script.

### 2.4 NF Management
- Armazenamento de NFs escaneadas + Meta-dados (Número, Itens, Data).

## 3. Technical Requirements

### 3.1 Role-Based Access Control (RBAC)
- **Novas Roles**: `insumos`, `manutencao`.
- **Sidebar Filtering**: Filtrar menus via `Layout.jsx` com base na role.
- **Route Guards**: Proteção de rotas no `App.jsx`.

### 3.2 Notification System
- Indicador global de divergências no Header.
- Notificação individual por entrada pendente.

### 3.3 Data Tracking
- Campo `DataEntradaManutencao` para controle de SLA de 10 dias.

## 4. Acceptance Criteria
- [ ] Usuários `role=insumos` não acessam `/maintenance`.
- [ ] Usuários `role=manutencao` não acessam `/stock` ou `/wizard`.
- [ ] Upload de mapa detecta divergências técnicas.
- [ ] Modal de conflito permite decisão granular.
- [ ] Script do Teams segue modelo oficial do prompt.
- [ ] Alerta visual para backups com > 10 dias.
