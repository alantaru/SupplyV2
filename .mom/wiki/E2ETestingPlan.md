# E2E Testing Plan

Este documento detalha os fluxos críticos que devem ser validados via Playwright para garantir a integridade do Supply 2026.

## Fluxo 1: Autenticação e Contexto
- **Objetivo**: Garantir que o usuário consegue logar e que o `active_contract` persiste.
- **Passos**:
  1. Login com admin/admin.
  2. Verificar redirecionamento para `/equipment`.
  3. Alternar contrato no `ContractSwitcher`.
  4. Recarregar a página e verificar se o contrato permanece o mesmo.

## Fluxo 2: Gestão de Inventário (Upload)
- **Objetivo**: Validar o processamento de arquivos MAPA.
- **Passos**:
  1. Ir para `/import`.
  2. Fazer upload de um `Mapa.csv` válido.
  3. Verificar se as linhas são exibidas na tabela de pré-visualização.
  4. Clicar em "Confirmar Importação".
  5. Verificar se os equipamentos aparecem na listagem principal.

## Fluxo 3: Ciclo de Entrega (Protocolo + Estoque)
- **Objetivo**: Validar a integração entre Protocolos e SmartStock.
- **Passos**:
  1. Selecionar um equipamento e clicar em "Gerar Protocolo".
  2. Preencher itens (ex: 2 resmas A4).
  3. Confirmar criação.
  4. Abrir o protocolo e clicar em "Baixar Entrega".
  5. Verificar no Dashboard de Estoque se o saldo de A4 diminuiu em 2 unidades.

## Fluxo 4: Impressão e Relatórios
- **Objetivo**: Garantir que os documentos gerados estão corretos.
- **Passos**:
  1. Ir para `/reports`.
  2. Gerar uma rota de entrega.
  3. Clicar em "Imprimir".
  4. Validar se o modal de impressão abre (usando mocks de print).

## Referências
- Testes: `frontend/tests/e2e/`.
- Config: `frontend/playwright.config.js`.
