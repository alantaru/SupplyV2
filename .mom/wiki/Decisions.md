# Decisions

Registro de decisões arquiteturais e técnicas críticas.

## [2026-05-10] Estabilidade Frontend (Linting Fix)
- **Contexto**: O frontend apresentava violações graves de Rules of Hooks e ciclos de renderização causados por `setState` síncronos em `useEffect`.
- **Decisão**: Refatorar componentes para derivar estado durante a renderização (`useMemo`) e mover sub-componentes para fora do loop de render.
- **Impacto**: Eliminação de loops infinitos e garantia de conformidade com padrões React modernos.

## [2026-05-08] Architectural Safety Warning in DB_LOCK
- **Contexto**: O sistema utiliza `threading.Lock` para gerenciar concorrência no banco SQLite/Postgres.
- **Problema**: `threading.Lock` não funciona entre diferentes processos workers do Uvicorn.
- **Decisão**: Manter o lock para concorrência local mas adicionar avisos explícitos e monitoramento para evitar corrupção de dados em escala.

## [2026-05-08] Decoupling Serial Truncation
- **Contexto**: A lógica de truncamento de números de série estava fixada em 14 caracteres.
- **Decisão**: Desacoplar para `config.MAX_SERIAL_LENGTH` para suportar contratos com identificadores mais longos.

## [2026-05-08] Adoption of MOM
- **Contexto**: Drifting arquitetural e perda de contexto entre sessões.
- **Decisão**: Implementar o Memory-Oriented Markdown (MOM) para manter consciência absoluta do sistema.
