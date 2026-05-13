# Equipment Logic

O `EquipmentService` gerencia o inventário de hardware (MAPA), fornecendo busca, detalhamento e inteligência de suprimentos.

## Busca & Filtragem
- **Busca Canonical**: Utiliza o `adapters.normalize_dataframe` para garantir que campos como `Serie` e `Fila` sejam pesquisáveis independentemente do cabeçalho original do CSV.
- **Cascading Filters**: O método `get_unique_values` suporta filtros contextuais (ex: selecionar uma Cidade filtra as Opções de Rua disponíveis), seguindo a lógica `AND` entre campos e `OR` dentro do mesmo campo.

## Inteligência de Cor
O sistema detecta automaticamente se um equipamento é colorido (`is_color`) usando uma hierarquia de 3 níveis:
1.  **Leitura de Toner**: Presença de `%CY`, `%MG` ou `%YW` no arquivo de contadores.
2.  **Campo Tipo**: Menção a "Color" ou "Cor" no campo `TipodoEquipamento`.
3.  **Heurística de Modelo**: Regex e padrões conhecidos (ex: modelos Xerox iniciando com `C` ou contendo `Versalink C`).

## Sugestão de Suprimentos
Cruza 3 fontes de dados para sugerir o que deve ser enviado:
1.  **Contadores**: Percentual de toner (alerta < 30%).
2.  **Média de Papel**: Consumo histórico vs `media_sheets`.
3.  **Histórico de Entregas**: Evita sugestões redundantes se uma entrega foi realizada recentemente para o mesmo item.

## Referências
- Código: `backend/core/services/equipment.py`.
- Wiki Relacionada: [[RefineryLogic]], [[StockLogic]].
