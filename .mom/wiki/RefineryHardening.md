# Refinery Hardening

O `RefineryValidator` atua como a Camada 3.5 (Iron Validator) de processamento de dados, garantindo que apenas dados íntegros entrem no banco de dados.

## Princípios de Validação
O validador segue o princípio de **Partition Rescue**:
- Dados válidos são processados imediatamente.
- Dados inválidos são segregados em `rejected_data` com metadados de erro (`_validation_errors`).
- Isso permite que o usuário corrija apenas as linhas problemáticas sem bloquear todo o upload.

## Regras de Integridade (MAPA)
As regras atuais incluem:
- **Serie**: Mínimo de 4 caracteres. Truncamento automático para 14 caracteres ocorre no adaptador.
- **IP**: Regex estrito para formato IPv4 (`X.X.X.X`). Valores vazios são permitidos (opcionais no hardware).
- **Email**: Regex para conformidade com padrões de rede corporativa.
- **Valor**: Deve ser numérico e não-negativo.

## Auditoria & Logs
Cada falha de validação é logada detalhadamente com:
- O nome da coluna.
- A mensagem de erro específica.
- O valor original que causou a falha.

## Referências
- Código: `backend/core/refinery/validator.py`.
- Wiki Relacionada: [[RefineryLogic]].
