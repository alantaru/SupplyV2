"""
SolicitantesService — gerencia Solicitantes.csv com schema estendido.

Schema: Nome;Ramal;Obs;Source;Equipamentos;Local;Empresa
  - Equipamentos: lista de "SERIE|FILA" separados por vírgula. Ex: "1234|URIPA0001,5678|URIPA0002"
  - Source: "manual" | "mapa" | "mapa_associado"
"""
import pandas as pd
from typing import List, Dict, Any, Optional

try:
    from .. import database, adapters
except (ImportError, ValueError):
    import database
    try:
        from core import adapters
    except ImportError:
        adapters = None


COLUMNS = ["Nome", "Ramal", "Obs", "Source", "Equipamentos", "Area", "Local", "Empresa"]
PROTECTED_SOURCES = ("manual", "mapa_associado")

# Separador de equipamentos dentro do campo Equipamentos
EQUIP_SEP = ","
# Separador de serie|fila dentro de cada equipamento
PAIR_SEP = "|"


def _parse_equipamentos(raw: str) -> List[Dict[str, str]]:
    """Converte string 'SERIE|FILA,SERIE2|FILA2' em lista de dicts."""
    if not raw or not str(raw).strip():
        return []
    result = []
    for item in str(raw).split(EQUIP_SEP):
        item = item.strip()
        if not item:
            continue
        parts = item.split(PAIR_SEP, 1)
        result.append({
            "serie": parts[0].strip(),
            "fila": parts[1].strip() if len(parts) > 1 else ""
        })
    return result


def _serialize_equipamentos(equips: List[Dict[str, str]]) -> str:
    """Converte lista de dicts em string 'SERIE|FILA,SERIE2|FILA2'."""
    parts = []
    seen = set()
    for e in equips:
        serie = str(e.get("serie", "")).strip()
        fila = str(e.get("fila", "")).strip()
        key = serie.lower()
        if serie and key not in seen:
            seen.add(key)
            parts.append(f"{serie}{PAIR_SEP}{fila}" if fila else serie)
    return EQUIP_SEP.join(parts)


class SolicitantesService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    # ─── Internal I/O ────────────────────────────────────────────────────────

    def _load(self) -> pd.DataFrame:
        """Carrega Solicitantes.csv com migração retrocompatível."""
        key = database.get_data_key("SOLICITANTES", self.contract_id)
        storage = database.get_storage()

        if not storage.exists(key):
            return pd.DataFrame(columns=COLUMNS)

        uri = database.get_data_uri("SOLICITANTES", self.contract_id)
        try:
            import fsspec
            with fsspec.open(uri, mode="rt", encoding="utf-8-sig") as f:
                df = pd.read_csv(f, sep=";", dtype=str)
        except Exception:
            return pd.DataFrame(columns=COLUMNS)

        # Migração retrocompatível: renomear SerieAssociada → Equipamentos se necessário
        if "SerieAssociada" in df.columns and "Equipamentos" not in df.columns:
            df["Equipamentos"] = df["SerieAssociada"].fillna("").apply(
                lambda s: f"{s}{PAIR_SEP}" if s else ""
            )
            df = df.drop(columns=["SerieAssociada"])

        # Adicionar colunas faltantes
        for col in COLUMNS:
            if col not in df.columns:
                df[col] = ""

        df["Source"] = df["Source"].replace("", "manual").fillna("manual")
        df = df.fillna("")

        return df[COLUMNS].copy()

    def _save(self, df: pd.DataFrame) -> None:
        uri = database.get_data_uri("SOLICITANTES", self.contract_id)
        database.save_dataframe_csv(df[COLUMNS], uri)

    def _to_record(self, row: pd.Series) -> Dict[str, Any]:
        """Converte linha do DataFrame em dict com Equipamentos como lista."""
        d = row.to_dict()
        d["EquipamentosLista"] = _parse_equipamentos(d.get("Equipamentos", ""))
        d["Solicitante"] = d.get("Nome", "")  # alias para autocomplete
        return d

    # ─── Public API ──────────────────────────────────────────────────────────

    def list_all(self, query: str = "", empresa: str = "", source: str = "") -> List[Dict[str, Any]]:
        df = self._load()

        if query:
            q = query.lower()
            df = df[df["Nome"].str.lower().str.contains(q, na=False)]
        if empresa:
            df = df[df["Empresa"].str.lower() == empresa.lower()]
        if source:
            if source == "manual":
                df = df[df["Source"].isin(["manual", "mapa_associado"])]
            elif source == "mapa":
                df = df[df["Source"] == "mapa"]

        return [self._to_record(row) for _, row in df.iterrows()]

    def create(self, nome: str, ramal: str = "", obs: str = "") -> Dict[str, Any]:
        nome = nome.strip()
        if not nome:
            raise ValueError("Nome é obrigatório.")
        df = self._load()
        if df["Nome"].str.lower().eq(nome.lower()).any():
            raise ValueError(f"Solicitante '{nome}' já existe.")
        new_row = pd.DataFrame([{
            "Nome": nome, "Ramal": str(ramal).strip(), "Obs": str(obs).strip(),
            "Source": "manual", "Equipamentos": "", "Area": "", "Local": "", "Empresa": "",
        }])
        df = pd.concat([df, new_row], ignore_index=True)
        self._save(df)
        return {"status": "created", "nome": nome}

    def update(self, nome: str, ramal: Optional[str] = None, obs: Optional[str] = None, area: Optional[str] = None) -> Dict[str, Any]:
        df = self._load()
        mask = df["Nome"].str.lower() == nome.lower()
        if not mask.any():
            raise KeyError(f"Solicitante '{nome}' não encontrado.")
        if ramal is not None:
            df.loc[mask, "Ramal"] = str(ramal).strip()
        if obs is not None:
            df.loc[mask, "Obs"] = str(obs).strip()
        if area is not None:
            df.loc[mask, "Area"] = str(area).strip()
        self._save(df)
        return {"status": "updated", "nome": nome}

    def delete(self, nome: str) -> Dict[str, Any]:
        df = self._load()
        mask = df["Nome"].str.lower() == nome.lower()
        if not mask.any():
            raise KeyError(f"Solicitante '{nome}' não encontrado.")
        df = df[~mask].reset_index(drop=True)
        self._save(df)
        return {"status": "deleted", "nome": nome}

    def associate(self, nome: str, serie: str, mapa_row: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Adiciona um equipamento à lista do solicitante.
        Se já existe, atualiza a fila. Source → 'mapa_associado'.
        """
        df = self._load()
        mask = df["Nome"].str.lower() == nome.lower()
        if not mask.any():
            raise KeyError(f"Solicitante '{nome}' não encontrado.")

        if mapa_row is None:
            mapa_row = self._find_in_mapa(serie)
            if mapa_row is None:
                raise KeyError(f"Equipamento '{serie}' não encontrado no Mapa.")

        fila = str(mapa_row.get("Fila", "") or "").strip()
        idx = df[mask].index[0]

        # Adicionar equipamento à lista (sem duplicar)
        existing = _parse_equipamentos(df.loc[idx, "Equipamentos"])
        existing_series = {e["serie"].lower() for e in existing}
        if serie.lower() not in existing_series:
            existing.append({"serie": serie, "fila": fila})
        else:
            # Atualiza fila se já existe
            for e in existing:
                if e["serie"].lower() == serie.lower():
                    e["fila"] = fila

        df.loc[idx, "Equipamentos"] = _serialize_equipamentos(existing)
        df.loc[idx, "Source"] = "mapa_associado"
        df.loc[idx, "Ramal"] = str(mapa_row.get("Ramal", "") or "").strip() or df.loc[idx, "Ramal"]
        df.loc[idx, "Area"] = str(mapa_row.get("Area", "") or "").strip() or df.loc[idx, "Area"]
        df.loc[idx, "Local"] = str(mapa_row.get("LocalInstalacao", "") or "").strip() or df.loc[idx, "Local"]
        df.loc[idx, "Empresa"] = str(mapa_row.get("Empresa", "") or "").strip() or df.loc[idx, "Empresa"]

        self._save(df)
        return {"status": "associated", "nome": nome, "serie": serie, "fila": fila}

    def import_from_mapa(self) -> Dict[str, Any]:
        """
        Importação em massa do Mapa.
        Agrupa por ContatoSetor — um registro por pessoa, múltiplos equipamentos.
        Regra crítica: Source='manual' e Source='mapa_associado' NUNCA são sobrescritos.
        """
        df_sol = self._load()
        df_mapa = database.load_mapa(self.contract_id)

        if df_mapa.empty:
            return {"criados": 0, "atualizados": 0, "ignorados": 0}

        try:
            if adapters:
                mapa_records = adapters.normalize_dataframe(df_mapa)
            else:
                mapa_records = df_mapa.to_dict(orient="records")
        except Exception:
            mapa_records = df_mapa.to_dict(orient="records")

        # Agrupar por ContatoSetor (case-insensitive)
        grouped: Dict[str, Dict] = {}  # nome_lower → {nome, ramal, local, empresa, equips[]}
        for row in mapa_records:
            contato = str(row.get("ContatoSetor", "") or "").strip()
            if not contato:
                continue
            key = contato.lower()
            serie = str(row.get("Serie", "") or "").strip()
            fila = str(row.get("Fila", "") or "").strip()
            if key not in grouped:
                grouped[key] = {
                    "nome": contato,
                    "ramal": str(row.get("Ramal", "") or "").strip(),
                    "area": str(row.get("Area", "") or "").strip(),
                    "local": str(row.get("LocalInstalacao", "") or "").strip(),
                    "empresa": str(row.get("Empresa", "") or "").strip(),
                    "equips": [],
                }
            if serie:
                # Evitar duplicatas de série dentro do mesmo contato
                existing_series = {e["serie"].lower() for e in grouped[key]["equips"]}
                if serie.lower() not in existing_series:
                    grouped[key]["equips"].append({"serie": serie, "fila": fila})

        criados = atualizados = ignorados = 0
        new_rows = []

        for key, data in grouped.items():
            mask = df_sol["Nome"].str.lower() == key

            if not mask.any():
                new_rows.append({
                    "Nome": data["nome"],
                    "Ramal": data["ramal"],
                    "Obs": "",
                    "Source": "mapa",
                    "Equipamentos": _serialize_equipamentos(data["equips"]),
                    "Area": data["area"],
                    "Local": data["local"],
                    "Empresa": data["empresa"],
                })
                criados += 1
            else:
                existing_source = str(df_sol.loc[mask, "Source"].iloc[0])
                if existing_source in PROTECTED_SOURCES:
                    ignorados += 1  # NUNCA sobrescreve manuais
                else:
                    # Source == "mapa" → atualiza tudo
                    df_sol.loc[mask, "Ramal"] = data["ramal"]
                    df_sol.loc[mask, "Area"] = data["area"]
                    df_sol.loc[mask, "Local"] = data["local"]
                    df_sol.loc[mask, "Empresa"] = data["empresa"]
                    df_sol.loc[mask, "Equipamentos"] = _serialize_equipamentos(data["equips"])
                    atualizados += 1

        if new_rows:
            df_sol = pd.concat([df_sol, pd.DataFrame(new_rows)], ignore_index=True)

        self._save(df_sol)
        return {"criados": criados, "atualizados": atualizados, "ignorados": ignorados}

    def _add_or_update_ramal(self, nome: str, ramal: str = "") -> None:
        """Uso interno pelo ProtocolService. Cria manual se não existe."""
        if not nome:
            return
        nome = nome.strip()
        ramal = str(ramal).strip() if ramal else ""
        df = self._load()
        mask = df["Nome"].str.lower() == nome.lower()
        if not mask.any():
            new_row = pd.DataFrame([{
                "Nome": nome, "Ramal": ramal, "Obs": "",
                "Source": "manual", "Equipamentos": "", "Area": "", "Local": "", "Empresa": "",
            }])
            df = pd.concat([df, new_row], ignore_index=True)
        else:
            if ramal:
                df.loc[mask, "Ramal"] = ramal
        self._save(df)

    def _find_in_mapa(self, serie: str) -> Optional[Dict]:
        df_mapa = database.load_mapa(self.contract_id)
        if df_mapa.empty:
            return None
        try:
            records = adapters.normalize_dataframe(df_mapa) if adapters else df_mapa.to_dict(orient="records")
        except Exception:
            records = df_mapa.to_dict(orient="records")
        for row in records:
            if str(row.get("Serie", "")).strip().lower() == serie.strip().lower():
                return row
        return None
