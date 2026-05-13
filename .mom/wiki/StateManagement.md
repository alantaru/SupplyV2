# State Management

O Supply 2026 utiliza **React Context API** para o gerenciamento de estado global, focando em simplicidade e performance através de hooks customizados.

## Contextos Globais
1.  **AuthProvider**:
    - Gerencia a sessão do usuário (JWT).
    - Persiste o `active_contract` no `localStorage`.
    - Realiza o "Silent Refresh" ao carregar a aplicação via `auth/me`.
    - Garante que Admins/Superadmins possam acessar qualquer contrato, enquanto usuários regulares são validados contra sua lista de permissões.
2.  **ThemeContext**:
    - Gerencia o modo (dark/light) e as cores de destaque (accent).
    - Persiste as preferências visuais do usuário.
3.  **ToastContext**:
    - Prover notificações não-bloqueantes em toda a interface.

## Comunicação com Backend
- Utiliza uma instância centralizada do **Axios** (`lib/api.js`).
- **Interceptors**: Injetam automaticamente o Bearer Token em todas as requisições e tratam erros 401 para logout automático.

## Persistência
- **Tokens & Contexto**: `localStorage`.
- **Filtros de Dashboard**: Mantidos em estado local dos componentes para evitar poluição global, sendo resetados ao trocar de página/aba.

## Referências
- Código: `frontend/src/context/`.
- Wiki Relacionada: [[SecurityLogic]], [[FrontendLogic]].
