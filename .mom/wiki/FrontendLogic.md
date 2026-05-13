# Frontend Logic

Padrões arquiteturais e de implementação do frontend do Supply 2026.

## Stack Técnica
- **Core**: React 18+ (Vite).
- **Estilo**: Vanilla CSS + TailwindCSS (utilizado para layouts flexíveis).
- **Navegação**: React Router DOM v6.
- **API**: Axios com interceptadores para autenticação Bearer.

## Padrões de Estado
- **Global**: `AuthProvider` para identidade, `ThemeContext` para estética, `ToastContext` para notificações.
- **Local**: `useState` para UI simples.
- **Memoização**: Uso intensivo de `useCallback` e `useMemo` para estabilizar dependências de efeitos e evitar re-renders desnecessários em componentes pesados (ex: `RouteDashboard`).

## Layout & Estética (Premium Design)
- **Glassmorphism**: Uso de `backdrop-blur`, `bg-white/10` e bordas semitransparentes.
- **Animações**: Transições suaves, rotações de ícones em hover.
- **Responsividade**: Layout baseado em `Layout.jsx` com sidebar colapsável.

## Tratamento de Erros
- Erros de API são capturados e exibidos via `Toast`.
- Erros de validação do [[RefineryLogic]] são destacados linha a linha nas tabelas de pré-visualização.

## Referências
- Código: `frontend/src/App.jsx`, `frontend/src/components/Layout.jsx`.
- Hardening: [[FrontendHardening]].
