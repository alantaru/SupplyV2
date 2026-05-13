# Refinery Logic

O motor de processamento de dados ("The Refinery") é responsável por transformar arquivos brutos (CSV/XLSX) em dados estruturados e validados para o sistema.

## Camadas de Processamento
1.  **Ingestor**: Identifica o formato do arquivo, detecta encoding e delimitadores, e carrega em um DataFrame inicial.
2.  **Mapper**: Traduz os nomes das colunas de origem para o esquema interno do Supply 2026 usando o mapeamento configurado pelo usuário.
3.  **Normalizer**: Limpa os dados (trimming, preenchimento de nulos, conversão de tipos de dados).
4.  **Validator (The Iron Validator)**: Aplica regras rígidas de validação.

## Regras de Validação (Validator)
Atualmente focado no tipo `MAPA`:
- **Serial (`serie`)**: Obrigatório e deve ter mais de 3 caracteres.
- **Valor**: Deve ser numérico e maior ou igual a zero.
- **IP**: Deve seguir o formato IPv4 padrão se presente.
- **Email**: Deve seguir o formato RFC se presente.

## Fluxo de Erros
- **Partial Rescue**: O sistema permite separar linhas válidas de linhas rejeitadas.
- **Audit Report**: Linhas rejeitadas são devolvidas ao frontend com o campo `_validation_errors` descrevendo o motivo da falha.

## Referências
- Código: `backend/core/refinery/validator.py`, `backend/core/refinery/ingestor.py`
- Fluxo: [[DataManagement]]
