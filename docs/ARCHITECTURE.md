# Arquitetura — Supply 2026

## Visão Geral

Supply 2026 é uma aplicação web SaaS multi-tenant para gestão de insumos de impressão corporativa. A arquitetura prioriza **simplicidade operacional** e **custo mínimo** sem sacrificar qualidade ou escalabilidade.

## Decisões Arquiteturais

### 1. Zero Banco de Dados Relacional

**Decisão:** Dados armazenados em CSV no S3, autenticação em JSON.

**Justificativa:**
- Contratos de impressão têm dados estruturados mas volume baixo (< 10k registros por contrato)
- CSV é o formato nativo dos sistemas de gestão de impressão (Simpress, Xerox, etc.)
- Elimina custo e complexidade de RDS/PostgreSQL
- Backup automático via versionamento S3

**Trade-offs:**
- Sem transações ACID (mitigado com DB_LOCK threading)
- Queries complexas são mais lentas (mitigado com pandas)

### 2. Storage Abstraction Layer

```python
class StorageBackend(ABC):
    def exists(self, key: str) -> bool: ...
    def get_uri(self, key: str) -> str: ...
    def list_files(self, prefix: str) -> List[str]: ...
    def delete(self, key: str): ...
    def copy(self, source: str, dest: str): ...
```

**Implementações:**
- `S3Storage` — produção (AWS S3)
- `LocalStorage` — desenvolvimento (filesystem)

**Benefício:** Mesmo código funciona em dev e produção. Testes rodam sem AWS.

### 3. Multi-tenant via Prefixo S3

```
s3://bucket/
├── 6070IPA/          ← Contrato Usiminas Ipatinga
│   ├── config.json
│   ├── Mapa.csv
│   ├── Entregas.csv
│   └── backups/
├── 6070CUB/          ← Contrato Usiminas Cubatão
│   └── ...
└── refinery/         ← Sistema (Cortex DB)
    └── cortex_db.json
```

**Isolamento:** Cada contrato tem seu próprio namespace. Usuários só acessam contratos associados ao seu perfil.

### 4. Refinery Pipeline

```
CSV/Excel Input
      │
      ▼
┌─────────────┐
│  Ingestor   │  Detecção de encoding, delimitador, header row
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Mapper    │  Mapeamento de colunas (Cortex → Fuzzy → Manual)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Normalizer  │  Normalização de valores, tipos, datas
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Validator  │  Validação de campos obrigatórios
└──────┬──────┘
       │
       ▼
   CSV no S3
```

**Cortex (Memória de Aprendizado):**
- Persiste mapeamentos aprendidos em `refinery/cortex_db.json`
- Próximo upload do mesmo tipo de arquivo usa mapeamento salvo automaticamente
- Usuário pode corrigir e o sistema aprende

### 5. SmartStock — Baixa Automática

```python
def deliver(self, protocol_id: int, data: dict):
    # 1. Marcar protocolo como entregue
    # 2. Coletar itens do protocolo (A4, A3, toners)
    # 3. Para cada item com qty > 0:
    #    - Buscar no estoque por categoria + modelo
    #    - Decrementar saldo
    #    - Criar lançamento de saída
    #    - Se item não existe: criar com saldo negativo
```

**Busca inteligente de toner:**
- Busca por `Categoria=toner AND TipoToner=BK AND ModeloEquipamento=ZT421`
- Fallback por nome exato: `BK ZT421`
- Fallback: cria item automaticamente

## Fluxo de Dados

### Criação de Protocolo

```
Frontend (Wizard)
    │ POST /api/data/entregas
    ▼
ProtocolService.create()
    │ Busca dados do equipamento no MAPA
    │ Enriquece com dados de contadores (snapshot de toner)
    │ Gera ID incremental
    ▼
Entregas.csv no S3
    │
    ▼
SolicitantesService._add_or_update_ramal()
    │ Registra solicitante para autocomplete futuro
    ▼
Solicitantes.csv no S3
```

### Entrega de Protocolo

```
Frontend
    │ POST /api/data/entregas/{id}/deliver
    ▼
ProtocolService.deliver()
    │ Atualiza DataEntrega e Status no Entregas.csv
    │ Coleta itens do protocolo (A4, toners)
    ▼
StockService._resolve_stock_item() [para cada item]
    │ Busca item no Estoque.csv
    │ Decrementa saldo
    │ Cria lançamento em EstoqueLancamentos.csv
    ▼
S3 (Estoque.csv + EstoqueLancamentos.csv atualizados)
```

## Segurança

### Autenticação
- JWT com PBKDF2 (sem bcrypt para evitar conflitos de versão)
- Token expira em 24h (configurável)
- Recovery key para reset sem admin

### Autorização (RBAC)
```
superadmin → acesso total
admin      → gestão de contratos e usuários do seu escopo
user       → acesso apenas aos contratos associados
```

### Isolamento de Dados
- `get_authorized_session()` valida que o usuário tem acesso ao contrato ativo
- Todos os endpoints de dados usam `session.contract_id` (não parâmetro da URL)
- Impossível acessar dados de outro contrato sem permissão explícita

## Performance

### Otimizações Implementadas
- `pandas` para processamento de CSV em memória (evita N queries)
- `DB_LOCK` threading para operações de escrita concorrentes
- Paginação em todos os endpoints de listagem
- Lazy loading de dados no frontend

### Limitações Conhecidas
- CSVs grandes (> 100k linhas) podem ser lentos para carregar
- Sem cache de leitura (cada request lê do S3)
- Sem WebSockets (polling manual no frontend)

## Monitoramento

```bash
# Status do serviço
sudo systemctl status supply-api

# Logs em tempo real
sudo journalctl -u supply-api -f

# Health check
curl https://your-domain.com/api/health
```
