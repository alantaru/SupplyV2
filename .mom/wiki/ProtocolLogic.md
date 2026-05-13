# Protocol Logic

O sistema de protocolos ("Entregas") gerencia o ciclo de vida da entrega de suprimentos, desde a solicitação até a baixa e auditoria.

## Ciclo de Vida do Protocolo
1.  **Criação**: Um protocolo é gerado (ID sequencial). No momento da criação, o sistema tira um **Snapshot** dos dados do equipamento (IP, Status, Toner %) para auditoria futura.
2.  **Pendente**: O protocolo aguarda a entrega física.
3.  **Entregue**: Ao realizar a entrega, o estoque é decrementado automaticamente (**SmartStock**).
4.  **Cancelado**: O protocolo é invalidado e o estoque (se já baixado) não é afetado retrospectivamente a menos que explicitado.

## SmartStock (Baixa Automática)
Quando um protocolo é marcado como `Entregue`:
- O sistema identifica os itens (`A4`, `A3`, `TonerPreto`, etc.).
- Para toners, utiliza o `Modelo` do equipamento para encontrar o item correto no estoque.
- Decrementa a quantidade e registra um lançamento de `Consumo` em `ESTOQUE_LANCAMENTOS.csv`.

## Snapshot de Auditoria
Camadas de dados capturadas na criação:
- **Toner Snapshot**: `PorcentagemBK`, `PorcentagemCY`, etc., salvos no momento da solicitação.
- **Equipment Snapshot**: `IP`, `StatusEquipamento`, `Marca`, `UF`, `CentroCusto`, `Gerencia`.
Isso garante que, mesmo que o equipamento mude de local ou status no futuro, o registro da entrega preserve as condições originais.

## Sistema de Filtragem e Busca
O `ProtocolService` utiliza um método consolidado `_apply_filters` para garantir consistência entre as listagens em tela e as exportações (CSV):
- **Status**: Filtra por `DataEntrega` (Vazio = Pendente, Preenchido = Entregue).
- **Busca Global**: Pesquisa por `Protocolo` ou `Serie`.
- **Filtros de Data**: Range baseado em `DataEntrega` (formato brasileiro DD/MM/YYYY convertido para comparação).
- **Filtros de Domínio**: `Cidade`, `Fila`, `Empresa`.

## Referências
- Código: `backend/core/services/protocol.py`
- Dependência: `backend/core/services/equipment.py` (para snapshots).
- Normalização: `backend/core/adapters.py` (utilizado para garantir cabeçalhos canônicos antes do filtro).
