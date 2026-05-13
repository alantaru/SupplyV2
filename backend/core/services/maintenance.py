import pandas as pd
import logging
from datetime import datetime
from typing import List, Dict, Any
try:
    from ... import database
except (ImportError, ValueError):
    try:
        from .. import database
    except (ImportError, ValueError):
        import database

logger = logging.getLogger(__name__)

class MaintenanceService:
    """
    Service for managing Equipment Maintenance, OS, Parts, and Preventive Maintenance (MP).
    Handles logic for life cycle calculations and Teams script generation.
    """

    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    def get_preventive_status(self) -> List[Dict[str, Any]]:
        """
        Calculates usage percentage for all monitored components of all equipments.
        Formula: (CurrentCounter - LastExchangeCounter) / LifeCycle
        """
        mapa = database.load_normalized("MAPA", self.contract_id)
        contadores = database.load_normalized("CONTADORES", self.contract_id)
        mp_controle = database.load_normalized("MANUTENCAO_CONTROLE", self.contract_id)
        pecas_params = database.load_normalized("MANUTENCAO_PECAS", self.contract_id)

        if mapa.empty:
            return []

        # Merge Mapa with MP Control to get current status
        # Note: load_normalized ensures 'Serie' is canonical
        if not mp_controle.empty:
            df = mapa.merge(mp_controle, on="Serie", how="left")
        else:
            df = mapa.copy()
        
        # Latest counter for each serial
        if not contadores.empty:
            # load_normalized maps to 'Serie' (TitleCase) for both MAPA and CONTADORES
            # Adapter maps 'TOTAL' to 'ContadorTotal'
            latest_counters = contadores.sort_values("Data").groupby("Serie").last().reset_index()
            df = df.merge(latest_counters[["Serie", "ContadorTotal"]], on="Serie", how="left")
            df.rename(columns={"ContadorTotal": "TOTAL"}, inplace=True)
        else:
            df["TOTAL"] = 0

        results = []
        for _, row in df.iterrows():
            serie = row.get("Serie")
            modelo = row.get("ModeloSimpress") or row.get("Modelo")
            current_total = row.get("TOTAL", 0)
            if pd.isna(current_total):
                current_total = 0
            
            # Find life cycles for this model from params
            # Default values if model not found
            life_cycles = {
                "UnidImg": 60000,
                "Fusao": 150000,
                "Belt": 150000,
                "Disposal": 30000
            }

            if not pecas_params.empty:
                # Assuming MANUTENCAO_PECAS has 'Modelo' and 'VidaUtil' columns
                # and maybe a 'Componente' column or separate columns for each
                # For this audit, we follow the prompt: "Tabelas de Parâmetros (Belt, Disposal, UnidImg, Fusão)"
                model_matches = pecas_params[pecas_params["Modelo"].str.contains(str(modelo), na=False, case=False)]
                if not model_matches.empty:
                    for comp_name in life_cycles.keys():
                        comp_match = model_matches[model_matches["Componente"] == comp_name] if "Componente" in model_matches.columns else pd.DataFrame()
                        if not comp_match.empty:
                            life_cycles[comp_name] = int(comp_match.iloc[0]["VidaUtil"])

            status = {
                "Serie": serie,
                "Modelo": modelo,
                "ContadorAtual": current_total,
                "Local": row.get("LocalInstalacao"),
                "Componentes": []
            }

            components = [
                {"name": "UnidImg", "field": "UltimaTrocaImg"},
                {"name": "Fusao", "field": "UltimaTrocaFusao"},
                {"name": "Belt", "field": "UltimaTrocaBelt"},
                {"name": "Disposal", "field": "UltimaTrocaDisposal"}
            ]

            for comp in components:
                last_exchange = row.get(comp["field"], 0)
                if pd.isna(last_exchange):
                    last_exchange = 0
                life_cycle = life_cycles.get(comp["name"], 60000)
                
                usage_pct = 0
                if life_cycle > 0:
                    try:
                        usage_pct = float(current_total - last_exchange) / life_cycle
                    except Exception:
                        usage_pct = 0
                
                if pd.isna(usage_pct):
                    usage_pct = 0
                
                status["Componentes"].append({
                    "Tipo": comp["name"],
                    "Uso": round(usage_pct * 100, 2),
                    "Status": "CRITICAL" if usage_pct >= 0.9 else ("WARNING" if usage_pct >= 0.8 else "OK")
                })
            
            results.append(status)

        return results

    def generate_teams_script(self, type: str, data: Dict[str, Any]) -> str:
        """
        Generates a pre-formatted text for Teams based on the requested model.
        """
        is_swap = type in ['Movimentacao', 'Troca Tecnica', 'AtivacaoBackup', 'Retorno']
        
        # Headers based on prompt
        header = f"Tipo de Alteração: {type.upper()}"
        if data.get('mau_uso'):
            header = "🚨 **[CONSTATADO MAU USO]** 🚨\n" + header

        body = f"""
{header}
Chamado BMC: {data.get('chamado', 'INC000000000000')}

{'**** Equipamento Entrando ****' if is_swap else ''}
Serial: {data.get('serie', 'N/A')}
Hostname/Fila: {data.get('fila', 'N/A')}
Modelo: {data.get('modelo', 'N/A')}
Leitor de Crachá (Licença): {data.get('leitor', 'Sim (Embarcado / FastRelease)')}
Contador P&B: {data.get('contador_pb', '0')}
Contador Color: {data.get('contador_color', '0')}
Rede do equipamento: {data.get('rede', 'Rede')}
IP: {data.get('ip', 'N/A')}
Latitude: {data.get('lat', '00000')}
Longitude: {data.get('lng', '00000')}
Cidade: {data.get('cidade', 'Ipatinga')}
Planta: {data.get('planta', 'Usiminas')}
Rua: {data.get('rua', 'N/A')}
Local de instalação: {data.get('local', 'N/A')}
Ramal: {data.get('ramal', 'N/A')}
Contato: {data.get('contato', 'N/A')}
"""

        if is_swap:
            body += f"""
**** Equipamento Saindo ****
Serial: {data.get('serie_saindo', 'N/A')}
Hostname/Fila: {data.get('fila_saindo', 'N/A')}
Modelo: {data.get('modelo_saindo', 'N/A')}
Contador P&B: {data.get('contador_pb_saindo', '0')}
Contador Color: {data.get('contador_color', '0')}
"""

        if data.get('mau_uso'):
            body += "\n*Evidências de Mau Uso e Termo de Ciência coletados.*"

        return body.strip()

    def perform_equipment_swap(self, serie_original: str, serie_nova: str, tipo: str):
        """
        Performs a logical swap in the technical map.
        - serie_original: The machine currently at the site (to be recollected/backup).
        - serie_nova: The machine arriving (from backup or stock).
        """
        mapa = database.load_normalized("MAPA", self.contract_id)
        if mapa.empty:
            return
        
        # 1. Find the location of the original machine
        row_original = mapa[mapa["Serie"] == serie_original]
        if row_original.empty:
            raise ValueError(f"Série original {serie_original} não encontrada no mapa.")
            
        local_data = row_original.iloc[0].to_dict()
        
        # 2. Update the technical map (divergences)
        # Mark original as recollected (for now we just clear its location in technical view)
        self.save_manual_edit(serie_original, {
            "LocalInstalacao": "ALMOXARIFADO",
            "Fila": "ALMOXARIFADO",
            "Status": "ALMOXARIFADO"
        })
        
        # Mark new series at the original location
        swap_fields = [
            "LocalInstalacao", "Fila", "Area", "PlantaInstalada", 
            "RuaRef", "ContatoSetor", "Setor", "Empresa", "Cidade"
        ]
        new_changes = {field: local_data.get(field, "N/A") for field in swap_fields}
        self.save_manual_edit(serie_nova, new_changes)
        
        return {
            "status": "success",
            "message": f"Swap concluído: {serie_nova} assumiu o local de {serie_original}"
        }

    def _load_mp_controle(self) -> pd.DataFrame:
        return database.load_normalized("MANUTENCAO_CONTROLE", self.contract_id)

    def _load_pecas_params(self) -> pd.DataFrame:
        uri = database.get_data_uri("MANUTENCAO_PECAS", self.contract_id)
        storage = database.get_storage()
        if not storage.exists(database.get_data_key("MANUTENCAO_PECAS", self.contract_id)):
            return pd.DataFrame()
        return database.repair_and_load_csv(uri)

    def save_manual_edit(self, serie: str, changes: Dict[str, Any]):
        """
        Saves a manual edit from a technician and records it in MAPA_DIVERGENCIAS.
        """
        # 1. Update MAPA.csv immediately
        mapa = database.load_normalized("MAPA", self.contract_id)
        if mapa.empty:
            return
        
        idx = mapa[mapa["Serie"] == serie].index
        if not idx.empty:
            for field, value in changes.items():
                # Map technical field names if necessary (e.g. 'Local' -> 'LocalInstalacao')
                # For now, we trust the tech uses correct names or we provide a helper
                if field in mapa.columns:
                    mapa.at[idx[0], field] = value
            
            uri = database.get_data_uri("MAPA", self.contract_id)
            database.save_dataframe_csv(mapa, uri)
            
            # 2. Record Divergence
            divergencias = self._load_divergencias()
            for field, value in changes.items():
                new_div = {
                    "Serie": serie,
                    "Campo": field,
                    "ValorTecnico": value,
                    "ValorOficial": "N/A", # Will be filled during next Official Sync
                    "DataAlteracao": datetime.now().isoformat(),
                    "StatusSincronia": "PENDENTE"
                }
                divergencias = pd.concat([divergencias, pd.DataFrame([new_div])], ignore_index=True)
            
            self._save_divergencias(divergencias)

    def _load_divergencias(self) -> pd.DataFrame:
        uri = database.get_data_uri("MAPA_DIVERGENCIAS", self.contract_id)
        storage = database.get_storage()
        if not storage.exists(database.get_data_key("MAPA_DIVERGENCIAS", self.contract_id)):
            return pd.DataFrame()
        return database.repair_and_load_csv(uri)

    def _save_divergencias(self, df: pd.DataFrame):
        uri = database.get_data_uri("MAPA_DIVERGENCIAS", self.contract_id)
        database.save_dataframe_csv(df, uri)

    def create_os(self, data: Dict[str, Any], files: List[str] = None) -> Dict[str, Any]:
        """
        Creates a Technical Service Order (O.S.)
        """
        serie = data.get("serie")
        tipo = data.get("tipo_servico")
        pecas = data.get("pecas", "")
        contador = data.get("contador")
        mau_uso = data.get("mau_uso", False)
        serie_saindo = data.get("serie_saindo")
        
        # 1. Handle Swap if needed
        if serie_saindo:
            self.perform_equipment_swap(serie_saindo, serie, tipo)
            
        # 2. Generate Teams Script
        # Padrão: 🔧 *MANUTENÇÃO REALIZADA* \n 📍 *Local:* ... \n 📠 *Série:* ...
        mapa = database.load_normalized("MAPA", self.contract_id)
        equip = mapa[mapa["Serie"] == serie].iloc[0] if not mapa.empty and serie in mapa["Serie"].values else {}
        
        local = f"{equip.get('Empresa', '')} - {equip.get('Area', '')} ({equip.get('LocalInstalacao', '')})"
        
        script = (
            f"🔧 *MANUTENÇÃO REALIZADA - {tipo.upper()}*\n\n"
            f"📍 *LOCAL:* {local}\n"
            f"📠 *EQUIPAMENTO:* {equip.get('ModeloSimpress', 'N/A')} ({serie})\n"
            f"🔢 *CONTADOR:* {contador}\n"
            f"🛠️ *PEÇAS/SERVIÇO:* {pecas}\n"
            f"⚠️ *MAU USO:* {'SIM' if mau_uso else 'NÃO'}\n"
        )
        
        if serie_saindo:
            script += f"🔄 *EQUIP. RECOLHIDO:* {serie_saindo}\n"
            
        script += f"\n✅ *STATUS:* FINALIZADO PELO TÉCNICO"

        # 3. Save OS Entry
        df_os = self._load_generic_csv("MANUTENCAO_OS")
        new_os = {
            "Serie": serie,
            "Data": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Tipo": tipo,
            "Pecas": pecas,
            "Contador": contador,
            "MauUso": mau_uso,
            "Script": script,
            "Evidencias": ",".join(files) if files else ""
        }
        df_os = pd.concat([df_os, pd.DataFrame([new_os])], ignore_index=True)
        self._save_generic_csv("MANUTENCAO_OS", df_os)
        
        return {"teams_script": script, "os_id": len(df_os)}

    def get_backups_aging(self) -> List[Dict[str, Any]]:
        """
        Tracks machines in field that are 'Backups' and their stay duration.
        SLA: Maximum 10 days.
        """
        # We assume machines with a specific flag or in a specific list are backups
        # For now, let's use the 'Divergencias' or 'OS' history to find them
        # Implementation depends on how we flag backups in the MAPA.
        # Let's assume MAPA has a 'Status' column (Canonical from Adapter) where 'BACKUP' is a value.
        mapa = database.load_normalized("MAPA", self.contract_id)
        if mapa.empty:
            return []
            
        if "TipoEquipamento" in mapa.columns:
            backups = mapa[mapa["TipoEquipamento"] == "BACKUP"]
        elif "Status" in mapa.columns:
            backups = mapa[mapa["Status"] == "BACKUP"]
        else:
            return []
            
        results = []
        
        for _, row in backups.iterrows():
            entrada_str = row.get("DataEntradaManutencao")
            days = 0
            if entrada_str:
                try:
                    entrada_dt = datetime.fromisoformat(entrada_str)
                    days = (datetime.now() - entrada_dt).days
                except Exception:
                    pass
            
            results.append({
                "Serie": row.get("Serie"),
                "Local": row.get("LocalInstalacao"),
                "DiasEmCampo": days,
                "Status": "CRITICAL" if days > 10 else ("WARNING" if days > 7 else "OK")
            })
        return results

    def get_divergences_count(self) -> int:
        """Returns the number of active map divergences."""
        df = self._load_divergencias()
        if df.empty:
            return 0
        return len(df[df["StatusSincronia"] == "PENDENTE"])

    def _load_generic_csv(self, file_key: str) -> pd.DataFrame:
        """
        Loads a maintenance-related CSV using database.load_normalized
        to benefit from caching and column mapping.
        """
        try:
            return database.load_normalized(file_key, self.contract_id)
        except Exception as e:
            logger.error(f"Error loading maintenance CSV {file_key}: {e}")
            return pd.DataFrame()

    def _save_generic_csv(self, file_key: str, df: pd.DataFrame):
        uri = database.get_data_uri(file_key, self.contract_id)
        database.save_dataframe_csv(df, uri)

    def get_nfs(self) -> List[Dict[str, Any]]:
        df = self._load_generic_csv("MANUTENCAO_NF")
        if df.empty:
            return []
        return df.to_dict(orient="records")

    def save_nf(self, data: Dict[str, Any]) -> Dict[str, Any]:
        df = self._load_generic_csv("MANUTENCAO_NF")
        df = pd.concat([df, pd.DataFrame([data])], ignore_index=True)
        self._save_generic_csv("MANUTENCAO_NF", df)
        return data

    def delete_nf(self, filename: str):
        df = self._load_generic_csv("MANUTENCAO_NF")
        if not df.empty and "Filename" in df.columns:
            df = df[df["Filename"] != filename]
            self._save_generic_csv("MANUTENCAO_NF", df)
            
            # Delete physical file
            key = f"{self.contract_id}/nfs/{filename}"
            if database.get_storage().exists(key):
                database.get_storage().delete(key)

    # --- Parts & Inventory Management ---

    def get_compatible_parts(self, modelo: str) -> List[Dict[str, Any]]:
        """
        Returns a list of parts compatible with the specific equipment model.
        Uses bidirectional substring matching for robustness.
        """
        try:
            pecas = self._load_generic_csv("MANUTENCAO_PECAS")
            if pecas.empty:
                return []
            
            if "Modelo" not in pecas.columns:
                logger.error("MANUTENCAO_PECAS missing 'Modelo' column")
                return []

            # Filter by model bidirectional substring (case insensitive)
            m = str(modelo).strip().lower()
            if m:
                # Piece model contains Machine model OR Machine model contains Piece model
                mask = pecas["Modelo"].str.lower().str.contains(m, na=False) | \
                       pd.Series([m in str(pm).lower() for pm in pecas["Modelo"]])
                compat = pecas[mask].copy()
            else:
                # If no model provided, return all parts (used by Stock Manager)
                compat = pecas.copy()
            
            # Merge with current stock levels
            estoque = self._load_generic_csv("MANUTENCAO_ESTOQUE")
            if not estoque.empty and "Codigo" in estoque.columns and "Codigo" in compat.columns:
                compat = compat.merge(estoque, on="Codigo", how="left")
                if "Quantidade" in compat.columns:
                    compat["Quantidade"] = compat["Quantidade"].fillna(0).astype(int)
                else:
                    compat["Quantidade"] = 0
            else:
                compat["Quantidade"] = 0
                
            return compat.to_dict(orient="records")
        except Exception as e:
            logger.exception(f"Error in get_compatible_parts: {e}")
            return []

    def update_part_stock(self, cod_peca: str, qtd: int, tipo: str, os_id: str = "", serie: str = "", usuario: str = "Sistema"):
        """
        Updates parts stock and records a transaction.
        tipo: 'ENTRADA' or 'SAIDA'
        """
        estoque = self._load_generic_csv("MANUTENCAO_ESTOQUE")
        if estoque.empty:
            estoque = pd.DataFrame(columns=["Codigo", "Quantidade"])
            
        # Update quantity
        mask = estoque["Codigo"] == cod_peca
        if not mask.any():
            if tipo == 'SAIDA':
                raise ValueError(f"Estoque insuficiente para peça {cod_peca}")
            new_row = {"Codigo": cod_peca, "Quantidade": qtd}
            estoque = pd.concat([estoque, pd.DataFrame([new_row])], ignore_index=True)
        else:
            current_qty = int(estoque.loc[mask, "Quantidade"].iloc[0])
            if tipo == 'SAIDA':
                if current_qty < qtd:
                    raise ValueError(f"Estoque insuficiente para peça {cod_peca}")
                estoque.loc[mask, "Quantidade"] = current_qty - qtd
            else:
                estoque.loc[mask, "Quantidade"] = current_qty + qtd
                
        self._save_generic_csv("MANUTENCAO_ESTOQUE", estoque)
        
        # Record transaction
        lancamentos = self._load_generic_csv("MANUTENCAO_ESTOQUE_LANCAMENTOS")
        if lancamentos.empty:
            lancamentos = pd.DataFrame(columns=["Data", "Codigo", "Tipo", "Quantidade", "OS", "Serie", "Usuario"])
            
        new_lanc = {
            "Data": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Codigo": cod_peca,
            "Tipo": tipo,
            "Quantidade": qtd,
            "OS": os_id,
            "Serie": serie,
            "Usuario": usuario
        }
        lancamentos = pd.concat([lancamentos, pd.DataFrame([new_lanc])], ignore_index=True)
        self._save_generic_csv("MANUTENCAO_ESTOQUE_LANCAMENTOS", lancamentos)
        
    def get_parts_stock_history(self) -> List[Dict[str, Any]]:
        try:
            df = self._load_generic_csv("MANUTENCAO_ESTOQUE_LANCAMENTOS")
            if df.empty:
                return []
            if "Data" in df.columns:
                return df.sort_values("Data", ascending=False).to_dict(orient="records")
            return df.to_dict(orient="records")
        except Exception as e:
            logger.exception(f"Error in get_parts_stock_history: {e}")
            return []

    def create_part_catalog(self, data: Dict[str, Any]):
        """
        Registers a new part in the technical parameters (MANUTENCAO_PECAS).
        """
        pecas = self._load_generic_csv("MANUTENCAO_PECAS")
        
        # Ensure mandatory columns
        required = ["Codigo", "Nome", "Modelo", "VidaUtil", "Componente"]
        for col in required:
            if col not in data:
                # Provide default/empty if missing, or handle error
                data[col] = data.get(col, "")

        # Check for duplicates
        if not pecas.empty and "Codigo" in pecas.columns:
            if data["Codigo"] in pecas["Codigo"].values:
                raise ValueError(f"Código {data['Codigo']} já existe no catálogo.")

        # Add to dataframe
        new_row = {
            "Codigo": data["Codigo"],
            "Nome": data["Nome"],
            "Modelo": data["Modelo"],
            "VidaUtil": data["VidaUtil"],
            "Componente": data.get("Componente", "Outros")
        }
        
        if pecas.empty:
            pecas = pd.DataFrame([new_row])
        else:
            pecas = pd.concat([pecas, pd.DataFrame([new_row])], ignore_index=True)
            
        self._save_generic_csv("MANUTENCAO_PECAS", pecas)
        return {"status": "success", "message": "Peça cadastrada no catálogo."}

