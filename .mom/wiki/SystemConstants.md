# System Constants

Definições globais e caminhos de arquivos do Supply 2026.

## Caminhos e Arquivos
- **DATA_DIR**: Raiz do backend.
- **CONTRACTS_DIR**: `/contracts` (contém subpastas por ID de contrato).
- **Arquivos Core**:
  - `Entregas.csv`: Protocolos de entrega.
  - `Mapa.csv`: Inventário mestre dos equipamentos.
  - `Contadores.csv`: Leituras de toner e papel.
  - `Estoque.csv`: Saldo de suprimentos.
  - `EstoqueLancamentos.csv`: Histórico de movimentações.

## Configurações de Segurança
- **SECRET_KEY**: Carregada via ENV `SUPPLY_SECRET_KEY`.
- **Expiração**: 24 horas (`ACCESS_TOKEN_EXPIRE_MINUTES = 1440`).

## Restrições de Negócio
- **MAX_SERIAL_LENGTH**: 14 caracteres (truncamento automático no [[RefineryLogic]] e [[ProtocolLogic]]).
- **LOCK_SAFETY_CHECK**: Habilitado para garantir integridade em ambientes multi-worker.

## Referências
- Código: `backend/config.py`.
