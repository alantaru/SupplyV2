from typing import Dict, Any, List
import pandas as pd
from datetime import datetime
try:
    from ... import database
except (ImportError, ValueError):
    import database

class StockService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    def get_levels(self) -> List[Dict[str, Any]]:
        """
        Get current stock levels for the active contract.
        Retrocompatível: itens sem Categoria são tratados como 'customizado'.
        """
        df = database.load_estoque(self.contract_id)
        if df.empty:
            return []

        # Retrocompatibilidade: preencher colunas novas com defaults se ausentes
        for col, default in [("Categoria", "customizado"), ("ModeloEquipamento", ""), ("TipoToner", ""), ("Codigo", "")]:
            if col not in df.columns:
                df[col] = default
            else:
                df[col] = df[col].fillna(default).astype(str).replace("nan", default)

        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        return adapters.normalize_dataframe(df)

    def get_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """
        Get stock movement history.
        """
        df = database.load_estoque_lancamentos(self.contract_id)
        if df.empty:
            return []
            
        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        normalized = adapters.normalize_dataframe(df)
        
        # Basic reverse sort using python list slicing on the normalized list
        return normalized[-limit:][::-1]

    def adjust(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Manual stock adjustment.
        """
        item = data.get("item")
        qty = int(data.get("qty", 0))
        user = data.get("user", "System")
        reason = data.get("reason", "")
        empresa = data.get("empresa", "")
        codigo = data.get("code", "") # New field
        
        if qty == 0:
            return {"status": "error", "message": "Quantity is 0"}

        with database.DB_LOCK:
            df_estoque = database.load_estoque(self.contract_id)
            df_history = database.load_estoque_lancamentos(self.contract_id)
            
            # Update Stock
            mask = df_estoque['TipoModelo'].astype(str).str.strip().str.lower() == str(item).strip().lower()
            
            if mask.any():
                idx = df_estoque[mask].index[0]
                current = pd.to_numeric(df_estoque.at[idx, 'EstoqueAtual'], errors='coerce')
                if pd.isna(current):
                    current = 0
                df_estoque.at[idx, 'EstoqueAtual'] = current + qty
                df_estoque.at[idx, 'UltimaAlteracao'] = datetime.now().strftime('%d/%m/%Y')
                # Optional: Update empresa/code if provided and not empty
                if empresa:
                    df_estoque.at[idx, 'Empresa'] = empresa
                if codigo:
                    df_estoque.at[idx, 'Codigo'] = codigo
            else:
                new_row = {
                    "TipoModelo": item,
                    "EstoqueAtual": qty,
                    "UltimaAlteracao": datetime.now().strftime('%d/%m/%Y'),
                    "Cor": "", 
                    "Empresa": empresa,
                    "Codigo": codigo
                }
                df_estoque = pd.concat([df_estoque, pd.DataFrame([new_row])], ignore_index=True)
                
            # Save Stock
            uri = database.get_data_uri("ESTOQUE", self.contract_id)
            database.save_dataframe_csv(df_estoque, uri)
            
            # Add History
            new_hist = {
                "TipoMaterial": "Ajuste",
                "Modelo": item,
                "TipoLancamento": data.get("type", "Entrada" if qty > 0 else "Saída"),
                "Quantidade": abs(qty),
                "ProtocoloOUPedido": data.get("protocolo") or data.get("nf") or "MANUAL",
                "FilaImpressao": data.get("fila", ""),
                "Colaborador": user,
                "DataLancamento": datetime.now().strftime('%d/%m/%Y'),
                "Empresa": empresa,
                "Obs": reason,
                "NF": data.get("nf", "")
            }
            
            df_history = pd.concat([df_history, pd.DataFrame([new_hist])], ignore_index=True)
            path_hist = database.get_data_uri("ESTOQUE_LANCAMENTOS", self.contract_id)
            database.save_dataframe_csv(df_history, path_hist)
            
        return {"status": "success", "new_level": 0}

    def update_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Update item details (Code, Name, Company) without changing stock quantity.
        Preserva Categoria, ModeloEquipamento e TipoToner existentes se não fornecidos.
        """
        original_item = data.get("original_item")
        new_item = data.get("new_item")
        code = data.get("code")
        empresa = data.get("empresa")

        if not original_item:
            return {"status": "error", "message": "Missing original item name"}

        with database.DB_LOCK:
            df_estoque = database.load_estoque(self.contract_id)

            # Garantir colunas novas existem
            for col, default in [("Categoria", "customizado"), ("ModeloEquipamento", ""), ("TipoToner", ""), ("Codigo", "")]:
                if col not in df_estoque.columns:
                    df_estoque[col] = default

            mask = df_estoque['TipoModelo'].astype(str).str.strip().str.lower() == str(original_item).strip().lower()

            if mask.any():
                idx = df_estoque[mask].index[0]

                if new_item:
                    df_estoque['TipoModelo'] = df_estoque['TipoModelo'].astype(str)
                    df_estoque.at[idx, 'TipoModelo'] = str(new_item)
                if code is not None:
                    df_estoque['Codigo'] = df_estoque['Codigo'].astype(str)
                    df_estoque.at[idx, 'Codigo'] = str(code)
                if empresa:
                    df_estoque['Empresa'] = df_estoque['Empresa'].astype(str)
                    df_estoque.at[idx, 'Empresa'] = str(empresa)

                # Preservar campos de categoria — só atualizar se explicitamente fornecidos
                if "categoria" in data and data["categoria"]:
                    df_estoque.at[idx, 'Categoria'] = data["categoria"]
                if "modelo_equipamento" in data:
                    df_estoque.at[idx, 'ModeloEquipamento'] = data["modelo_equipamento"]
                if "tipo_toner" in data:
                    df_estoque.at[idx, 'TipoToner'] = data["tipo_toner"]

                df_estoque.at[idx, 'UltimaAlteracao'] = datetime.now().strftime('%d/%m/%Y')

                path = database.get_data_uri("ESTOQUE", self.contract_id)
                database.save_dataframe_csv(df_estoque, path)
                return {"status": "success"}
            else:
                return {"status": "error", "message": "Item not found"}

    def delete_item(self, item_name: str) -> Dict[str, Any]:
        """
        Delete an item from stock inventory.
        """
        if not item_name:
            return {"status": "error", "message": "Item name required"}
            
        with database.DB_LOCK:
            df_estoque = database.load_estoque(self.contract_id)
            
            # Case-insensitive match
            mask = df_estoque['TipoModelo'].astype(str).str.strip().str.lower() == str(item_name).strip().lower()
            
            if mask.any():
                # Remove rows matching the mask
                df_estoque = df_estoque[~mask]
                
                path = database.get_data_uri("ESTOQUE", self.contract_id)
                database.save_dataframe_csv(df_estoque, path)
                
                # We do NOT delete history logs, as that would break audit trails.
                return {"status": "success", "message": f"Item '{item_name}' deleted"}
            else:
                return {"status": "error", "message": "Item not found"}

    def create_item(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Cria um novo item de estoque com categoria definida.
        Categorias: 'papel', 'toner', 'customizado'.
        """
        categoria = str(data.get("categoria", "customizado")).strip().lower()
        today = datetime.now().strftime('%d/%m/%Y')

        # Determinar nome e campos por categoria
        if categoria == "toner":
            modelo_equip = str(data.get("modelo_equipamento", "")).strip()
            tipo_toner = str(data.get("tipo_toner", "")).strip().upper()
            if not modelo_equip or not tipo_toner:
                return {"status": "error", "message": "modelo_equipamento e tipo_toner são obrigatórios para toners"}
            nome = f"{tipo_toner} {modelo_equip}"
            modelo_equip_salvo = modelo_equip
            tipo_toner_salvo = tipo_toner

        elif categoria == "papel":
            tipo_papel = str(data.get("tipo_papel", "A4")).strip().upper()
            nome = "A4 (RESMAS)" if tipo_papel == "A4" else "A3 (RESMAS)"
            modelo_equip_salvo = ""
            tipo_toner_salvo = ""

        else:
            # customizado
            categoria = "customizado"
            nome = str(data.get("nome", "")).strip()
            if not nome:
                return {"status": "error", "message": "nome é obrigatório para itens customizados"}
            modelo_equip_salvo = ""
            tipo_toner_salvo = ""

        qty = int(data.get("quantidade_inicial", 0))
        empresa = str(data.get("empresa", "")).strip()
        codigo = str(data.get("codigo", "")).strip()

        with database.DB_LOCK:
            df_estoque = database.load_estoque(self.contract_id)
            df_history = database.load_estoque_lancamentos(self.contract_id)

            # Verificar duplicata (case-insensitive)
            if not df_estoque.empty and "TipoModelo" in df_estoque.columns:
                mask = df_estoque['TipoModelo'].astype(str).str.strip().str.lower() == nome.lower()
                if mask.any():
                    return {"status": "error", "message": "Item já existe no estoque"}

            # Criar nova linha
            new_row = {
                "TipoModelo": nome,
                "EstoqueAtual": qty,
                "UltimaAlteracao": today,
                "Cor": "",
                "Empresa": empresa,
                "Codigo": codigo,
                "Categoria": categoria,
                "ModeloEquipamento": modelo_equip_salvo,
                "TipoToner": tipo_toner_salvo,
            }
            df_estoque = pd.concat([df_estoque, pd.DataFrame([new_row])], ignore_index=True)

            uri_estoque = database.get_data_uri("ESTOQUE", self.contract_id)
            database.save_dataframe_csv(df_estoque, uri_estoque)

            # Registrar lançamento de criação
            new_hist = {
                "TipoMaterial": "Criação",
                "Modelo": nome,
                "TipoLancamento": "Entrada",
                "Quantidade": qty,
                "ProtocoloOUPedido": "CRIAÇÃO",
                "FilaImpressao": "",
                "Colaborador": data.get("user", "System"),
                "DataLancamento": today,
                "Empresa": empresa,
                "Obs": f"Item criado — categoria: {categoria}",
            }
            df_history = pd.concat([df_history, pd.DataFrame([new_hist])], ignore_index=True)
            uri_hist = database.get_data_uri("ESTOQUE_LANCAMENTOS", self.contract_id)
            database.save_dataframe_csv(df_history, uri_hist)

        return {"status": "success", "nome": nome, "categoria": categoria}

    def get_modelos(self) -> List[str]:
        """
        Retorna lista de modelos únicos do MAPA.csv para popular dropdown de toners.
        """
        try:
            df = database.load_mapa(self.contract_id)
        except Exception:
            return []

        if df is None or df.empty:
            return []

        # Encontrar coluna de modelo (case-insensitive)
        col = None
        for c in df.columns:
            if c.strip().upper() in ("MODELOSIMPRESS", "MODELO"):
                col = c
                break

        if not col:
            return []

        modelos = df[col].dropna().astype(str).str.strip()
        modelos = modelos[modelos != ""]
        return sorted(modelos.unique().tolist())
