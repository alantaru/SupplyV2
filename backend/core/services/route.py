from typing import List, Dict, Any
import pandas as pd
import json
import math
from pathlib import Path
from datetime import datetime
try:
    from ... import database, config
except (ImportError, ValueError):
    try:
        import database
        import config
    except (ImportError, ValueError):
        pass
from .protocol import ProtocolService

class RouteService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    # --- Storage keys (unified storage) ---
    def _get_routes_key(self) -> str:
        return f"{self.contract_id}/routes.json"

    def _get_metadata_key(self) -> str:
        return f"{self.contract_id}/routes_metadata.json"

    def _get_settings_key(self) -> str:
        return f"{self.contract_id}/routes_settings.json"

    # --- Legacy local paths (fallback for existing data) ---
    def _get_routes_file(self) -> Path:
        return config.CONTRACTS_DIR / self.contract_id / "routes.json"

    def _get_metadata_file(self) -> Path:
        return config.CONTRACTS_DIR / self.contract_id / "routes_metadata.json"

    def _get_settings_file(self) -> Path:
        return config.CONTRACTS_DIR / self.contract_id / "routes_settings.json"

    # --- Settings Persistence ---
    def load_settings(self) -> Dict[str, Any]:
        import fsspec
        default_settings = {"cycle_days_threshold": 26, "alert_enabled": True}
        storage = database.get_storage()
        key = self._get_settings_key()

        # Primary: read from storage
        if storage.exists(key):
            try:
                with fsspec.open(storage.get_uri(key), "r", encoding="utf-8") as f:
                    return {**default_settings, **json.load(f)}
            except Exception:
                pass

        # Fallback: local filesystem (legacy)
        f = self._get_settings_file()
        if f.exists():
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    return {**default_settings, **json.load(file)}
            except Exception:
                pass

        return default_settings

    def save_settings(self, settings: Dict[str, Any]) -> Dict[str, Any]:
        import fsspec
        current = self.load_settings()
        updated = {**current, **settings}
        storage = database.get_storage()
        key = self._get_settings_key()
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), 'w', encoding='utf-8') as f:
            json.dump(updated, f, indent=2)
        return updated

    # --- Metadata Persistence ---
    def load_metadata(self) -> Dict[str, Any]:
        """Returns dict of route_name -> {scheduled_date, notes, status_override}"""
        import fsspec
        storage = database.get_storage()
        key = self._get_metadata_key()

        # Primary: read from storage
        if storage.exists(key):
            try:
                with fsspec.open(storage.get_uri(key), "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        # Fallback: local filesystem (legacy)
        f = self._get_metadata_file()
        if f.exists():
            try:
                with open(f, 'r', encoding='utf-8') as file:
                    return json.load(file)
            except Exception:
                pass

        return {}

    def update_metadata(self, route_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
        import fsspec
        meta = self.load_metadata()
        route_key = route_name.lower()

        if route_key not in meta:
            meta[route_key] = {}
        meta[route_key].update(data)

        storage = database.get_storage()
        key = self._get_metadata_key()
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), 'w', encoding='utf-8') as f:
            json.dump(meta, f, indent=2)
        return meta[route_key]

    def list_routes(self) -> List[Dict[str, Any]]:
        """List all saved route definitions."""
        import fsspec
        storage = database.get_storage()
        key = self._get_routes_key()

        routes = []

        # Primary: read from storage
        if storage.exists(key):
            try:
                with fsspec.open(storage.get_uri(key), "r", encoding="utf-8") as f:
                    routes = json.load(f)
            except Exception:
                pass
        else:
            # Fallback: local filesystem (legacy)
            f = self._get_routes_file()
            if f.exists():
                try:
                    with open(f, 'r', encoding='utf-8') as file:
                        routes = json.load(file)
                except Exception:
                    pass

        for route in routes:
            route["excluded_count"] = len(route.get("excluded_series", []))

        return routes

    def save_route(self, name: str, series: List[str], filters: List[Dict[str, Any]] = None, excluded_series: List[str] = None) -> Dict[str, Any]:
        """Save or update a route definition."""
        import fsspec
        routes = self.list_routes()
        routes = [r for r in routes if r['name'].lower() != name.lower()]
        new_route = {
            "name": name,
            "series": series,
            "filters": filters or [],
            "excluded_series": excluded_series or [],
            "updated_at": datetime.now().isoformat()
        }
        routes.append(new_route)

        storage = database.get_storage()
        key = self._get_routes_key()
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), 'w', encoding='utf-8') as f:
            json.dump(routes, f, indent=2)

        return new_route

    def preview_from_filters(self, filters: List[Dict[str, str]], excluded_series: List[str] = None) -> List[Dict[str, Any]]:
        """
        Apply filters to MAPA and return analysis.
        Logic: OR within same field, AND between different fields.
        """
        df_mapa = database.load_mapa(self.contract_id)
        
        # Use Adapter
        from .. import adapters
        df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))

        # 1. Group filters by Field
        # Example filters: [{'field': 'Cidade', 'value': 'Ipatinga'}, {'field': 'Status', 'value': 'Backup'}]
        from collections import defaultdict
        field_groups = defaultdict(list)
        for f in filters:
            if f.get('field') and f.get('value'):
                field_groups[f['field']].append(f['value'])

        # 2. Apply Logic
        # Start with all True
        mask = pd.Series(True, index=df_mapa.index)

        for field, values in field_groups.items():
            # Check if field exists in DF (case insensitive check might be needed)
            # Assuming exact match for now or simple mapping
            # MAPA columns: Cidade, Status, ModeloSimpress, etc.
            
            # Helper to find column case-insensitive
            col_match = None
            for c in df_mapa.columns:
                if c.lower() == field.lower():
                    col_match = c
                    break
            
            if col_match:
                # OR logic for values in this field
                # (Col == val1) | (Col == val2) ...
                field_mask = pd.Series(False, index=df_mapa.index)
                for val in values:
                    # Case insensitive value match with strip
                    field_mask |= df_mapa[col_match].astype(str).str.strip().str.lower() == str(val).strip().lower()
                
                # AND logic with main mask
                mask &= field_mask

        # 3. Get Series
        filtered_df = df_mapa[mask]
        if filtered_df.empty:
            return []
            
        series_list = filtered_df['Serie'].dropna().astype(str).unique().tolist()

        if excluded_series:
            excluded_norm = {adapters.normalize_serie(s) for s in excluded_series}
            series_list = [s for s in series_list if adapters.normalize_serie(s) not in excluded_norm]

        # 4. Analyze
        return self.analyze_route(series_list)

    def delete_route(self, name: str) -> bool:
        """Delete a route by name."""
        import fsspec
        routes = self.list_routes()
        initial_len = len(routes)
        routes = [r for r in routes if r['name'].lower() != name.lower()]

        if len(routes) == initial_len:
            return False

        storage = database.get_storage()
        key = self._get_routes_key()
        storage.ensure_dir(key)
        with fsspec.open(storage.get_uri(key), 'w', encoding='utf-8') as f:
            json.dump(routes, f, indent=2)
        return True

    def analyze_route(self, series_list: List[str]) -> List[Dict[str, Any]]:
        """
        Analyze a list of series for proactive delivery needs.
        Calculates estimated stock and supplies suggestions efficiently.
        """
        if not series_list:
            return []

        # 1. Load Data
        df_mapa = database.load_mapa(self.contract_id)
        df_usiminas = database.load_contadores(self.contract_id)
        df_papel = database.load_papel(self.contract_id)
        df_entregas = database.load_entregas(self.contract_id)
        
        # Use Adapters
        from .. import adapters
        if not df_mapa.empty:
            df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))
        if not df_usiminas.empty:
            df_usiminas = pd.DataFrame(adapters.normalize_dataframe(df_usiminas))
        if not df_papel.empty:
            df_papel = pd.DataFrame(adapters.normalize_dataframe(df_papel))
        if not df_entregas.empty:
            df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))

        # 2. Filter Mapa to Series
        clean_series = [adapters.normalize_serie(s) for s in series_list]
        
        # Helper for matching
        # Use Adapter's robust normalization (14 chars)
        def normalize_serie(s): return adapters.normalize_serie(s)
        
        if not df_mapa.empty:
            df_mapa['Serie_Norm'] = df_mapa['Serie'].apply(normalize_serie)
        else:
            return []

        # Filtered DataFrame
        route_df = df_mapa[df_mapa['Serie_Norm'].isin(clean_series)].copy()
        
        if route_df.empty:
            return []

        # 3. Join Counters (Usiminas)
        if not df_usiminas.empty:
            # Ensure normalization is consistent with Verification logic
            # Adapter's normalize_serie() uses [:14], which correctly truncates Samsung/Simpress 15-char serials to 14.
            # This matches the verified logic (removing the suffix char).
            df_usiminas['Serie_Norm'] = df_usiminas['Serie'].apply(normalize_serie)
            
            # Take latest if duplicate (though usually unique)
            df_usiminas = df_usiminas.drop_duplicates(subset=['Serie_Norm'])
            route_df = route_df.merge(df_usiminas, on='Serie_Norm', how='left', suffixes=('', '_fleet'))

        # 4. Join Paper Stats
        if not df_papel.empty:
            col_serie = 'SERIE' if 'SERIE' in df_papel.columns else 'Serie'
            df_papel['Serie_Norm'] = df_papel[col_serie].apply(normalize_serie)
            df_papel = df_papel.drop_duplicates(subset=['Serie_Norm'])
            route_df = route_df.merge(df_papel, on='Serie_Norm', how='left', suffixes=('', '_papel'))

        # 5. Process Deliveries (Complex Logic: Find Last A4 and Last Counter)
        # Pre-process entregas
        last_a4_map = {}
        
        # We need: 
        # A. Current Counter (from Fleet/Usiminas) -> `E&C Counter Total`
        # B. Last Delivery of A4 -> Get its Date, Qty, and `ContadorFinal` AT THAT TIME.
        
        if not df_entregas.empty:
             df_entregas['Serie_Norm'] = df_entregas['Serie'].apply(normalize_serie)
             # Convert numeric where needed
             df_entregas['ContadorFinal'] = pd.to_numeric(df_entregas['ContadorFinal'], errors='coerce').fillna(0)
             df_entregas['A4'] = pd.to_numeric(df_entregas['A4'], errors='coerce').fillna(0)
             
             # Sort by Protocolo desc (proxy for time) or Date
             # Assuming standard protocol format or ID. Better: use file order (last is new) if appended? 
             # Protocolo is usually incremental.
             # Actually CSV is appened. So tail is newer.
             # Let's group.
             
             for serie, group in df_entregas.groupby('Serie_Norm'):
                 # Sort by original index (assuming chronological append)
                 group = group.sort_index(ascending=False)
                 
                 # LAST A4 DELIVERY
                 a4_dels = group[group['A4'] > 0]
                 if not a4_dels.empty:
                     last_a4_row = a4_dels.iloc[0]
                     last_a4_map[serie] = {
                         "date": last_a4_row.get('DataEntrega', ''),
                         "counter": float(last_a4_row['ContadorFinal']),
                         "qty": float(last_a4_row['A4'])
                     }
                 else:
                     # No A4 delivery ever?
                     pass

        # 6. Build Result List
        results = []
        for _, row in route_df.iterrows():
            serie = row['Serie_Norm']
            
            # Try EQA4 Counter Total first (User confirmed this is the "Real" counter)
            
            current_counter = 0 # Initialize default
            # Build case-insensitive column lookup map
            col_map = {c.upper(): c for c in row.index}
            
            # Prioritized counter column names — includes post-adapter normalized names
            counter_keys = [
                'EQA4 COUNTER TOTAL', 'E&C COUNTER TOTAL', 'TOTAL',
                'CONTADORTOTAL', 'CONTADOR', 'CONTADORATUAL',
                'EQA4COUNTERTOTAL', 'EQCOUNTERTOTAL',
            ]
            
            for key in counter_keys:
                actual_col = col_map.get(key.upper().replace(' ', '').replace('&', ''))
                if actual_col is None:
                    actual_col = col_map.get(key.upper())
                if actual_col and pd.notna(row[actual_col]):
                    try:
                        raw_str = str(row[actual_col]).strip()
                        if raw_str:
                            clean_str = raw_str.replace(',', '.')
                            current_counter = float(clean_str)
                            break
                    except Exception:
                        pass
            
            # --- Toner Logic ---
            toner_alerts = []
            toner_col_map = {
                'BK': ['toner_bk_pct', '%BK', 'BK'],
                'CY': ['toner_cy_pct', '%CY', 'CY'],
                'MG': ['toner_mg_pct', '%Mg', '%MG', 'MG'],
                'YW': ['toner_yw_pct', '%Yw', '%YW', 'YW'],
            }
            for color, col_keys in toner_col_map.items():
                for col_key in col_keys:
                    if col_key in row and row[col_key] not in ('', None):
                        val_str = str(row[col_key]).replace('%', '').strip()
                        try:
                            pct = float(val_str)
                            if pct <= 30:
                                toner_alerts.append(color)
                        except Exception:
                            pass
                        break
            
            # --- Stock Logic ---
            est_stock = 0
            suggestion_a4 = 0
            last_a4_info = last_a4_map.get(serie)
            
            status_summary = []
            
            if last_a4_info:
                # Formula: (Last_Qty * 500) - (Current_Counter - Last_Counter_at_Delivery)
                # Note: Last_Counter_at_Delivery is the counter WHEN delivered.
                # If counters are consistent:
                delta = current_counter - last_a4_info['counter']
                initial_stock = last_a4_info['qty'] * 500
                est_stock = initial_stock - delta
                
                # If negative, it means they consumed more than we sent (or counter jump).
                if est_stock < 0:
                    est_stock = 0
                
                # Check for suggestion
                # If est_stock is low (e.g., < 20% of a ream? or < 100 sheets?)
                # Or use legacy logic: Suggest if est_stock < X
                # Let's suggest if est_stock <= 1000 (2 reams) to be safe
                if est_stock <= 1000:
                    suggestion_a4 = 1 # Start with 1 ream
                    status_summary.append("Baixo Estoque")
            else:
                # No history, can't estimate. 
                # Maybe suggest based on average?
                pass
            
            # --- CSV Override Logic (Papel.csv) ---
            # If 'A4Resma' is present (from merged Papel.csv), use it as the source of truth for suggestion
            # This overrides the calculated logic if present > 0
            paper_suggestion = 0
            # Check standard key or suffix key (case insensitive handled by normalize but keys might vary)
            for key in ['A4Resma', 'A4Resma_papel', 'A4RESMA']:
                if key in row and pd.notna(row[key]):
                    try:
                        val = float(str(row[key]).replace(',', '.'))
                        if val > 0:
                            paper_suggestion = val
                            break
                    except Exception:
                        pass
            
            if paper_suggestion > 0:
                suggestion_a4 = paper_suggestion
                # If overwritten, we might want to ensure 'Baixo Estoque' status is NOT blindly added if logic says otherwise?
                # Actually, if suggestion > 0, we can assume it's needed.
                # But 'status_summary' is just labels.
                if "Baixo Estoque" not in status_summary:
                    # status_summary.append("Sugestão Planilha")
                    pass
            
            if toner_alerts:
                status_summary.append(f"Toner {','.join(toner_alerts)}")
            
            # --- Media/Avg Logic ---
            media_sheets = 0
            if 'MEDIA' in row:
                 try:
                     media_sheets = float(str(row['MEDIA']).replace(',', '.'))
                 except Exception:
                     pass
            
            # --- Construct Object ---
            def safe_num(v):
                if pd.isna(v):
                    return 0
                if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
                    return 0
                return v

            def safe_str(v):
                if pd.isna(v):
                    return ""
                return str(v)

            # Start with all fields from row (normalized)
            item = {k: v for k, v in row.items() if not pd.isna(v)}
            
            # Apply explicit overrides and naming consistency for frontend
            item.update({
                "Serie": safe_str(row.get('Serie', '')),
                "Modelo": safe_str(row.get('ModeloSimpress', '') or row.get('Modelo', '')),
                "Fila": safe_str(row.get('Fila', '')),
                "Local": f"{safe_str(row.get('LocalInstalacao', ''))} - {safe_str(row.get('RuaRef', ''))}",
                "LocalInstalacao": safe_str(row.get('LocalInstalacao', '')),
                "Rua": safe_str(row.get('RuaRef', '')),
                "Ramal": safe_str(row.get('Ramal', '')),
                "Contato": safe_str(row.get('ContatoSetor', '') or row.get('Contato', '')),
                "Contador_Atual": safe_num(current_counter),
                "Estoque_Estimado": int(safe_num(est_stock)),
                "Ultima_Entrega_A4": safe_str(last_a4_info['date']) if last_a4_info else "-",
                "Sugestao_A4": safe_num(suggestion_a4),
                "Toner_Alerts": toner_alerts,
                "TonerLevel_BK": safe_num(float(str(row.get('toner_bk_pct', row.get('%BK', 0))).replace('%','').strip() or 0)),
                "TonerLevel_CY": safe_num(float(str(row.get('toner_cy_pct', row.get('%CY', 0))).replace('%','').strip() or 0)),
                "TonerLevel_MG": safe_num(float(str(row.get('toner_mg_pct', row.get('%Mg', row.get('%MG', 0)))).replace('%','').strip() or 0)),
                "TonerLevel_YW": safe_num(float(str(row.get('toner_yw_pct', row.get('%Yw', row.get('%YW', 0)))).replace('%','').strip() or 0)),
                "Media_Mensal": safe_num(media_sheets),
                "Status_Calculado": ", ".join(status_summary) if status_summary else "OK"
            })
            results.append(item)
            
        return results

    def generate_protocols(self, selection: List[Dict[str, Any]], protocol_service: ProtocolService) -> List[str]:
        """
        Generate protocols for the selected items.
        'selection' is a list of objects with 'Serie', 'A4', 'TonerVal', etc.
        """
        created_ids = []
        for item in selection:
            # Prepare payload for ProtocolService.create
            # We assume the item dict has keys matching the Create Protocol schema or we map them.
            # Rota Proactive usually sets 'Solicitante'='Rota', 'Solicitacao'='Rota Proativa'
            
            payload = {
                "contract_id": self.contract_id, # Redundant if service has it, but safe
                "serie": item['Serie'],
                "solicitante": "Rota",
                "solicitacao": "Rota Proativa",
                "a4": item.get('A4', 0),
                "a3": item.get('A3', 0),
                "toner_bk": item.get('TonerBk', 0),
                "toner_cy": item.get('TonerCy', 0),
                "toner_mg": item.get('TonerMg', 0),
                "toner_yw": item.get('TonerYw', 0),
                "obs": "Gerado via Rota Proativa"
            }
            
            # Assuming ProtocolService.create returns the ID or object
            # We might need to handle 'email', 'telefone' fallback defaults
            # ProtocolService.create handles it?
            # Let's check ProtocolService.create signature. It takes 'data: dict'.
            
            try:
                # We need to ensure we don't duplicate pending protocols?
                # ProtocolService handles logic.
                res = protocol_service.create(payload)
                if res and 'protocol_id' in res:
                    created_ids.append(res['protocol_id'])
                elif res and 'id' in res: # Fallback support
                    created_ids.append(res['id'])
            except Exception:
                pass  # Skip failed individual protocol creation
                
        return created_ids

    def get_planning_summary(self) -> List[Dict[str, Any]]:
        """
        Returns a high-level planning summary for all routes.
        Calculates status, last delivery date, and days elapsed for the entire route.
        """
        routes = self.list_routes()
        if not routes:
            return []

        # 1. Load Entregas efficiently to find last delivery per Serie
        df_entregas = database.load_entregas(self.contract_id)
        
        # Use Adapter
        from .. import adapters
        if not df_entregas.empty:
            df_entregas = pd.DataFrame(adapters.normalize_dataframe(df_entregas))
        
        last_date_map = {}
        if not df_entregas.empty:
            # Optimize: Convert Date once
            if 'DataEntrega' in df_entregas.columns:
                df_entregas['DataEntrega_Dt'] = pd.to_datetime(df_entregas['DataEntrega'], dayfirst=True, errors='coerce')
                # Group by Serie and get max date
                # Normalize serie logic
                def normalize(s): return str(s).strip().upper() if pd.notna(s) else ""
                df_entregas['Serie_Norm'] = df_entregas['Serie'].apply(normalize)
                
                # We need the max date per serie
                max_dates = df_entregas.groupby('Serie_Norm')['DataEntrega_Dt'].max()
                last_date_map = max_dates.to_dict()

        # Load Settings & Metadata
        settings = self.load_settings()
        metadata = self.load_metadata()
        
        cycle_threshold = settings.get("cycle_days_threshold", 26)
        
        summary = []
        today = datetime.now()

        for route in routes:
            series = [str(s).strip().upper() for s in route.get('series', [])]
            name_key = route['name'].lower()
            route_meta = metadata.get(name_key, {})
            
            # Check delivery status for EACH machine
            valid_deliveries = 0
            total_series = len(series)
            
            # For general route "Last Delivery" display, we still probably want the most recent activity?
            # Or the oldest? Let's keep showing the most recent activity as "Last Delivery",
            # but the STATUS depends on completion.
            
            route_max_date = None
            
            for s in series:
                d = last_date_map.get(s)
                if d and pd.notna(d):
                    # Check Max Date (for display)
                    if route_max_date is None or d > route_max_date:
                        route_max_date = d
                    
                    # Check Validity (for status)
                    elapsed = (today - d).days
                    if elapsed < cycle_threshold:
                        valid_deliveries += 1
            
            days_elapsed = None
            last_delivery_str = "-"
            
            if route_max_date:
                days_elapsed = (today - route_max_date).days
                last_delivery_str = route_max_date.strftime("%d/%m/%Y")
            
            # Status Logic
            if total_series == 0:
                status = "Vazia"
                status_color = "gray"
            elif valid_deliveries == total_series:
                status = "Entrega Realizada"
                status_color = "green"
            elif valid_deliveries > 0:
                status = f"Parcial ({valid_deliveries}/{total_series})"
                status_color = "yellow" # Frontend handles traffic light via dynamic class or explicit map?
                # Backend sends "yellow", frontend currently maps: green, red, gray. 
                # Need to update frontend to handle "yellow" or map "yellow" to "red" if strict?
                # User wants "Realizada" ONLY if full. So "Parcial" is NOT realized.
                # Let's send "yellow" and update frontend to support it or fallback to gray.
            else:
                if days_elapsed is not None:
                     status = f"Alerta (> {days_elapsed} dias)"
                     status_color = "red"
                else:
                     status = "Sem entregas"
                     status_color = "gray"
                    
            # Metadata Overrides
            scheduled_date = route_meta.get("scheduled_date", "")
            if scheduled_date:
                # If scheduled, maybe show blue status?
                pass

            
            summary.append({
                "name": route['name'],
                "series_count": len(series),
                "last_delivery": last_delivery_str,
                "last_delivery_iso": route_max_date.isoformat() if route_max_date else None,
                "days_elapsed": days_elapsed if days_elapsed is not None else -1,
                "status": status,
                "status_color": status_color,
                "data_agendada": scheduled_date,
                "notes": route_meta.get("notes", "")
            })
            
        # Sort by days elapsed desc (priority)
        summary.sort(key=lambda x: x['days_elapsed'], reverse=True)
        return summary
