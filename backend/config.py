from pathlib import Path
import os

# Base directory of the project (where main.py is run from usually, or explicit path)

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR
CONTRACTS_DIR = BASE_DIR / "contracts"
DEFAULT_CONTRACT = None  # No default contract — all operations require an explicit contract_id
USERS_FILE = BASE_DIR / "users.json"

# Auth Config
SECRET_KEY = os.environ.get("SUPPLY_SECRET_KEY", "supply-2026-secure-local-key-change-me-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 24 hours

FILES = {
    "ENTREGAS": "Entregas.csv",
    "MAPA": "Mapa.csv",
    "PAPEL": "Papel.csv",
    "CONTADORES": "Contadores.csv",
    "ROTAS": "Planejamento_Rotas.xlsx",
    "ESTOQUE": "Estoque.csv",
    "ESTOQUE_LANCAMENTOS": "EstoqueLancamentos.csv",
    "SOLICITANTES": "Solicitantes.csv",
    "MANUTENCAO_CONTROLE": "Manutencao_Controle.csv",
    "MANUTENCAO_OS": "Manutencao_OS.csv",
    "MANUTENCAO_PECAS": "Manutencao_Pecas.csv",
    "MANUTENCAO_ESTOQUE": "Manutencao_Estoque.csv",
    "MANUTENCAO_ESTOQUE_LANCAMENTOS": "Manutencao_Estoque_Lancamentos.csv",
    "MAPA_DIVERGENCIAS": "Mapa_Divergencias.csv",
    "MANUTENCAO_NF": "Notas_Fiscais.csv"
}

# Architectural Constraints (Hardening)
MAX_SERIAL_LENGTH = 14  # Default simpress limitation, but configurable
LOCK_SAFETY_CHECK = True # Enable warning if threading.Lock is used in multi-worker env
