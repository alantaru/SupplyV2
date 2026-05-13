# Storage Logic

O sistema de armazenamento do Supply 2026 utiliza o padrão **Factory** para fornecer uma interface unificada de acesso a arquivos, independentemente do backend (Local ou Cloud).

## Camada de Abstração (StorageBackend)
A interface define métodos padrão para:
- `exists(key)`: Verifica a existência de um arquivo.
- `get_uri(key)`: Retorna o caminho completo compatível com `fsspec` (ex: `s3://...` ou `file://...`).
- `list_files(prefix)`: Lista arquivos em um diretório/prefixo.

## Implementações
1.  **LocalStorage**: Utiliza o sistema de arquivos local. O `base_path` é definido por `config.CONTRACTS_DIR`.
2.  **S3Storage**: Integra-se com AWS S3. O bucket é configurado via variável de ambiente `S3_BUCKET_NAME`.

## Inicialização (get_storage)
O backend é escolhido em tempo de execução via variável de ambiente `STORAGE_TYPE`:
- `LOCAL` (Padrão): Ideal para desenvolvimento e implantações on-premise simples.
- `S3`: Recomendado para produção em alta disponibilidade (AWS).

## Referências
- Código: `backend/core/storage/`.
- Config: `backend/config.py`.
- Wiki Relacionada: [[DatabaseLogic]].
