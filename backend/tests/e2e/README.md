# Suíte E2E — Supply 2026

Testes End-to-End com Playwright (Python) contra `https://your-domain.com`.

## Setup

### 1. Instalar dependências

```bash
pip install pytest pytest-playwright hypothesis python-dotenv pytest-timeout
playwright install chromium
```

### 2. Configurar variáveis de ambiente

```bash
cp tests/e2e/.env.e2e.example tests/e2e/.env.e2e
# Editar .env.e2e com as credenciais reais
```

### 3. Criar usuários de teste no sistema

Antes de rodar os testes, criar via `/admin`:
- `admin_e2e` (role: admin) com contrato `e2e-test-contract-2026`
- `user_e2e` (role: user) com contrato `e2e-test-contract-2026`

## Execução

```bash
# Smoke tests (< 2 min) — para CI/CD em todo push
pytest tests/e2e/ -m smoke

# Testes críticos (< 10 min) — para merge em main
pytest tests/e2e/ -m critical

# Testes lentos (< 30 min) — para deploy em produção
pytest tests/e2e/ -m slow

# Suíte completa
pytest tests/e2e/ -m e2e

# Com browser visível (debug)
pytest tests/e2e/ --headed -m smoke

# Gerar relatório HTML
pytest tests/e2e/ -m smoke --html=artifacts/report.html
```

## Estrutura

```
tests/e2e/
├── conftest.py          ← fixtures globais: auth, captura de artefatos
├── pytest.ini           ← configuração pytest
├── .env.e2e             ← credenciais (não commitar)
├── .env.e2e.example     ← template sem credenciais
├── README.md            ← este arquivo
│
├── pages/               ← Page Object Models
│   ├── base_page.py
│   ├── login_page.py
│   ├── dashboard_page.py
│   ├── settings_page.py
│   ├── protocol_wizard_page.py
│   ├── delivery_page.py
│   ├── stock_page.py
│   ├── routes_page.py
│   ├── bi_dashboard_page.py
│   ├── admin_page.py
│   └── solicitantes_page.py
│
├── fixtures/            ← fixtures de dados de teste
│   ├── auth_fixtures.py
│   ├── data_fixtures.py
│   ├── file_fixtures.py
│   └── files/           ← CSVs de teste
│
├── tests/               ← testes por domínio
│   ├── test_auth.py
│   ├── test_contracts.py
│   ├── test_upload.py
│   ├── test_protocols.py
│   ├── test_delivery.py
│   ├── test_stock.py
│   ├── test_routes.py
│   ├── test_bi.py
│   ├── test_solicitantes.py
│   ├── test_error_flows.py
│   └── test_critical_flows.py
│
└── artifacts/           ← gerado automaticamente ao falhar
    ├── screenshots/
    └── traces/
```

## Artefatos de Falha

Ao falhar, cada teste captura automaticamente:
- Screenshot em `artifacts/screenshots/{test_id}_{timestamp}.png`
- Trace Playwright em `artifacts/traces/{test_id}_{timestamp}.zip`

Para visualizar um trace:
```bash
playwright show-trace artifacts/traces/<arquivo>.zip
```

## Propriedades de Corretude Testadas

| # | Propriedade | Marcador |
|---|-------------|---------|
| 1 | JWT armazenado após login bem-sucedido | smoke |
| 2 | Logout limpa sessão para qualquer usuário | smoke |
| 3 | Rotas protegidas redirecionam sem token | smoke |
| 4 | Credenciais inválidas sempre exibem erro | smoke |
| 5 | Controle de acesso por role em /admin | critical |
| 6 | Upload de extensão inválida rejeitado no cliente | critical |
| 7 | Entrega atualiza status para "entregue" | critical |
| 8 | Entrega reduz estoque correspondente | critical |
| 9 | Ajuste manual reflete saldo correto | critical |
| 10 | Todas as abas do BI carregam sem erro | critical |
| 11 | Geração de protocolos em lote preserva contagem | slow |
