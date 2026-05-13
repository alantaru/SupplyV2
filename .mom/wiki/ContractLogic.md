# Contract Logic

O `ContractsManager` é o núcleo da arquitetura multitenant do Supply 2026, garantindo a separação e integridade dos dados entre diferentes clientes/contratos.

## Estrutura do Contrato
Cada contrato é composto por:
1.  **Metadados (`config.json`)**: ID, nome, descrição, data de criação e administradores associados.
2.  **Mapeamentos (`mappings.json`)**: Dicionário que traduz cabeçalhos customizados do usuário para o padrão interno (Canon).
3.  **Repositório de Dados**: Subdiretório nomeado com o ID do contrato contendo os CSVs core.

## Cabeçalhos e Aliases (A "Verdade" do Sistema)
O sistema define um conjunto de **REQUIRED_HEADERS** e **OPTIONAL_HEADERS** para cada tipo de arquivo:
- **MAPA**: Requer `SERIE`.
- **CONTADORES**: Requer `SERIE`, `TOTAL`, `DATA`.
- **ENTREGAS**: Possui um esquema fixo exaustivo para garantir compatibilidade com o histórico legado.

## Mapeamento Universal
O `COLUMN_ALIASES` permite que o sistema "aprenda" variações de nomes de colunas (ex: `SN`, `SERIAL`, `SÉRIE` → `SERIE`). Isso reduz a necessidade de intervenção manual durante uploads.

## Inicialização de Contrato
Ao criar um novo contrato, o sistema executa `initialize_files`, gerando automaticamente os CSVs vazios com os cabeçalhos obrigatórios, garantindo que o backend nunca retorne erro 404 para arquivos base.

## Referências
- Código: `backend/core/contracts.py`.
- Wiki Relacionada: [[RefineryLogic]], [[SecurityLogic]].
