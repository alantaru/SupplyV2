<div align="center">

# 🖨️ Supply 2026

### Sistema Fullstack de Gestão de Insumos de Impressão Corporativa

[![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![AWS](https://img.shields.io/badge/AWS_S3%2FEC2-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![Tests](https://img.shields.io/badge/1488_testes-passing-4CAF50?style=for-the-badge&logo=pytest&logoColor=white)](backend/tests/)
[![Coverage](https://img.shields.io/badge/coverage-99%25-4CAF50?style=for-the-badge)](backend/.coveragerc)
[![E2E](https://img.shields.io/badge/E2E-74_testes-2196F3?style=for-the-badge&logo=playwright&logoColor=white)](backend/tests/e2e/)

<br/>

**Desenvolvido por [Isaac Oliveira](https://www.linkedin.com/in/isaac-oliveira-a0924441)**
*Líder de Serviços II · Desenvolvedor Fullstack · Analista de Sistemas*

[![LinkedIn](https://img.shields.io/badge/LinkedIn-isaac--oliveira-0077B5?style=flat-square&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/isaac-oliveira-a0924441)
[![Email](https://img.shields.io/badge/Email-isaac__oliveira@live.com-D14836?style=flat-square&logo=gmail&logoColor=white)](mailto:isaac_oliveira@live.com)

</div>

---

## O Problema Real

Na gestão de contratos de impressão corporativa do **Grupo Usiminas (Siderurgia)**, o controle era feito manualmente em planilhas Excel:

| Antes | Depois |
|---|---|
| ❌ Estoque em planilhas desatualizadas | ✅ Baixa automática ao registrar entrega |
| ❌ Protocolos em papel ou e-mail | ✅ Wizard digital com histórico completo |
| ❌ Relatórios manuais toda semana | ✅ BI Dashboard com 6 painéis em tempo real |
| ❌ Importação manual de CSVs inconsistentes | ✅ Refinery com detecção automática de encoding |
| ❌ Sem visibilidade de SLA | ✅ Monitoramento contínuo com alertas |

---

## Funcionalidades

<table>
<tr>
<td width="50%">

**📋 Gestão de Protocolos**
- Wizard de 3 etapas para solicitar insumos
- Enriquecimento automático com dados do equipamento
- Snapshot de toner no momento da criação
- Histórico completo com filtros avançados

</td>
<td width="50%">

**📦 Estoque Inteligente**
- Baixa automática ao registrar entrega
- Busca inteligente por categoria + modelo
- Criação automática de item quando não existe
- Histórico de movimentações com auditoria

</td>
</tr>
<tr>
<td width="50%">

**🗺️ Rotas Logísticas**
- Agrupamento de entregas por localização
- Análise de estoque estimado por equipamento
- Geração de protocolos em lote (1 clique)
- Planejamento com status de ciclo

</td>
<td width="50%">

**📊 BI Dashboard Executivo**
- 6 painéis analíticos em tempo real
- Métricas de SLA, entrega, supply e operacional
- Filtros por período com recálculo dinâmico
- Alertas preditivos de toner e papel

</td>
</tr>
<tr>
<td width="50%">

**🔬 Refinery Universal**
- Detecção automática de encoding (UTF-8, CP1252, Latin1, UTF-16)
- Mapeamento inteligente de colunas com aprendizado (Cortex)
- Suporte a Excel e CSV de qualquer formato

</td>
<td width="50%">

**🔐 Multi-tenant com RBAC**
- Isolamento total de dados por contrato
- 3 roles: `user`, `admin`, `superadmin`
- JWT + recovery key para reset sem admin

</td>
</tr>
</table>

---

## Qualidade de Código

```
         ┌──────────────────────────────────────┐
         │  E2E — 74 testes · Playwright        │  Browser real contra produção
         ├──────────────────────────────────────┤
         │  Integração — 400+ testes            │  FastAPI TestClient + storage real
         ├──────────────────────────────────────┤
         │  Unitários — 1000+ testes            │  pytest + mocks + Hypothesis (PBT)
         └──────────────────────────────────────┘
              1488 testes · 99% coverage · 0 falhas · ~40s de execução
```

| Métrica | Valor |
|---|---|
| Testes passando | **1488** |
| Cobertura de código | **99%** |
| Testes E2E (Playwright) | **74** |
| Bugs de produção encontrados pelos testes | **7** |
| Tempo de execução da suíte | **~40 segundos** |

---

## Arquitetura

```
Internet (HTTPS 443)
    │
    ▼
Nginx — SSL/TLS (Let's Encrypt)
    ├── /          → React SPA  (/var/www/html)
    └── /api/      → FastAPI :8000 (systemd · uvicorn)
                          │
                    AWS S3 Bucket
                    ├── {contract_id}/config.json
                    ├── {contract_id}/Mapa.csv
                    ├── {contract_id}/Entregas.csv
                    └── refinery/cortex_db.json
```

**Decisões notáveis:**
- Zero banco de dados relacional — dados em CSV no S3, auth em JSON
- Storage abstraction layer — mesmo código funciona com S3 (prod) ou filesystem (dev)
- Sem Docker — backend direto no host via systemd (menor overhead em t3.micro)
- Multi-tenant via prefixo S3 — cada contrato tem namespace isolado

---

## Stack

**Backend:** `Python 3.12` `FastAPI` `pytest` `Hypothesis` `Playwright` `boto3` `pandas` `python-jose` `passlib` `fsspec`

**Frontend:** `React 19` `Vite` `UnoCSS` `Axios`

**Infra:** `AWS EC2` `AWS S3` `Nginx` `Let's Encrypt` `systemd` `GitHub Actions`

---

## Como Rodar Localmente

```bash
git clone https://github.com/alantaru/SupplyV2.git
cd SupplyV2

# Backend
cd backend
pip install -r requirements.txt
# Criar .env com STORAGE_TYPE=LOCAL
uvicorn backend.main:app --reload --port 8000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

Acesse: `http://localhost:5173`

---

<div align="center">

**Isaac Oliveira** — Transformando operações reais em software de qualidade

[![LinkedIn](https://img.shields.io/badge/Conectar_no_LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/isaac-oliveira-a0924441)

</div>
