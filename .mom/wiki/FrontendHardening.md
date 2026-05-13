# Frontend Hardening

Diretrizes e medidas para garantir a estabilidade e qualidade do frontend.

## Regras de Hooks
- **Proibição**: Chamar hooks dentro de condições (`if`, `switch`) ou loops.
- **Padrão**: Se um componente requer um retorno antecipado (early return), todos os hooks devem ser declarados antes dessa lógica.
- **Exemplo**: [[UserProfileModal]] refatorado para garantir que `useAuth` e `useToast` rodem sempre.

## Renderização Eficiente
- **Sub-componentes**: Nunca declarar um componente funcional dentro do corpo de outro componente. Isso causa recriações de DOM em cada render.
- **Estado Derivado**: Preferir `useMemo` para calcular valores baseados em props/state em vez de sincronizar via `useEffect`.
- **Exemplo**: [[RoutePrint]] utiliza `useMemo` para paginação.

## Linting & Qualidade
- **Meta**: 0% erros de linting.
- **Catch Blocks**: Usar `_error` para silenciar logs intencionais sem violar `no-unused-vars`.
- **Hoisting**: Funções de efeito colateral e callbacks devem ser declarados antes de serem referenciados em `useEffect`.
