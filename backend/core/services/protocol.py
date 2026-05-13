import pandas as pd
from typing import Dict, Any, List
from datetime import datetime
try:
    from ... import database
except (ImportError, ValueError):
    import database

try:
    from .equipment import EquipmentService
except (ImportError, ValueError):
    try:
        from core.services.equipment import EquipmentService
    except (ImportError, ValueError):
        # Fallback if needed, but should work with above
        EquipmentService = None

class ProtocolService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    def get_pending(self, limit: int = 50, filters: Dict[str, Any] = None) -> List[Dict[str, Any]]:
        df = database.load_normalized("ENTREGAS", self.contract_id)
        if df.empty:
            return []
        
        filtered = self._apply_filters(df, filters)
        
        if 'Protocolo' in filtered.columns:
            try:
                filtered = filtered.sort_values('Protocolo', ascending=False)
            except Exception:
                pass
            
        result_df = filtered.head(limit).fillna("").copy()
        return result_df.to_dict(orient="records")

    def get_export(self, filters: Dict[str, Any] = None) -> str:
        df = database.load_normalized("ENTREGAS", self.contract_id)
        if df.empty:
            return ""
        
        filtered = self._apply_filters(df, filters)
        
        if 'Protocolo' in filtered.columns:
             try:
                 filtered = filtered.sort_values('Protocolo', ascending=False)
             except Exception:
                 pass

        return filtered.to_csv(sep=';', index=False, encoding='utf-8-sig')

    def _apply_filters(self, df: pd.DataFrame, filters: Dict[str, Any] = None) -> pd.DataFrame:
        if df.empty:
            return df
            
        filtered = df
        status_filter = filters.get('status', 'pending') if filters else 'pending'
            
        if 'DataEntrega' in df.columns:
            data_entrega = df['DataEntrega'].astype(str).str.strip().str.lower().replace('nan', '')
            if status_filter == 'pending':
                filtered = df[data_entrega == '']
            elif status_filter == 'delivered':
                filtered = df[data_entrega != '']

        if filters:
             if filters.get('city'):
                 filtered = filtered[filtered['Cidade'].astype(str) == filters['city']]
             if filters.get('fila'):
                 filtered = filtered[filtered['Fila'].astype(str) == filters['fila']]
             if filters.get('empresa'):
                 filtered = filtered[filtered['Empresa'].astype(str) == filters['empresa']]
             if filters.get('search'):
                 s = str(filters['search']).lower()
                 filtered = filtered[
                     filtered['Protocolo'].astype(str).str.contains(s) |
                     filtered['Serie'].astype(str).str.lower().str.contains(s)
                 ]

             if 'start_date' in filters or 'end_date' in filters:
                 if 'DataEntrega' in filtered.columns:
                     dates = pd.to_datetime(filtered['DataEntrega'], format='%d/%m/%Y', errors='coerce')
                     
                     if filters.get('start_date'):
                        try:
                            start = pd.to_datetime(filters['start_date'], format='%Y-%m-%d')
                            filtered = filtered[dates >= start]
                            dates = dates[filtered.index.isin(dates.index)]
                        except Exception:
                            pass
                     
                     if filters.get('end_date'):
                        try:
                            end = pd.to_datetime(filters['end_date'], format='%Y-%m-%d').replace(hour=23, minute=59, second=59)
                            filtered = filtered[pd.to_datetime(filtered['DataEntrega'], format='%d/%m/%Y', errors='coerce') <= end]
                        except Exception:
                            pass
        return filtered

    def get_by_id(self, protocol_id: int) -> Dict[str, Any]:
        df = database.load_normalized("ENTREGAS", self.contract_id)
        
        if df.empty or 'Protocolo' not in df.columns:
            return {}
        
        df['Protocolo_Num'] = pd.to_numeric(df['Protocolo'], errors='coerce')
        row_match = df[df['Protocolo_Num'] == protocol_id]
        if row_match.empty:
            return {}
        
        protocol = row_match.iloc[0].fillna("").to_dict()
        # Enrich with print details logic (Mapas lookup) omitted for now, can be added
        return protocol

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        df = database.load_normalized("ENTREGAS", self.contract_id)
        
        new_id = 1
        if not df.empty and 'Protocolo' in df.columns:
            current_ids = pd.to_numeric(df['Protocolo'], errors='coerce').fillna(0)
            if not current_ids.empty:
                new_id = int(current_ids.max()) + 1
            
        # Enrich data from MAPA if Serie is present
        mapa_data = {}
        snapshot_toners = {"PorcentagemBK": "", "PorcentagemCY": "", "PorcentagemMG": "", "PorcentagemYW": ""}
        snapshot_mapa = {"IP": "", "StatusEquipamento": "", "Marca": "", "UF": "", "CentroCusto": "", "Gerencia": ""}
        if data.get("serie") and EquipmentService:
            equip_svc = EquipmentService(self.contract_id)
            details = equip_svc.get_details(data.get("serie"))
            if details and "equipment" in details:
                mapa_data = details["equipment"]
                # Helpers
                def get_map_val(k): return mapa_data.get(k, "")
                
                # Check for Toner info in Counters
                details.get("counters", {})
                
                # Enrich incoming data only if missing
                if not data.get("modelo"):
                    data["modelo"] = get_map_val("ModeloSimpress")
                if not data.get("fila"):
                    data["fila"] = get_map_val("Fila")
                if not data.get("empresa"):
                    data["empresa"] = get_map_val("Empresa")
                if not data.get("planta"):
                    data["planta"] = get_map_val("PlantaInstalada")
                if not data.get("cidade"):
                    data["cidade"] = get_map_val("Cidade")
                if not data.get("contrato"):
                    data["contrato"] = get_map_val("Contrato")
                if not data.get("horario"):
                    data["horario"] = get_map_val("Horario") or get_map_val("HORARIO")
                if not data.get("contato"):
                    data["contato"] = get_map_val("ContatoSetor") or get_map_val("Contato")
                if not data.get("endereco"):
                    data["endereco"] = get_map_val("LocalInstalacao")
                if not data.get("rua"):
                    data["rua"] = get_map_val("RuaRef")
                if not data.get("area"):
                    data["area"] = get_map_val("Area")
                if not data.get("ramal"):
                    data["ramal"] = get_map_val("Ramal") # Capitalization check?
                
                # Special Fields
                if not data.get("almoxarifado"):
                    data["almoxarifado"] = get_map_val("Almoxarifado")

                # ── Snapshot: counter data at creation time ──────────────────────────
                counters = details.get("counters", {})

                # ContadorInicial: use counter_total from Contadores only if caller didn't provide one
                if not data.get("counterInitial"):
                    ct = counters.get("counter_total")
                    if ct:
                        data["counterInitial"] = ct

                # Toner percentages snapshot (always from Contadores, immutable after creation)
                snapshot_toners = {
                    "PorcentagemBK": str(counters.get("toner_bk_pct", "") or ""),
                    "PorcentagemCY": str(counters.get("toner_cy_pct", "") or ""),
                    "PorcentagemMG": str(counters.get("toner_mg_pct", "") or ""),
                    "PorcentagemYW": str(counters.get("toner_yw_pct", "") or ""),
                }

                # Additional MAPA fields snapshot
                snapshot_mapa = {
                    "IP":                get_map_val("IP"),
                    "StatusEquipamento": get_map_val("Status"),   # MAPA Status ≠ protocol Status
                    "Marca":             get_map_val("Marca"),
                    "UF":                get_map_val("UF"),
                    "CentroCusto":       get_map_val("CentroCusto"),
                    "Gerencia":          get_map_val("Gerencia"),
                }
                
        # Default Competencia
        current_comp = datetime.now().strftime("%m/%Y")

        # Fixed Internal Headers (The "Truth")
        # We start with the fixed standard row
        new_row = {
            "Protocolo": new_id,
            "Serie": data.get("serie"),
            "Modelo": data.get("modelo"),
            "Fila": data.get("fila"),
            "Solicitacao": data.get("solicitacao", "Telefone"), # Default if missing
            "Status": "Pendente",
            "Empresa": data.get("empresa"),
            "PlantaInstalada": data.get("planta"),
            "Cidade": data.get("cidade"),
            "Contrato": data.get("contrato"),
            "Horario": data.get("horario"),
            "ContatoSetor": data.get("contato"),
            "LocalInstalacao": data.get("endereco"),
            "RuaRef": data.get("rua"),
            "Area": data.get("area"),
            "ContadorInicial": data.get("counterInitial"),
            "ContadorFinal": data.get("counterFinal"),
            "Producao": data.get("production"),
            "ProducaoResmas": data.get("resmas"),
            "A4": data.get("a4") if data.get("a4") is not None else data.get("resmas"), # Support both keys
            "TonerPreto": data.get("toner_bk") if data.get("toner_bk") is not None else data.get("tonerBk"),
            "TonerCiano": data.get("toner_cy") if data.get("toner_cy") is not None else data.get("tonerCy"),
            "TonerAmarelo": data.get("toner_yw") if data.get("toner_yw") is not None else data.get("tonerYw"),
            "TonerMagenta": data.get("toner_mg") if data.get("toner_mg") is not None else data.get("tonerMg"),
            "Data": data.get("date", datetime.now().strftime("%d/%m/%Y")),
            "DataEntrega": "",
            "Solicitante": data.get("solicitante"),
            "Ramal": data.get("ramal") or data.get("telefone"),
            "Obs": data.get("obs"),
            "IncidenteRds": data.get("incidente"),
            "Emprestimo": data.get("emprestimo"),
            "EmprestadoDoContrato": data.get("origem"),
            "AnaliseFV": data.get("analiseFV"),
            "Recolha": data.get("recolha"),
            "ComDefeito": data.get("comDefeito"),
            "StatusEmprestimo": "",
            "Outros": "",
            "RecebidoPor": "",
            "Funcionario": "",
            "A3": data.get("a3", ""),
            "Cancelado": "FALSO",
            "A4Entregue": "FALSO",
            "Competencia": current_comp,
            "Almoxarifado": data.get("almoxarifado", ""),
            # Snapshot fields — written at creation only, never updated
            **snapshot_toners,
            **snapshot_mapa,
        }

        # Dynamic Extras: Integrate any field starting with CUSTOM_ or present in extras_meta
        # Or more simply: capture everything in 'data' that isn't mapped above but is likely a custom field
        KNOWN_FIXED_KEYS = {
            "serie", "modelo", "fila", "solicitacao", "empresa", "planta", "cidade", 
            "contrato", "horario", "contato", "endereco", "rua", "area", "counterInitial", 
            "counterFinal", "production", "resmas", "a4", "toner_bk", "tonerBk", 
            "toner_cy", "tonerCy", "toner_yw", "tonerYw", "toner_mg", "tonerMg", 
            "date", "solicitante", "ramal", "telefone", "obs", "incidente", 
            "emprestimo", "origem", "analiseFV", "recolha", "comDefeito", "a3", 
            "almoxarifado", "protocol", "extras_meta",
            "PorcentagemBK", "PorcentagemCY", "PorcentagemMG", "PorcentagemYW",
            "IP", "StatusEquipamento", "Marca", "UF", "CentroCusto", "Gerencia",
        }

        for key, val in data.items():
            if key not in KNOWN_FIXED_KEYS:
                # This catches CUSTOM_ fields and arbitrary others
                new_row[key] = val
        
        # Save
        # Save
        new_df = pd.DataFrame([new_row])
        if df.empty:
            updated_df = new_df
        else:
            # Ensure dtypes match to avoid warnings
            df = df.astype(object)
            new_df = new_df.astype(object)
            updated_df = pd.concat([df, new_df], ignore_index=True)
        uri = database.get_data_uri("ENTREGAS", self.contract_id)
        database.save_dataframe_csv(updated_df, uri)

        # Register solicitante for future autocomplete
        if data.get("solicitante"):
            try:
                self.add_solicitante(data["solicitante"], data.get("ramal") or data.get("telefone") or "")
            except Exception:
                pass

        return {"protocol_id": new_id, "status": "success"}

    def update(self, protocol_id: int, updates: Dict[str, Any]) -> Dict[str, Any]:
        df = database.load_entregas(self.contract_id)
        
        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        if not df.empty:
            df = pd.DataFrame(adapters.normalize_dataframe(df))

        if df.empty:
            return {"status": "error", "message": "Database empty"}
        
        # Prevent warnings by normalizing types
        df = df.astype(object)
        
        df['Protocolo_Num'] = pd.to_numeric(df['Protocolo'], errors='coerce')
        indices = df.index[df['Protocolo_Num'] == protocol_id].tolist()
        if not indices:
            return {"status": "error", "message": "Protocol not found"}
        idx = indices[0]
        
        # Simple mapping update
        # Simplified: trust caller keys map to columns roughly or use explicit map if strictly needed
        # Using explicit field map for safety (from logic.py)
        field_map = {
             "status": "Status", "solicitante": "Solicitante", "ramal": "Ramal", "obs": "Obs",
             "solicitacao": "Solicitacao", "incidente": "IncidenteRds", "analiseFV": "AnaliseFV",
             "counterInitial": "ContadorInicial", "counterFinal": "ContadorFinal", "production": "Producao",
             "productionReams": "ProducaoResmas",
             "tonerPct": "PorcentagemToner", "outros": "Outros", "recolha": "Recolha", "comDefeito": "ComDefeito",
             "funcionario": "Funcionario", "almoxarifado": "Almoxarifado", "emprestimo": "Emprestimo",
             "origem": "EmprestadoDoContrato", "statusEmprestimo": "StatusEmprestimo",
             "competencia": "Competencia",
             # Toner fields
             "tonerBk": "TonerPreto", "tonerCy": "TonerCiano", "tonerYw": "TonerAmarelo", "tonerMg": "TonerMagenta",
             "toner_bk": "TonerPreto", "toner_cy": "TonerCiano", "toner_yw": "TonerAmarelo", "toner_mg": "TonerMagenta",
             # Paper fields
             "a4": "A4", "a3": "A3",
        }
        for key, val in updates.items():
            if key in field_map:
                df.at[idx, field_map[key]] = val
                
        uri = database.get_data_uri("ENTREGAS", self.contract_id)
        database.save_dataframe_csv(df.drop(columns=['Protocolo_Num']), uri)

        # Register solicitante for future autocomplete
        if updates.get("solicitante"):
            try:
                self.add_solicitante(updates["solicitante"], updates.get("ramal") or "")
            except Exception:
                pass

        return {"status": "success", "id": protocol_id}

    # ─── Mapeamento de campos de toner do protocolo para código BK/CY/MG/YW ───
    _TONER_FIELD_MAP = {
        "TonerPreto":   "BK",
        "TonerCiano":   "CY",
        "TonerAmarelo": "YW",
        "TonerMagenta": "MG",
    }

    def _resolve_stock_item(
        self,
        df_estoque: "pd.DataFrame",
        item_type: str,
        modelo: str,
        qty: int,
        today: str,
        empresa: str,
        protocol_id: int,
        fila: str = "",
        colaborador: str = "System",
    ):
        """
        Resolve e decrementa o item correto no estoque por categoria/modelo.
        Retorna (df_estoque_atualizado, dict_lancamento | None).

        - item_type: "A4", "A3", "TonerPreto", "TonerCiano", "TonerAmarelo", "TonerMagenta"
        - modelo: modelo do equipamento (ex: "SLM4020")
        """
        import logging
        import pandas as pd

        if item_type in ("A4", "A3"):
            nome = "A4 (RESMAS)" if item_type == "A4" else "A3 (RESMAS)"
            categoria = "papel"
            tipo_toner = ""
            modelo_equip = ""
        elif item_type in self._TONER_FIELD_MAP:
            tipo_toner = self._TONER_FIELD_MAP[item_type]
            modelo_equip = str(modelo).strip() if modelo else ""
            if not modelo_equip:
                logging.warning(
                    f"[SmartStock] Toner {item_type} ignorado: modelo do protocolo {protocol_id} está vazio."
                )
                return df_estoque, None
            nome = f"{tipo_toner} {modelo_equip}"
            categoria = "toner"
        else:
            # Tipo desconhecido — fallback por nome
            nome = item_type
            categoria = "customizado"
            tipo_toner = ""
            modelo_equip = ""

        # Garantir colunas novas existem no df_estoque
        for col, default in [("Categoria", "customizado"), ("ModeloEquipamento", ""), ("TipoToner", "")]:
            if col not in df_estoque.columns:
                df_estoque[col] = default

        # Busca inteligente por categoria + tipo_toner + modelo (para toners)
        # ou por nome exato (para papel/customizado)
        if categoria == "toner" and modelo_equip:
            mask = (
                (df_estoque["Categoria"].astype(str).str.lower() == "toner") &
                (df_estoque["TipoToner"].astype(str).str.upper() == tipo_toner) &
                (df_estoque["ModeloEquipamento"].astype(str).str.strip().str.lower() == modelo_equip.lower())
            )
            # Fallback: busca por nome se não encontrou por categoria
            if not mask.any():
                mask = df_estoque["TipoModelo"].astype(str).str.strip().str.lower() == nome.lower()
        else:
            mask = df_estoque["TipoModelo"].astype(str).str.strip().str.lower() == nome.lower()

        if mask.any():
            idx_stk = df_estoque[mask].index[0]
            curr = pd.to_numeric(df_estoque.at[idx_stk, "EstoqueAtual"], errors="coerce")
            if pd.isna(curr):
                curr = 0
            df_estoque.at[idx_stk, "EstoqueAtual"] = curr - qty
            df_estoque.at[idx_stk, "UltimaAlteracao"] = today
        else:
            # Criar automaticamente com EstoqueAtual negativo
            new_row = {
                "TipoModelo": nome,
                "EstoqueAtual": -qty,
                "UltimaAlteracao": today,
                "Cor": "",
                "Empresa": empresa,
                "Codigo": "",
                "Categoria": categoria,
                "ModeloEquipamento": modelo_equip,
                "TipoToner": tipo_toner,
            }
            df_estoque = pd.concat([df_estoque, pd.DataFrame([new_row])], ignore_index=True)

        lancamento = {
            "TipoMaterial": "Consumo",
            "Modelo": nome,
            "TipoLancamento": "Saída",
            "Quantidade": qty,
            "ProtocoloOUPedido": protocol_id,
            "FilaImpressao": fila,
            "Colaborador": colaborador,
            "DataLancamento": today,
            "Empresa": empresa,
            "Obs": f"Entrega Protocolo {protocol_id}",
        }
        return df_estoque, lancamento

    def deliver(self, protocol_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
        """Marca protocolo como entregue e desconta estoque automaticamente."""
        df_entregas = database.load_entregas(self.contract_id)

        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        if not df_entregas.empty:
            df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))

        if df_entregas.empty or "Protocolo" not in df_entregas.columns:
            return {"status": "error", "message": "Protocol not found"}

        df_entregas = df_entregas.astype(object)
        df_entregas["Protocolo_Num"] = pd.to_numeric(df_entregas["Protocolo"], errors="coerce")
        indices = df_entregas.index[df_entregas["Protocolo_Num"] == protocol_id].tolist()

        if not indices:
            return {"status": "error", "message": "Protocol not found"}
        idx = indices[0]

        today = datetime.now().strftime("%d/%m/%Y")
        df_entregas.at[idx, "DataEntrega"] = today
        df_entregas.at[idx, "Status"] = "Entregue"

        for col_name in ["RecebidoPor", "Funcionario"]:
            if col_name not in df_entregas.columns:
                df_entregas[col_name] = ""
            df_entregas[col_name] = df_entregas[col_name].astype(object)

        rec = data.get("RecebidoPor") or data.get("receivedBy", "")
        df_entregas.at[idx, "RecebidoPor"] = rec

        func = data.get("Funcionario") or data.get("user", "")
        if func:
            df_entregas.at[idx, "Funcionario"] = func

        # Campos opcionais editáveis na baixa
        for field_name in ["IncidenteRds", "Almoxarifado"]:
            val = data.get(field_name)
            if val is not None and str(val).strip():
                if field_name not in df_entregas.columns:
                    df_entregas[field_name] = ""
                df_entregas[field_name] = df_entregas[field_name].astype(object)
                df_entregas.at[idx, field_name] = str(val).strip()

        uri_entregas = database.get_data_uri("ENTREGAS", self.contract_id)
        database.save_dataframe_csv(df_entregas.drop(columns=["Protocolo_Num"]), uri_entregas)

        # ── Baixa automática inteligente de estoque ──────────────────────────
        # Obter modelo do protocolo (para associar toners)
        modelo_protocolo = ""
        for col in ("ModeloSimpress", "Modelo"):
            if col in df_entregas.columns:
                val = str(df_entregas.at[idx, col] or "").strip()
                if val:
                    modelo_protocolo = val
                    break

        empresa_protocolo = str(df_entregas.at[idx, "Empresa"] or data.get("empresa", ""))
        fila_protocolo = str(df_entregas.at[idx, "Fila"] or df_entregas.at[idx, "Serie"] or "")

        # Campos do protocolo que geram baixa de estoque
        DELIVERY_FIELDS = {
            "A4":           "A4",
            "A3":           "A3",
            "TonerPreto":   "TonerPreto",
            "TonerCiano":   "TonerCiano",
            "TonerAmarelo": "TonerAmarelo",
            "TonerMagenta": "TonerMagenta",
        }

        # Coletar itens do protocolo com qty > 0
        items_to_process = {}
        for field_key, item_type in DELIVERY_FIELDS.items():
            val = df_entregas.at[idx, field_key] if field_key in df_entregas.columns else 0
            try:
                qty = int(float(val or 0))
            except (ValueError, TypeError):
                qty = 0
            if qty > 0:
                items_to_process[item_type] = qty

        # Também suportar items passados explicitamente via data["Items"]
        for item_key, qty_raw in data.get("Items", {}).items():
            try:
                qty = int(float(qty_raw))
            except (ValueError, TypeError):
                qty = 0
            if qty > 0:
                items_to_process[item_key] = qty

        if items_to_process:
            with database.DB_LOCK:
                df_estoque = database.load_estoque(self.contract_id)
                df_lanc = database.load_estoque_lancamentos(self.contract_id)

                new_lancamentos = []
                for item_type, qty in items_to_process.items():
                    df_estoque, lancamento = self._resolve_stock_item(
                        df_estoque=df_estoque,
                        item_type=item_type,
                        modelo=modelo_protocolo,
                        qty=qty,
                        today=today,
                        empresa=empresa_protocolo,
                        protocol_id=protocol_id,
                        fila=fila_protocolo,
                        colaborador=func or "System",
                    )
                    if lancamento is not None:
                        new_lancamentos.append(lancamento)

                uri_estoque = database.get_data_uri("ESTOQUE", self.contract_id)
                database.save_dataframe_csv(df_estoque, uri_estoque)

                if new_lancamentos:
                    df_lanc = pd.concat([df_lanc, pd.DataFrame(new_lancamentos)], ignore_index=True)
                    uri_lanc = database.get_data_uri("ESTOQUE_LANCAMENTOS", self.contract_id)
                    database.save_dataframe_csv(df_lanc, uri_lanc)

        return {"status": "success", "message": "Delivery processed"}

    def get_filter_options(self) -> Dict[str, List[str]]:
        df = database.load_entregas(self.contract_id)
        
        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        if not df.empty:
            df = pd.DataFrame(adapters.normalize_dataframe(df))

        if df.empty:
            return {"cidades": [], "filas": [], "empresas": []}
        
        # Filter Pending
        pending = df
        if 'DataEntrega' in df.columns:
            data_entrega = df['DataEntrega'].astype(str).str.strip().str.lower().replace('nan', '')
            pending = df[data_entrega == '']
            
        def get_distinct(col):
            if col not in pending.columns:
                return []
            return sorted(pending[col].astype(str).dropna().unique().tolist())
            
        return {
            "cidades": get_distinct("Cidade"),
            "filas": get_distinct("Fila"),
            "empresas": get_distinct("Empresa")
        }

    def get_solicitantes(self, query: str = "") -> List[Dict[str, str]]:
        # Solicitantes.csv logic or extract from Entregas
        key = database.get_data_key("SOLICITANTES", self.contract_id)
        uri = database.get_data_uri("SOLICITANTES", self.contract_id)
        
        if not database.get_storage().exists(key):
             # Fallback to extracting from Entregas
             df = database.load_entregas(self.contract_id)
             try:
                 from .. import adapters
             except (ImportError, ValueError):
                 from core import adapters
             if not df.empty:
                 df = pd.DataFrame(adapters.normalize_dataframe(df))
             
             if df.empty or 'Solicitante' not in df.columns:
                 return []
             distinct = df[['Solicitante', 'Ramal']].drop_duplicates().fillna("")
             # Filter
             if query:
                 q = str(query).lower()
                 distinct = distinct[distinct['Solicitante'].str.lower().str.contains(q)]
             return distinct.to_dict(orient="records")
        
        try:
            import fsspec
            with fsspec.open(uri, mode='rt', encoding='utf-8-sig') as f:
                df = pd.read_csv(f, sep=';')
            try:
                from .. import adapters
            except (ImportError, ValueError):
                from core import adapters
            if not df.empty:
                df = pd.DataFrame(adapters.normalize_dataframe(df))
            if df.empty:
                return []
            df = df.fillna("")
            if query:
                 q = str(query).lower()
                 df = df[df['Nome'].str.lower().str.contains(q)]
            # Map cols
            return df.rename(columns={"Nome": "Solicitante", "Ramal": "Ramal"}).to_dict(orient="records")
        except Exception:
             return []

    def add_solicitante(self, name: str, ramal: str = ""):
        """Delega ao SolicitantesService para preservar Source e campos estendidos."""
        try:
            from .solicitantes import SolicitantesService
            svc = SolicitantesService(self.contract_id)
            svc._add_or_update_ramal(name, ramal)
        except Exception:
            pass  # Non-critical — autocomplete fallback

    def cancel(self, protocol_id: int, reason: str) -> Dict[str, Any]:
        df_entregas = database.load_entregas(self.contract_id)
        
        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        if not df_entregas.empty:
            df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))
        
        if df_entregas.empty:
            return {"status": "error", "message": "Entregas empty"}

        df_entregas['Protocolo_Num'] = pd.to_numeric(df_entregas['Protocolo'], errors='coerce')
        indices = df_entregas.index[df_entregas['Protocolo_Num'] == protocol_id].tolist()
        
        if not indices:
            return {"status": "error", "message": "Protocol not found"}
        idx = indices[0]
        
        today = datetime.now().strftime('%d/%m/%Y')
        
        # Ensure DTypes
        for col in ['Status', 'Cancelado', 'Funcionario', 'DataEntrega', 'Obs']:
             if col in df_entregas.columns:
                 df_entregas[col] = df_entregas[col].astype(object)
                 
        df_entregas.at[idx, 'Status'] = 'Cancelado'
        df_entregas.at[idx, 'Cancelado'] = 'VERDADEIRO' 
        df_entregas.at[idx, 'IncidenteRds'] = "-1"
        df_entregas.at[idx, 'Funcionario'] = 'CANCELADO'
        df_entregas.at[idx, 'DataEntrega'] = today
        
        current_obs = str(df_entregas.at[idx, 'Obs']) if pd.notna(df_entregas.at[idx, 'Obs']) else ""
        if reason:
            df_entregas.at[idx, 'Obs'] = (current_obs + " [Cancelado: " + reason + "]").strip()
        
        uri_entregas = database.get_data_uri("ENTREGAS", self.contract_id)
        database.save_dataframe_csv(df_entregas.drop(columns=['Protocolo_Num']), uri_entregas)
        
        return {"status": "success", "message": "Protocol cancelled"}

