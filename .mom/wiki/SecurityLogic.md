# Security Logic

Mecanismos de autenticação, autorização e controle de acesso (RBAC) do Supply 2026.

## Autenticação
- **Protocolo**: OAuth2 com Bearer Tokens (JWT).
- **Criptografia**: Passwords hasheadas com `pbkdf2_sha256`.
- **JWT**: Tokens assinados com `HS256`, expiração configurável (padrão 15min ou via timedelta).

## Níveis de Acesso (RBAC)
- **User**: Acesso restrito aos contratos explicitamente atribuídos.
- **Admin**: Acesso a ferramentas administrativas e a todos os contratos.
- **Superadmin**: Privilégios totais, incluindo gestão de outros administradores e bypass de verificações de contrato.

## Gestão de Contratos (Multi-tenancy)
O sistema é multitenant baseado em `active_contract`.
- Usuários regulares só podem visualizar dados do seu `active_contract`.
- Admins/Superadmins podem alternar entre qualquer contrato disponível no sistema.
- Se um usuário não tem um contrato ativo definido, o sistema tenta atribuir o primeiro da sua lista ou o `DEFAULT_CONTRACT`.

## Referências
- Código: `backend/auth.py`, `backend/users.py`.
- Config: `backend/config.py`.
