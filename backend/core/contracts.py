import json
import shutil
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel
try:
    from .. import config
    from .. import database
except (ImportError, ValueError):
    try:
        import config
        import database
    except (ImportError, ValueError):
        # Fallback if needed
        pass

class ContractMetadata(BaseModel):
    id: str
    name: str
    description: str
    created_at: str
    status: str = "active"
    admin_id: str = "admin2" # Default to superadmin for generic fallback

# Internal System Headers (The "Truth")
REQUIRED_HEADERS = {
    # Legacy / Fixed Files
    "ENTREGAS": [
        "Protocolo", "Serie", "Modelo", "Fila", "Solicitacao", "Status", "Empresa", 
        "PlantaInstalada", "Cidade", "Contrato", "Horario", "ContatoSetor", 
        "LocalInstalacao", "RuaRef", "Area", "ContadorInicial", "ContadorFinal", 
        "Producao", "ProducaoResmas", "A4", "TonerPreto", "TonerCiano", 
        "TonerAmarelo", "TonerMagenta", "Data", "DataEntrega", "Solicitante", 
        "Ramal", "Obs", "IncidenteRds", "Emprestimo", "EmprestadoDoContrato", 
        "AnaliseFV", "Recolha", "ComDefeito", "StatusEmprestimo", "Outros", 
        "RecebidoPor", "Funcionario", "A3", "Cancelado", "A4Entregue", 
        "Competencia", "Almoxarifado",
        "PorcentagemBK", "PorcentagemCY", "PorcentagemMG", "PorcentagemYW",
        "IP", "StatusEquipamento", "Marca", "UF", "CentroCusto", "Gerencia"
    ],
    "ESTOQUE": [
        "TipoModelo", "EstoqueAtual", "UltimaAlteracao", "Cor", "Empresa",
        "Codigo", "Categoria", "ModeloEquipamento", "TipoToner"
    ],
    "ESTOQUE_LANCAMENTOS": [
        "TipoMaterial", "Modelo", "TipoLancamento", "Quantidade", "ProtocoloOUPedido",
        "FilaImpressao", "Colaborador", "DataLancamento", "Empresa", "Obs"
    ],
    "SOLICITANTES": [
        "Nome", "Ramal", "Obs", "Source", "Equipamentos", "Area", "Local", "Empresa"
    ],
    # Dynamic Files (Uploaded) - STRICTLY REQUIRED
    "PAPEL": ["SERIE"],
    "CONTADORES": ["SERIE", "TOTAL", "DATA"],
    "MAPA": ["SERIE"] 
}

# The System is Universal: All these fields are recognized and used if present.
# Users can provide them (or their aliases).
OPTIONAL_HEADERS = {
    "PAPEL": ["A4RESMA", "MEDIA"],
    "CONTADORES": ["%BK", "%CY", "%Mg", "%Yw"],
    "MAPA": [
        "FILA", "MODELOSIMPRESS", "STATUS", "LOCALINSTALACAO", "RUAREF", 
        "CIDADE", "EMPRESA", "PLANTAINSTALADA", "AREA", "CONTRATO", 
        "HORARIO", "CONTATOSETOR", "RAMAL", "ALMOXARIFADO",
        "MARCA", "CENTRODECUSTO", "GERENCIA"
    ]
}

# Optional fields that directly populate the protocol print.
# If these are not auto-mapped, the system will ask the user to map them manually.
PROTOCOL_ESSENTIAL_OPTIONAL = {
    "MAPA": [
        "FILA", "MODELOSIMPRESS", "EMPRESA", "PLANTAINSTALADA",
        "LOCALINSTALACAO", "RUAREF", "AREA", "HORARIO", "CONTATOSETOR",
        "RAMAL", "CIDADE", "CONTRATO"
    ],
    "CONTADORES": ["%BK", "%CY", "%Mg", "%Yw"],
    "PAPEL": ["A4RESMA", "MEDIA"],
}

# Universal Alias Map: { "Canonical_Upper": ["Alias1", "Alias2", ...] }
COLUMN_ALIASES = {
    "SERIE": ["SERIAL", "SÉRIE", "SN", "SERVICETAG", "NUMEROSERIE", "ASSETID"],
    "FILA": ["QUEUE", "NOMEFILA", "PRINTQUEUE", "NOME_FILA", "FILA_IMPRESSAO"],
    "MODELOSIMPRESS": ["MODELO", "MODEL", "EQUIPAMENTO", "MACHINE", "DEVICE"],
    "STATUS": ["ESTADO", "SITUACAO", "SITUAÇÃO", "STATUS_DEVICE"],
    "LOCALINSTALACAO": ["LOCAL", "LOCAL INSTALACAO", "LOCAL INSTALAÇÃO", "LOCAL DE INSTALACAO", "LOCAL DE INSTALAÇÃO", "ENDERECO", "ENDEREÇO", "ADDRESS", "LOCATION", "UBICACION"],
    "RUAREF": ["RUA", "RUA REF", "RUA / REF", "RUA/REF", "STREET", "LOGRADOURO", "RUA_REFERENCIA"],
    "CIDADE": ["CITY", "MUNICIPIO", "MUNICÍPIO", "SITE", "LOCALIDADE"],
    "EMPRESA": ["COMPANY", "CLIENTE", "CUSTOMER", "CLIENT"],
    "PLANTAINSTALADA": ["PLANTA", "PLANT", "UNIDADE", "FACILITY"],
    "AREA": ["SETOR", "SECTOR", "DEPARTAMENTO", "DEPTO", "COSTCENTER", "CENTROCUSTO"],
    "CONTRATO": ["CONTRACT", "CONTRATONUM", "NUMEROCONTRATO"],
    "HORARIO": ["HORÁRIO", "TURNO", "SHIFT", "HORA"],
    "CONTATOSETOR": ["CONTATO", "CONTACT", "RESPONSAVEL", "RESPONSÁVEL"],
    "RAMAL": ["EXTENSION", "TEL", "TELEFONE", "PHONE"],
    "ALMOXARIFADO": ["WAREHOUSE", "ALMOX", "ESTOQUE_LOCAL"],
    
    # Counters
    "TOTAL": ["CONTADOR", "COUNTER", "TOTALCOUNTER", "CONTADOR_TOTAL", "E&C COUNTER TOTAL", "CONTADOR TOTAL"],
    "DATA": ["DATE", "LEITURA", "DATA_LEITURA", "TIMESTAMP"],
    "%BK": ["TONERBLACK", "BLACK", "PRETO", "TONER_BK", "TONER BLACK", "BK"],
    "%CY": ["TONERCYAN", "CYAN", "CIANO", "TONER_CY", "TONER CYAN", "CY"],
    "%Mg": ["TONERMAGENTA", "MAGENTA", "TONER_MG", "TONER MAGENTA", "MG"],
    "%Yw": ["TONERYELLOW", "YELLOW", "AMARELO", "TONER_YW", "TONER YELLOW", "YW"],
    
    # Paper
    "A4RESMA": ["RESMA", "METARESMA", "TARGETREAMS", "META_PAPEL"],
    "MEDIA": ["AVG", "MEDIAMENSAL", "MONTHLYAVG", "MEDIA_PAGINAS"]
}

class ContractsManager:
    def __init__(self, contracts_dir: Path = None):
        self.base_dir = contracts_dir or config.CONTRACTS_DIR
        # Do NOT create local directory — storage backend handles persistence

    def _get_contract_dir(self, contract_id: str) -> Path:
        return self.base_dir / contract_id

    def list_contracts(self) -> List[Dict[str, Any]]:
        import fsspec
        storage = database.get_storage()
        contracts = {}

        # Prefixes reservados pelo sistema — nunca são contratos
        SYSTEM_PREFIXES = {"refinery", "temp", "backups", "logs", "uploads"}

        # Primary: enumerate via storage.list_prefixes()
        try:
            prefixes = storage.list_prefixes()
            for prefix in prefixes:
                # Ignorar prefixes reservados do sistema
                if prefix.lower() in SYSTEM_PREFIXES:
                    continue

                key = f"{prefix}/config.json"
                if storage.exists(key):
                    try:
                        with fsspec.open(storage.get_uri(key), "r", encoding="utf-8") as f:
                            data = json.load(f)
                            contracts[data["id"]] = data
                    except Exception:
                        contracts[prefix] = {
                            "id": prefix, "name": prefix,
                            "description": "Legacy Contract",
                            "created_at": "", "status": "active", "admin_id": "admin2"
                        }
                else:
                    # Legacy contract without config.json — check if it has any data files
                    files = storage.list_files(prefix)
                    if files:  # Only show if it has actual files
                        contracts[prefix] = {
                            "id": prefix, "name": prefix,
                            "description": "Legacy Contract",
                            "created_at": "", "status": "active", "admin_id": "admin2"
                        }
                    # If no files, the prefix is empty/deleted — skip it
        except Exception:
            pass

        # Fallback: also scan local filesystem for any contracts not yet in storage
        if self.base_dir.exists():
            for d in self.base_dir.iterdir():
                if d.is_dir() and d.name not in contracts:
                    cfg_path = d / "config.json"
                    if cfg_path.exists():
                        try:
                            with open(cfg_path, "r", encoding="utf-8") as f:
                                data = json.load(f)
                                contracts[data["id"]] = data
                        except Exception:
                            contracts[d.name] = {
                                "id": d.name, "name": d.name,
                                "description": "Legacy Contract",
                                "created_at": "", "status": "active", "admin_id": "admin2"
                            }
                    else:
                        contracts[d.name] = {
                            "id": d.name, "name": d.name,
                            "description": "Legacy Contract",
                            "created_at": "", "status": "active", "admin_id": "admin2"
                        }

        return sorted(contracts.values(), key=lambda x: x['id'])

    def get_contract(self, contract_id: str) -> Optional[Dict[str, Any]]:
        import fsspec
        storage = database.get_storage()
        key = database.get_config_key(contract_id)

        # Primary: read from storage
        if storage.exists(key):
            try:
                with fsspec.open(storage.get_uri(key), "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        # Fallback: read from local filesystem (legacy contracts)
        path = self._get_contract_dir(contract_id) / "config.json"
        if path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        return None

    def create_contract(self, contract_id: str, name: str, description: str, admin_id: str = "admin2") -> Dict[str, Any]:
        import fsspec
        storage = database.get_storage()
        key = database.get_config_key(contract_id)

        if storage.exists(key) or self._get_contract_dir(contract_id).exists():
            raise ValueError("Contract ID already exists")

        meta = ContractMetadata(
            id=contract_id,
            name=name,
            description=description,
            created_at=datetime.now().isoformat(),
            admin_id=admin_id
        )

        # Save metadata to storage
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), "w", encoding="utf-8") as f:
            json.dump(meta.model_dump(), f, indent=4)

        # Initialize Files
        self.initialize_files(contract_id)

        return meta.model_dump()

    def update_contract(self, contract_id: str, data: dict) -> Dict[str, Any]:
        import fsspec
        storage = database.get_storage()
        key = database.get_config_key(contract_id)

        current_data = self.get_contract(contract_id)
        if current_data is None:
            raise ValueError("Contract not found")

        # Update allowed fields
        for field in ["name", "description", "status"]:
            if field in data:
                current_data[field] = data[field]

        # Write back to storage
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), "w", encoding="utf-8") as f:
            json.dump(current_data, f, indent=4)

        return current_data

    def delete_contract(self, contract_id: str):
        storage = database.get_storage()
        target_dir = self._get_contract_dir(contract_id)

        config_key = database.get_config_key(contract_id)
        if not storage.exists(config_key) and not target_dir.exists():
            # Check if any files exist under this prefix (legacy contract)
            files = storage.list_files(contract_id)
            if not files:
                raise ValueError("Contract not found")

        # Remove all objects from storage with this contract prefix (recursive)
        try:
            storage.delete_prefix(contract_id)
        except Exception:
            pass

        # Also clean local directory if it exists (legacy)
        if target_dir.exists():
            shutil.rmtree(target_dir)

    def initialize_files(self, contract_id: str):
        """Creates empty CSVs with correct headers if they don't exist"""
        storage = database.get_storage()

        # 1. Entregas.csv
        self._init_csv(database.get_data_key("ENTREGAS", contract_id), REQUIRED_HEADERS["ENTREGAS"], storage)

        # 2. Estoque.csv
        self._init_csv(database.get_data_key("ESTOQUE", contract_id), REQUIRED_HEADERS["ESTOQUE"], storage)

        # 3. EstoqueLancamentos.csv
        self._init_csv(database.get_data_key("ESTOQUE_LANCAMENTOS", contract_id), REQUIRED_HEADERS["ESTOQUE_LANCAMENTOS"], storage)

        # 4. Solicitantes.csv
        self._init_csv(database.get_data_key("SOLICITANTES", contract_id), REQUIRED_HEADERS["SOLICITANTES"], storage)

    def _init_csv(self, key: str, columns: List[str], storage=None):
        if storage is None:
            storage = database.get_storage()
        if not storage.exists(key):
            df = pd.DataFrame(columns=columns)
            storage.ensure_dir(key)
            database.save_dataframe_csv(df, storage.get_uri(key))

    # --- MAPPING LOGIC ---

    def _get_mappings_key(self, contract_id: str) -> str:
        """Storage key for the mappings JSON file."""
        return f"{contract_id}/mappings.json"

    def get_mappings(self, contract_id: str) -> Dict[str, Dict[str, str]]:
        """Returns {"PAPEL": {"SERIE": "SerialNum", ...}, ...}
        
        Reads from storage (S3 or local) first; falls back to local filesystem
        for backwards compatibility with contracts created before S3 migration.
        """
        import fsspec
        try:
            storage = database.get_storage()
            key = self._get_mappings_key(contract_id)
            if storage.exists(key):
                uri = storage.get_uri(key)
                with fsspec.open(uri, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception:
            pass

        # Fallback: local filesystem (legacy)
        path = self._get_contract_dir(contract_id) / "mappings.json"
        if not path.exists():
            return {}
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}

    def save_mapping(self, contract_id: str, file_key: str, mapping: Dict[str, str]):
        """Updates mapping for a specific file key.
        
        Saves to storage (S3 or local) so it's consistent with where CSV data lives.
        Also writes to local filesystem as a fallback/cache.
        """
        import fsspec
        full_map = self.get_mappings(contract_id)
        full_map[file_key.upper()] = mapping

        # Primary: save to storage (S3 or local storage backend)
        try:
            storage = database.get_storage()
            key = self._get_mappings_key(contract_id)
            storage.ensure_dir(key)
            uri = storage.get_uri(key)
            with fsspec.open(uri, "w", encoding="utf-8") as f:
                json.dump(full_map, f, indent=4, ensure_ascii=False)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Failed to save mappings to storage for {contract_id}: {e}")

        # Secondary: also write to local filesystem for backwards compatibility
        try:
            path = self._get_contract_dir(contract_id) / "mappings.json"
            if path.parent.exists():
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(full_map, f, indent=4, ensure_ascii=False)
        except Exception:
            pass

    def get_required_columns(self, file_key: str) -> List[str]:
        return REQUIRED_HEADERS.get(file_key.upper(), [])

    def get_optional_columns(self, file_key: str) -> List[str]:
        return OPTIONAL_HEADERS.get(file_key.upper(), [])

    def get_essential_optional_columns(self, file_key: str) -> List[str]:
        """Returns optional columns that are essential for protocol printing.
        These will trigger a mapping review if not auto-mapped."""
        return PROTOCOL_ESSENTIAL_OPTIONAL.get(file_key.upper(), [])

    def get_current_file_headers(self, contract_id: str, file_key: str) -> List[str]:
        """Reads the actual headers from the uploaded file (if exists) using robust loader.
        
        Tries to read raw headers from the auxiliary JSON file first (preserved at upload time).
        Falls back to reading the normalized CSV if the raw headers file does not exist.
        """
        import fsspec

        # --- Primary path: read raw headers from auxiliary JSON ---
        try:
            raw_key = database.get_raw_headers_key(file_key, contract_id)
            storage = database.get_storage()
            if storage.exists(raw_key):
                raw_uri = storage.get_uri(raw_key)
                with fsspec.open(raw_uri, 'r', encoding='utf-8') as f:
                    return json.load(f)
        except Exception:
            pass  # Fall through to the legacy fallback below

        # --- Fallback: read headers from the normalized CSV (legacy behaviour) ---
        key = database.get_data_key(file_key.upper(), contract_id)
        if not database.get_storage().exists(key):
            return []
        
        path = database.get_storage().get_uri(key)
        
        try:
            # Use database.repair_and_load_csv which is now robust
            df = database.repair_and_load_csv(path, encoding='utf-8-sig')
            
            # Clean column names (strip whitespace)
            df.columns = [str(c).strip() for c in df.columns]
            
            return list(df.columns)
        except Exception:
            return []
