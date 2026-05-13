# Stock Logic

Regras de negócio para gestão de inventário e movimentações de suprimentos.

## Categorias de Itens
O sistema organiza o estoque em três categorias principais:
1.  **Toner**: Vinculado a um `modelo_equipamento` e `tipo_toner` (BK, CY, MG, YW). O nome é composto automaticamente como `{TonerType} {Model}`.
2.  **Papel**: Suporta `A4` e `A3`. Nomes padronizados: `A4 (RESMAS)` ou `A3 (RESMAS)`.
3.  **Customizado**: Itens genéricos com nome livre.

## Movimentações
Todas as mudanças no `EstoqueAtual` são registradas em `ESTOQUE_LANCAMENTOS.csv`.
- **Ajuste**: Alteração manual de quantidade.
- **Saída**: Ocorre via geração de protocolos de entrega.
- **Entrada**: Ocorre via ajuste manual ou importação de NF.

## Persistência e Concorrência
- **DB_LOCK**: Todas as operações de escrita no CSV são protegidas por um lock global para evitar corrupção.
- **Arquivos**:
    - `ESTOQUE_{contract_id}.csv`: Saldo atual.
    - `ESTOQUE_LANCAMENTOS_{contract_id}.csv`: Histórico completo (Audit Trail).

## Validações
- **Duplicatas**: Verificação case-insensitive do nome do item (`TipoModelo`) antes da criação.
- **Retrocompatibilidade**: O sistema preenche automaticamente colunas ausentes (`Categoria`, `ModeloEquipamento`, `TipoToner`, `Codigo`) com valores default durante o carregamento.

## Referências
- Código: `backend/core/services/stock.py`
- Database: `backend/database.py`
