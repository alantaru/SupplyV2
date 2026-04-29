<div align="center">

# 🖨️ Supply 2026

### Sistema Completo de Gestão de Insumos de Impressão Corporativa

[![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![AWS](https://img.shields.io/badge/AWS-S3%20%2B%20EC2-FF9900?style=for-the-badge&logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![Tests](https://img.shields.io/badge/Tests-1488%20passing-4CAF50?style=for-the-badge&logo=pytest&logoColor=white)](backend/tests/)
[![Coverage](https://img.shields.io/badge/Coverage-99%25-4CAF50?style=for-the-badge)](backend/.coveragerc)
[![E2E](https://img.shields.io/badge/E2E-74%20tests-2196F3?style=for-the-badge&logo=playwright&logoColor=white)](backend/tests/e2e/)

**👤 [LinkedIn](https://www.linkedin.com/in/isaac-oliveira-a0924441) · 📧 [isaac_oliveira@live.com](mailto:isaac_oliveira@live.com)**

</div>

---

## 👨‍💻 Sobre o Autor

**Isaac Oliveira** — Líder de Serviços II na Simpress | Bacharel em Análise de Sistemas | Pós-graduando em IA e Gestão de TI

> Profissional com 9+ anos na Simpress (Grupo Usiminas), liderando equipes de serviços de impressão corporativa. Este projeto nasceu da necessidade real de automatizar e digitalizar processos que antes eram feitos manualmente em planilhas Excel — transformando operações do dia a dia em um sistema web completo, escalável e com testes automatizados de nível enterprise.

**Competências demonstradas neste projeto:**
`Python` `FastAPI` `React` `AWS S3/EC2` `PostgreSQL-free Architecture` `CI/CD` `TDD` `E2E Testing` `REST API Design` `Multi-tenant SaaS` `Data Engineering` `BI/Analytics`

---

## 🎯 O Problema Real que Este Projeto Resolve

Na gestão de contratos de impressão corporativa (como os do Grupo Usiminas), os líderes de serviço enfrentam diariamente:

- ❌ Controle de estoque em planilhas Excel desatualizadas
- ❌ Protocolos de entrega registrados em papel ou e-mail
- ❌ Sem visibilidade de SLA em tempo real
- ❌ Importação manual de dados de equipamentos (CSVs com formatos inconsistentes)
- ❌ Relatórios gerenciais feitos manualmente toda semana

**Supply 2026 resolve tudo isso** com uma plataforma web completa, acessível de qualquer dispositivo, com dados em tempo real e relatórios automáticos.

---

## 🚀 Funcionalidades Principais

<table>
<tr>
<td width="50%">

### 📋 Gestão de Protocolos
- Wizard de 3 etapas para solicitar insumos
- Enriquecimento automático com dados do equipamento
- Snapshot de toner no momento da criação
- Histórico completo com filtros avançados
- Exportação CSV para relatórios

</td>
<td width="50%">

### 📦 Estoque Inteligente (SmartStock)
- **Baixa automática** ao registrar entrega
- Busca inteligente por categoria + modelo
- Criação automática de item quando não existe
- Alertas de nível crítico
- Histórico de movimentações com auditoria

</td>
</tr>
<tr>
<td width="50%">

### 🗺️ Rotas Logísticas
- Agrupamento de entregas por localização
- Análise de estoque estimado por equipamento
- **Geração de protocolos em lote** (1 clique)
- Planejamento com status de ciclo
- Integração com dados de contadores

</td>
<td width="50%">

### 📊 BI Dashboard Executivo
- 6 painéis analíticos em tempo real
- Métricas de SLA, entrega, supply e operacional
- Filtros por período com recálculo dinâmico
- Alertas preditivos de toner e papel
- Exportação de relatórios

</td>
</tr>
<tr>
<td width="50%">

### 🔬 Refinery Universal (Importação)
- Detecção automática de encoding (UTF-8, CP1252, Latin1, UTF-16)
- **Mapeamento inteligente de colunas** com aprendizado (Cortex)
- Suporte a Excel (.xlsx) e CSV de qualquer formato
- Normalização de mojibake e caracteres especiais
- Modal de mapeamento manual para casos complexos

</td>
<td width="50%">

### 🔐 Multi-tenant com RBAC
- Isolamento total de dados por contrato
- 3 roles: `user`, `admin`, `superadmin`
- Recovery key para reset de senha sem admin
- JWT com expiração configurável
- Auditoria de ações críticas

</td>
</tr>
</table>

---

## 🏗️ Arquitetura Técnica

```
┌─────────────────────────────────────────────────────────┐
│                    Internet (HTTPS)                     │
└─────────────────────┬───────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Nginx (Host)  │
              │  SSL/TLS       │
              └───┬────────┬───┘
                  │        │
         ┌────────▼──┐  ┌──▼──────────────┐
         │ React SPA │  │ FastAPI :8000   │
         │ /var/www  │  │ systemd service │
         └───────────┘  └────────┬────────┘
                                 │
                    ┌────────────▼────────────┐
                    │      AWS S3 Bucket      │
                    │  Dados por contrato/    │
                    │  Cortex DB / Backups    │
                    └─────────────────────────┘
```

**Decisões de arquitetura notáveis:**
- **Zero banco de dados relacional** — dados em CSV no S3, auth em JSON. Simplicidade operacional máxima.
- **Storage abstraction layer** — mesmo código funciona com S3 (produção) ou filesystem local (dev)
- **Sem Docker** — backend direto no host via systemd para menor overhead em t3.micro
- **Multi-tenant via prefixo S3** — cada contrato tem seu próprio namespace isolado

---

## 🧪 Qualidade de Código — Nível Enterprise

Este projeto demonstra práticas de engenharia de software de alto nível:

### Pirâmide de Testes Completa

```
         ┌──────────────────────────┐
         │    E2E — 74 testes       │  Playwright (Python)
         │    Playwright            │  Fluxos completos de usuário
         ├──────────────────────────┤
         │  Integração — 400+       │  FastAPI TestClient
         │  testes                  │  API + Storage real
         ├──────────────────────────┤
         │  Unitários — 1000+       │  pytest + mocks
         │  testes                  │  Lógica isolada
         └──────────────────────────┘
         Total: 1488 testes | 99% coverage | 0 falhas
```

### Métricas de Qualidade

| Métrica | Valor |
|---------|-------|
| Testes passando | **1488** |
| Coverage total | **99%** |
| Falhas intermitentes | **0** |
| Testes E2E | **74** |
| Bugs de produção corrigidos durante testes | **7** |
| Tempo de execução da suíte | **~40 segundos** |

### Tipos de Testes Implementados

- **Unitários** — cada service, helper e utilitário isolado com mocks
- **Integração** — fluxos completos via API com storage real
- **E2E** — Playwright controlando browser real contra produção
- **Property-Based Testing** — Hypothesis para invariantes matemáticas (ex: `saldo_depois == saldo_antes - qty`)
- **Smoke Tests** — execução em < 2 min para CI/CD em todo push

---

## 🛠️ Stack Tecnológica Detalhada

### Backend
| Tecnologia | Uso |
|-----------|-----|
| **Python 3.12** | Linguagem principal |
| **FastAPI** | Framework REST API assíncrono |
| **pytest + Hypothesis** | Testes unitários, integração e PBT |
| **Playwright** | Testes E2E automatizados |
| **boto3** | Integração AWS S3 |
| **pandas** | Processamento de dados CSV |
| **python-jose** | JWT authentication |
| **passlib (PBKDF2)** | Hash de senhas |
| **fsspec** | Abstração de filesystem (local/S3) |

### Frontend
| Tecnologia | Uso |
|-----------|-----|
| **React 19** | UI framework |
| **Vite** | Build tool |
| **UnoCSS** | Utility-first CSS |
| **Axios** | HTTP client |

### Infraestrutura
| Tecnologia | Uso |
|-----------|-----|
| **AWS EC2** | Servidor de aplicação |
| **AWS S3** | Storage de dados |
| **Nginx** | Reverse proxy + SSL termination |
| **Let's Encrypt** | Certificado SSL gratuito |
| **systemd** | Process manager |
| **GitHub Actions** | CI/CD pipeline |

---

## 📁 Estrutura do Projeto

```
Supply_2026/
├── backend/
│   ├── core/
│   │   ├── refinery/          # Pipeline de importação universal
│   │   │   ├── ingestor.py    # Detecção de encoding + parsing
│   │   │   ├── mapper.py      # Mapeamento inteligente (fuzzy + Cortex)
│   │   │   ├── normalizer.py  # Normalização pós-mapeamento
│   │   │   └── cortex.py      # Memória de aprendizado (S3)
│   │   ├── services/          # Lógica de negócio
│   │   │   ├── bi.py          # Analytics engine (550 linhas)
│   │   │   ├── protocol.py    # Protocolos de entrega
│   │   │   ├── route.py       # Rotas logísticas
│   │   │   └── stock.py       # Estoque inteligente
│   │   └── storage/           # Abstração S3/Local
│   ├── tests/
│   │   ├── (75+ arquivos)     # 1488 testes
│   │   └── e2e/               # 74 testes Playwright
│   └── main.py                # FastAPI app
├── frontend/
│   └── src/                   # React 19 SPA
├── .github/
│   └── workflows/
│       └── e2e.yml            # CI/CD pipeline
└── README.md
```

---

## 🚀 Como Rodar Localmente

```bash
# Clone o repositório
git clone https://github.com/alantaru/SupplyV2.git
cd SupplyV2

# Backend
cd backend
pip install -r requirements.txt
# Configurar .env com STORAGE_TYPE=LOCAL
uvicorn backend.main:app --reload --port 8000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

**Acesse:** `http://localhost:5173`

---

## 📈 Impacto Real

Este sistema foi desenvolvido com base na experiência real de gestão de contratos de impressão corporativa no Grupo Usiminas (Siderurgia), onde:

- **Antes:** Controle manual em planilhas, protocolos em papel, relatórios semanais manuais
- **Depois:** Sistema web completo, dados em tempo real, relatórios automáticos, SLA monitorado continuamente

---

## 📬 Contato

<div align="center">

**Isaac Oliveira**
*Líder de Serviços II | Desenvolvedor Fullstack | Analista de Sistemas*

[![LinkedIn](https://img.shields.io/badge/LinkedIn-isaac--oliveira-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/isaac-oliveira-a0924441)
[![Email](https://img.shields.io/badge/Email-isaac__oliveira@live.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:isaac_oliveira@live.com)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-%2B55%2031%209%209367--6391-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/5531993676391)

📍 Ipatinga, Minas Gerais, Brasil

</div>

---

<div align="center">

*Desenvolvido com ❤️ por Isaac Oliveira — Transformando operações reais em software de qualidade*

</div>
