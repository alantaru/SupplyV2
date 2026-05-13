# Skill: Frontend State Hardening

## Goal
Migrate volatile UI settings from LocalStorage to Backend Contract Config.

## Steps
1. **API Endpoint**: Ensure `GET /contracts/{id}/config` and `PATCH /contracts/{id}/config` are robust.
2. **Branding Sync**:
   - On App Load: Fetch config and populate ThemeContext/Branding state.
   - On Logo Update: Upload to S3/Local and update config URL.
3. **Avatar Handling**:
   - Never store Base64 in LocalStorage.
   - Use `GET /users/me/avatar` returning a signed URL or binary.

## Constraints
- Keep `token` in LocalStorage (standard JWT).
- Keep `active_contract` in LocalStorage for session persistence between reloads, but validate against `/auth/me` list.
