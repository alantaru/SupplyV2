# API Reference — Supply 2026

Base URL: `https://your-domain.com/api`

Documentação interativa: `/api/docs` (Swagger UI) | `/api/redoc` (ReDoc)

## Autenticação

Todos os endpoints (exceto `/auth/token` e `/health`) requerem JWT no header:

```
Authorization: Bearer <token>
```

### POST /auth/token
Login e obtenção do JWT.

```json
// Request (form-data)
{ "username": "admin", "password": "senha" }

// Response
{ "access_token": "eyJ...", "token_type": "bearer" }
```

### GET /auth/me
Dados do usuário autenticado.

### PUT /auth/change-password
Alterar senha.

```json
{ "old_password": "atual", "new_password": "nova" }
```

---

## Protocolos de Entrega

### GET /data/entregas
Lista protocolos com filtros.

**Query params:** `status` (pending/delivered/all), `limit`, `city`, `fila`, `empresa`, `search`, `start_date`, `end_date`

### POST /data/entregas
Criar protocolo.

```json
{
  "serie": "SN001",
  "solicitante": "Alice",
  "solicitacao": "Telefone",
  "a4": 3,
  "toner_bk": 1,
  "obs": "Urgente"
}
```

### POST /data/entregas/{id}/deliver
Registrar entrega.

```json
{ "receivedBy": "Bob", "user": "operador" }
```

### POST /data/entregas/{id}/cancel
Cancelar protocolo.

```json
{ "reason": "Motivo do cancelamento" }
```

### GET /data/entregas/export
Exportar CSV com filtros aplicados.

---

## Estoque

### GET /stock/
Níveis atuais de estoque.

### POST /stock/adjust
Ajuste manual.

```json
{
  "item": "A4 (RESMAS)",
  "qty": 10,
  "reason": "Recebimento NF 12345",
  "type": "Entrada"
}
```

### GET /stock/history
Histórico de movimentações.

---

## Rotas Logísticas

### GET /routes/
Lista rotas salvas.

### POST /routes/
Criar rota.

```json
{
  "name": "Rota Ipatinga Centro",
  "series": ["SN001", "SN002", "SN003"],
  "filters": [{"field": "Cidade", "value": "Ipatinga"}]
}
```

### POST /routes/analyze
Analisar lista de séries.

```json
{ "series": ["SN001", "SN002"] }
```

### POST /routes/generate
Gerar protocolos em lote.

```json
{
  "route_name": "Rota Ipatinga",
  "selection": [
    {"Serie": "SN001", "A4": 3},
    {"Serie": "SN002", "A4": 2, "TonerBk": 1}
  ]
}
```

---

## BI Dashboard

### GET /bi/dashboard
Retorna todos os dados analíticos.

**Query params:** `start_date` (YYYY-MM-DD), `end_date` (YYYY-MM-DD)

**Response:**
```json
{
  "delivery": { "total_entregas": 150, "avg_delivery_days": 1.8, ... },
  "supply": { "total_a4": 450, "total_toner_bk": 23, ... },
  "equipment": { "fleet_size": 87, "toner_alerts": [...], ... },
  "stock": { "items": [...], "zero_stock_items": [...], ... },
  "operational": { "sla_compliance_rate": 97.3, ... },
  "predictive": { "toner_alerts": [...], "paper_alerts": [...] }
}
```

---

## Upload de Arquivos

### POST /upload/csv/{file_key}
Upload de arquivo base (MAPA, CONTADORES, PAPEL, etc.)

**file_key:** `MAPA` | `CONTADORES` | `PAPEL` | `ESTOQUE` | `SOLICITANTES`

**Response (sucesso):**
```json
{ "status": "success", "lines": 87 }
```

**Response (mapeamento necessário):**
```json
{
  "status": "mapping_required",
  "temp_token": "abc123.csv",
  "detected_columns": ["NUMERO_SERIE", "MODELO_EQ", ...],
  "current_mapping": { "SERIE": "NUMERO_SERIE", ... }
}
```

### POST /upload/confirm-mapping
Confirmar mapeamento de colunas.

```json
{
  "file_key": "MAPA",
  "temp_token": "abc123.csv",
  "mapping": { "SERIE": "NUMERO_SERIE", "FILA": "HOSTNAME" }
}
```

---

## Administração

### GET /admin/contracts
Lista contratos (admin/superadmin).

### POST /admin/contracts
Criar contrato.

```json
{ "id": "6070IPA", "name": "Usiminas Ipatinga", "description": "..." }
```

### GET /admin/users
Lista usuários.

### POST /admin/users
Criar usuário.

```json
{
  "username": "operador1",
  "password": "Senha123!",
  "role": "user",
  "contracts": ["6070IPA"]
}
```

---

## Solicitantes

### GET /data/solicitantes
Lista solicitantes com filtros opcionais.

### POST /data/solicitantes
Criar solicitante.

### POST /data/solicitantes/import-from-mapa
Importar solicitantes do MAPA em lote.

---

## Health Check

### GET /health
```json
{ "status": "ok", "version": "3.0.0", "tag": "V3-PERFECTION" }
```
