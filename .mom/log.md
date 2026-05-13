# MOM Wiki Log

Registro cronológico de evolução da memória do sistema.

## [2026-05-10] ingest | Refatoração de Linting e Estabilidade Frontend
- **Ação**: Removidos erros de Rules of Hooks e ciclos de renderização.
- **Páginas Afetadas**: [[FrontendLogic]], [[FrontendHardening]], [[Decisions]].
- **Referência**: Conversa c40486e4-641d-4390-8845-6572a949de6d.

## [2026-05-08] decision | Architectural Safety Warning (DB_LOCK)
- **Ação**: Adicionado aviso sobre limitações do threading.Lock em multi-worker.
- **Páginas Afetadas**: [[Decisions]], [[SecurityLogic]].

## [2026-05-08] decision | Decoupling Serial Truncation
- **Ação**: Movida constante mágica 14 para configuração.
- **Páginas Afetadas**: [[Decisions]], [[RefineryLogic]].
