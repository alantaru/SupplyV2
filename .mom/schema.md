# MOM Wiki Schema (LLM OS)

Este arquivo define como a Antigravity (CPU) mantém a memória persistente (Wiki) do projeto Supply 2026.

## Arquitetura
1. **Raw Sources**: O código-fonte (`backend/`, `frontend/`), documentação técnica e logs de conversação.
2. **Wiki (`.mom/wiki/`)**: Coleção de arquivos markdown interligados que representam o conhecimento sintetizado.
3. **Index (`.mom/index.md`)**: Catálogo de todas as páginas da Wiki para busca rápida.
4. **Log (`.mom/log.md`)**: Registro cronológico de mudanças, decisões e ingestões.

## Operações
- **Ingest**: Ao realizar uma mudança significativa ou ler uma nova fonte, a Antigravity atualiza as páginas relevantes da Wiki, o Index e o Log.
- **Query**: Antes de tarefas complexas, a Antigravity consulta a Wiki para garantir conformidade arquitetural.
- **Lint**: Verificação periódica de contradições ou informações obsoletas na Wiki.

## Convenções de Escrita
- Usar links internos: `[[NomeDaPagina]]`.
- Cada página deve ter uma seção de `Referências` apontando para o código ou log de origem.
- Decisões críticas devem ser registradas em `.mom/wiki/decisions/`.
