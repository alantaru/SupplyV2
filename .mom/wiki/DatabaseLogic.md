# Database Logic

O Supply 2026 utiliza uma arquitetura baseada em arquivos planos (CSV/XLSX) com uma camada de abstração de armazenamento (Storage Layer) que permite alternar entre Local Filesystem e S3.

## Camada de Acesso (CRUD)
- **Caminhos Dinâmicos**: Os arquivos são organizados por `contract_id` (ex: `6071/Entregas.csv`).
- **Normalização na Carga**: Todo DataFrame carregado passa por `_clean_df` para remover BOM (ï»¿) e espaços em branco nos nomes das colunas.
- **Salvamento Robusto**: `save_dataframe_csv` garante a integridade convertendo tipos NumPy complexos para tipos Python puros, removendo linhas vazias e forçando o encoding `utf-8-sig`.

## Integridade e Concorrência
- **DB_LOCK**: Um `threading.Lock` global é utilizado para evitar condições de corrida em escritas simultâneas.
- **Aviso**: O `threading.Lock` é seguro apenas para implantações de processo único. Em ambientes multi-worker (ex: Uvicorn com `--workers`), a integridade deve ser garantida via Storage Level Locking ou DB externo.

## Robustez de Parsing
- **repair_and_load_csv**: Capaz de lidar com CSVs corrompidos (newlines inesperados em campos de texto) e detectar automaticamente o separador (`;`, `,`, or `\t`).

## Referências
- Código: `backend/database.py`.
- Wiki Relacionada: [[InfrastructureMap]].
