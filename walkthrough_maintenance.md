# Walkthrough: Maintenance Persona & Technical Control

Esta entrega estabiliza o fluxo de manutenção técnica, segregando as operações de "Insumos" (Almoxarifado) das operações de "Manutenção" (Técnica) e implementando controles rígidos de SLA e divergências.

## 1. Segregação de Persona (RBAC)
O sistema agora diferencia os usuários através das roles `insumos` e `manutencao`.

*   **Insumos**: Visualiza apenas dashboards de Pendências, Estoque, Rotas e Histórico.
*   **Manutenção**: Visualiza apenas dashboards de Manutenção, Equipamentos e Solicitantes.
*   **Admin**: Visualiza todos os módulos.

## 2. Monitoramento de SLA (Regra dos 10 Dias)
Implementamos um rastreador de **Backups em Campo**.
*   Máquinas sinalizadas como `BACKUP` no mapa têm sua permanência calculada.
*   Alerta visual (Vermelho/Crítico) se a máquina exceder 10 dias de permanência.
*   Dashboard dedicado em "Monitoramento Backups (SLA)".

## 3. Gestão de Divergências e Notificações
Divergências geradas por edições técnicas manuais agora são persistentes.
*   Um **Bell de Notificação** global no header indica o número de divergências pendentes.
*   O sistema impede o "esquecimento" de sincronizar o mapa técnico com o oficial.

## 4. Fluxo de O.S. e Mau Uso
O Wizard de O.S. foi aprimorado para capturar evidências.
*   **Flag de Mau Uso**: Se ativado, exige o upload de fotos e do Termo de Ciência.
*   **Roteiro Teams**: Gerado automaticamente com suporte a movimentações de saída/entrada e alertas de mau uso.

## 5. Verificação Técnica
*   [x] Filtro de Sidebar via `App.jsx`.
*   [x] Proteção de rotas via `App.jsx`.
*   [x] Endpoint `/maintenance/backups-aging` para cálculo de datas.
*   [x] Endpoint `/maintenance/divergences` para contador de notificações.
*   [x] Suporte a `multipart/form-data` no upload de evidências de O.S.
