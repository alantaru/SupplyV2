# Arquivos de Exemplo — Supply 2026

Esta pasta contém arquivos CSV de exemplo com **dados simulados** para demonstrar o formato esperado pelo sistema.

> ⚠️ Todos os dados são fictícios. Nenhum dado real de produção está presente neste repositório.

## Arquivos Disponíveis

| Arquivo | Descrição | Uso no Sistema |
|---------|-----------|----------------|
| `mapa_example.csv` | Inventário de equipamentos | Upload em `/settings` → MAPA |
| `contadores_example.csv` | Contadores e níveis de toner | Upload em `/settings` → CONTADORES |
| `papel_example.csv` | Histórico de consumo de papel | Upload em `/settings` → PAPEL |
| `entregas_example.csv` | Histórico de protocolos de entrega | Upload em `/settings` → ENTREGAS |
| `estoque_example.csv` | Posição atual do estoque | Upload em `/settings` → ESTOQUE |

## Como Usar

1. Faça login no sistema
2. Acesse **Configurações** (`/settings`)
3. Selecione o card do arquivo desejado
4. Clique em **Atualizar** e selecione o arquivo CSV correspondente
5. O sistema detectará automaticamente o encoding e mapeará as colunas

## Formato das Colunas

### MAPA (Equipamentos)
- `SERIE` — Número de série do equipamento **(obrigatório)**
- `MODELOSIMPRESS` — Modelo do equipamento
- `FILA` — Hostname/fila de impressão
- `STATUS` — Status atual (Ativo, Backup, Inativo)
- `CIDADE`, `EMPRESA`, `LOCALINSTALACAO`, `RUAREF`, `AREA` — Localização

### CONTADORES
- `SERIE` — Número de série **(obrigatório)**
- `TOTAL` — Contador total de páginas **(obrigatório)**
- `DATA` — Data da leitura **(obrigatório)**
- `%BK`, `%CY`, `%Mg`, `%Yw` — Percentual de toner por cor

### PAPEL
- `SERIE` — Número de série **(obrigatório)**
- `A4RESMA` — Sugestão de resmas A4
- `MEDIA` — Média mensal de páginas

> 💡 O sistema aceita colunas com nomes alternativos e detecta automaticamente o mapeamento correto.
