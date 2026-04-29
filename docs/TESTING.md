# Guia de Testes — Supply 2026

## Visão Geral

Supply 2026 implementa uma pirâmide de testes completa com **1488 testes** cobrindo **99% do código**.

```
         ┌──────────────────────────┐
         │    E2E — 74 testes       │  Playwright (Python)
         ├──────────────────────────┤
         │  Integração — 400+       │  FastAPI TestClient
         ├──────────────────────────┤
         │  Unitários — 1000+       │  pytest + mocks
         └──────────────────────────┘
```

## Setup

```bash
cd backend
pip install -r requirements.txt
```

## Testes Unitários e de Integração

```bash
# Rodar suíte completa
pytest

# Com coverage
pytest --cov=. --cov-report=term

# Módulo específico
pytest tests/test_protocol_service_unit.py -v

# Por marcador
pytest -m unit
pytest -m integration
```

### Estrutura dos Testes

```
backend/tests/
├── test_auth_unit.py              # JWT, hashing, verificação
├── test_database_unit.py          # Loaders de CSV
├── test_protocol_service_unit.py  # Protocolos de entrega
├── test_stock_service_unit.py     # Controle de estoque
├── test_route_service_unit.py     # Rotas logísticas
├── test_bi_service_unit.py        # BI analytics
├── test_equipment_service_unit.py # Equipamentos
├── test_ingestor_unit.py          # Refinery ingestor
├── test_mapper_unit.py            # Refinery mapper
├── test_cortex_unit.py            # Cortex (memória)
├── test_storage_s3_unit.py        # S3 storage
├── test_storage_base_unit.py      # Storage abstraction
├── test_admin_integration.py      # Admin CRUD completo
├── test_data_router_integration.py # Endpoints de dados
├── test_upload_router_integration.py # Upload pipeline
├── test_smart_stock_integration.py # SmartStock E2E
├── test_smart_stock_pbt.py        # Property-Based Tests
└── e2e/                           # Playwright E2E
```

## Testes E2E (Playwright)

### Setup

```bash
pip install pytest-playwright hypothesis python-dotenv
playwright install chromium

# Configurar credenciais
cp tests/e2e/.env.e2e.example tests/e2e/.env.e2e
# Editar .env.e2e com credenciais reais
```

### Execução

```bash
# Smoke tests (< 2 min) — para CI/CD
pytest tests/e2e/ -m smoke

# Testes críticos (< 10 min)
pytest tests/e2e/ -m critical

# Fluxos completos (< 30 min)
pytest tests/e2e/ -m slow

# Com browser visível (debug)
pytest tests/e2e/ --headed -m smoke

# Teste específico
pytest tests/e2e/tests/test_auth.py -v
```

### Domínios Cobertos

| Arquivo | Testes | Domínio |
|---------|--------|---------|
| `test_auth.py` | 23 | Login, logout, RBAC, JWT |
| `test_contracts.py` | 5 | Gestão de contratos |
| `test_upload.py` | 9 | Upload + mapeamento de colunas |
| `test_protocols.py` | 3 | Criação de protocolos |
| `test_delivery.py` | 4 | Entrega + histórico |
| `test_stock.py` | 5 | Estoque + ajustes |
| `test_routes.py` | 4 | Rotas + geração em lote |
| `test_bi.py` | 9 | BI Dashboard |
| `test_solicitantes.py` | 3 | Gestão de solicitantes |
| `test_error_flows.py` | 7 | Erros + segurança |
| `test_critical_flows.py` | 2 | Fluxos integrados |

### Propriedades de Corretude Testadas

| # | Propriedade | Tipo |
|---|-------------|------|
| 1 | JWT armazenado após login bem-sucedido | parametrize |
| 2 | Logout limpa sessão para qualquer usuário | parametrize |
| 3 | Rotas protegidas redirecionam sem token | parametrize |
| 4 | Credenciais inválidas sempre exibem erro | Hypothesis |
| 5 | Controle de acesso por role em /admin | parametrize |
| 6 | Upload de extensão inválida rejeitado | parametrize |
| 7 | Entrega atualiza status para "entregue" | example |
| 8 | Entrega reduz estoque correspondente | example |
| 9 | Ajuste manual reflete saldo correto | multi-value |
| 10 | Todas as abas do BI carregam sem erro | parametrize |
| 11 | Geração em lote preserva contagem | example |

## Property-Based Testing (Hypothesis)

```python
# Exemplo: Property 9 — Ajuste manual reflete saldo correto
# Para qualquer sequência de ajustes A1, A2, ..., An:
# saldo_final == saldo_inicial + sum(A1..An)

test_adjustments = [5, -3, 10, -7, 1]
for adj in test_adjustments:
    expected = current_balance + adj
    # ... aplicar ajuste ...
    assert actual == expected
```

## Bugs de Produção Encontrados Durante Testes

Durante o desenvolvimento da suíte de testes, **7 bugs de produção** foram identificados e corrigidos:

1. `SolicitantesService.update()` — dtype mismatch quando coluna Ramal é int64
2. `StockService.update_item()` — dtype mismatch quando coluna Codigo é float64
3. `ProtocolService.deliver()` — KeyError 'Protocolo' em DataFrame vazio
4. `core/session.py` — `database.DEFAULT_CONTRACT` não existe (deveria ser `config.DEFAULT_CONTRACT`)
5. `routers/data.py` — `HTTPException` não importado
6. `core/services/bi.py` — `datetime.utcnow()` deprecated no Python 3.12
7. `ContractsManager.list_contracts()` — prefixos do sistema (`refinery/`, `temp/`) apareciam como contratos

## CI/CD

O arquivo `.github/workflows/e2e.yml` configura:

1. **Health Check** — verifica se o sistema está online
2. **Smoke Tests** — executa testes de smoke após deploy
3. **Critical Tests** — executa testes críticos em merge para main
4. **Slow Tests** — executa fluxos completos sob demanda

```yaml
# Executar manualmente
gh workflow run e2e.yml -f marker=smoke
```
