# BI Logic

O engine de Business Intelligence (`BIService`) consolida dados de todos os subsistemas para gerar dashboards executivos e preditivos.

## Pipeline de Dados (Consolidação)
O `BIService` realiza o carregamento e normalização de 6 fontes de dados simultaneamente:
1.  **Entregas**: Volume, SLA, cancelamentos.
2.  **Mapa**: Frota total, status, modelos.
3.  **Contadores**: Níveis de toner (Color vs Mono), produção.
4.  **Papel**: Consumo de resmas A4/A3.
5.  **Estoque**: Saldo atual por categoria.
6.  **Lançamentos**: Histórico de entradas e saídas.

## Métricas Chave
- **SLA Compliance**: Porcentagem de entregas realizadas dentro de `SLA_WINDOW` (padrão: 3 dias).
- **Correlation Analytics**: Relação entre consumo de papel (`A4`) e produção de contadores, permitindo identificar desperdícios ou falhas de leitura.
- **Toner Mix**: Distribuição de equipamentos Coloridos vs Monocromáticos baseada em leituras reais.

## Engine Preditivo (Alertas)
- **Toner Alerts**: Identifica equipamentos com nível de toner abaixo de `TONER_ALERT_THRESHOLD` (padrão: 20%).
- **Last Delivery Sync**: Cruza o status atual do toner com a data da última entrega registrada para evitar duplicidade de chamados.

## Referências
- Código: `backend/core/services/bi.py`.
- Frontend: `BIDashboard.jsx`, `Analytics/tabs/`.
