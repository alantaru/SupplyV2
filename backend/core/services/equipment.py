from typing import Dict, Any, List, Optional
import pandas as pd
try:
    from ... import database
except (ImportError, ValueError):
    import database

class EquipmentService:
    def __init__(self, contract_id: str):
        self.contract_id = contract_id

    def search(self, term: str) -> List[Dict[str, Any]]:
        """
        Search for equipment in Mapa by Fila or Serie (Optimized with Caching).
        """
        term = str(term).strip().lower()
        if len(term) < 1:
            return []

        # Use load_normalized which is now cached
        df_norm = database.load_normalized("MAPA", self.contract_id)
        
        if df_norm.empty:
            return []
            
        # Search on Canonical Keys (Vectorized for speed)
        # We search across Fila, Serie, IP, and Modelo/ModeloSimpress
        search_cols = ['Fila', 'Serie', 'IP', 'ModeloSimpress', 'Modelo', 'LocalInstalacao']
        available_cols = [c for c in search_cols if c in df_norm.columns]
        
        if not available_cols:
            return []
            
        mask = pd.Series(False, index=df_norm.index)
        for col in available_cols:
            mask |= df_norm[col].astype(str).str.lower().str.contains(term, na=False)
                
        matches = df_norm[mask].head(50)
        
        if matches.empty:
            return []
            
        # Search returns a specific subset for the dropdown
        results = []
        for _, row in matches.iterrows():
            # Standardize on 'Modelo' for the frontend wizard
            results.append({
                "Serie": row.get('Serie', ''),
                "Fila": row.get('Fila', ''),
                "Modelo": row.get('ModeloSimpress', '') or row.get('Modelo', ''), 
                "Status": row.get('Status', ''),
                "Local": row.get('LocalInstalacao', '')
            })
            
        return results

    def get_all(self) -> List[Dict[str, Any]]:
        """
        Get all equipment for inventory export.
        """
        df_mapa = database.load_mapa(self.contract_id)
        if df_mapa.empty:
            return []
        
        df_mapa = df_mapa.fillna("")
        
        # Use load_normalized
        normalized_results = database.load_normalized("MAPA", self.contract_id).to_dict(orient='records')
        
        results = []
        for row in normalized_results:
            results.append({
                "Serie": row.get('Serie', ''),
                "Fila": row.get('Fila', ''),
                "Modelo": row.get('ModeloSimpress', ''), 
                "Status": row.get('Status', ''),
                "Empresa": row.get('Empresa', ''),
                "Cidade": row.get('Cidade', ''),
                "Local": row.get('LocalInstalacao', ''),
                "Contato": row.get('ContatoSetor', ''),
                "Ramal": row.get('Ramal', '')
            })
            
        return results

    def get_inventory_enriched(self) -> List[Dict[str, Any]]:
        """
        Returns MAPA rows enriched with toner data from Contadores.
        Uses unified normalization for both.
        """
        df_mapa = database.load_normalized("MAPA", self.contract_id)
        df_cnt = database.load_normalized("CONTADORES", self.contract_id)

        if df_mapa.empty:
            return []

        # Build toner lookup from normalized Contadores
        toner_lookup = {}
        if not df_cnt.empty:
            for _, row in df_cnt.iterrows():
                serie = row.get('Serie', '')
                if not serie:
                    continue
                toner_lookup[serie] = {
                    'toner_bk': row.get('toner_bk_pct', ''),
                    'toner_cy': row.get('toner_cy_pct', ''),
                    'toner_mg': row.get('toner_mg_pct', ''),
                    'toner_yw': row.get('toner_yw_pct', ''),
                }

        # Enrich MAPA rows
        records = df_mapa.to_dict(orient='records')
        for row in records:
            serie = row.get('Serie', '')
            toner = toner_lookup.get(serie, {})
            row.update({
                'toner_bk': toner.get('toner_bk', ''),
                'toner_cy': toner.get('toner_cy', ''),
                'toner_mg': toner.get('toner_mg', ''),
                'toner_yw': toner.get('toner_yw', ''),
            })
            # Fallback for localization
            if not str(row.get('LocalInstalacao', '')).strip():
                row['LocalInstalacao'] = row.get('RuaRef', '')

        return records

    def get_details(self, serie: str) -> Optional[Dict[str, Any]]:
        """
        Get full equipment details including counters and suggestions.
        """
        df_mapa = database.load_normalized("MAPA", self.contract_id)

        if df_mapa.empty or 'Serie' not in df_mapa.columns:
            return None
        
        # After normalization, 'SERIE' becomes 'Serie' (Canonical)
        mask = df_mapa['Serie'].astype(str).str.contains(serie, case=False, na=False)
        match = df_mapa[mask]
        
        if match.empty:
            return None
            
        try:
            last_delivery_data = self._get_last_delivery_data_enhanced(serie)
        except Exception:
            last_delivery_data = {}
            return None
            
        match = match.fillna("")
        raw_row = match.iloc[0].to_dict()
        
        # Use Adapter to normalize
        from .. import adapters
        equip_row = adapters.normalize_row(raw_row)
        
        # LocalInstalacao / RuaRef fallback: se um está vazio, usar o outro
        local = str(equip_row.get('LocalInstalacao', '')).strip()
        rua = str(equip_row.get('RuaRef', '')).strip()
        if not local and rua:
            equip_row['LocalInstalacao'] = rua
        elif not rua and local:
            equip_row['RuaRef'] = local
        
        usiminas_data = self._get_contadores_data(serie)
        papel_data = self._get_paper_data(serie)
        
        last_delivery_data = {}
        try:
            last_delivery_data = self._get_last_delivery_data_enhanced(serie)
        except Exception:
            last_delivery_data = {}
            
        usiminas_data['history_data'] = last_delivery_data # Inject history for fallback logic
        
        # Determine if color equipment
        is_color = self._detect_color_equipment(equip_row, usiminas_data)
        
        # Use shared logic
        try:
            from ... import logic_suggestions
        except (ImportError, ValueError):
            import logic_suggestions
        supplies_calc = logic_suggestions._calculate_suggestions(serie, usiminas_data, papel_data, is_color)
        
        # Capture History
        history = self._get_equipment_history(serie)
        
        return {
            "equipment": equip_row,
            "counters": usiminas_data,
            "papel_stats": papel_data,
            "last_delivery": last_delivery_data,
            "history": history,
            "suggestion": supplies_calc,
            "is_color": is_color
        }

    def get_by_route(self, route_name: str) -> List[Dict[str, Any]]:
        df_mapa = database.load_mapa(self.contract_id)
        if df_mapa.empty:
            return []
            
        route_name = str(route_name).strip().lower()
        def match_route(val):
            return route_name in str(val).lower()

        mask = pd.Series(False, index=df_mapa.index)
        if 'RuaRef' in df_mapa.columns:
            mask |= df_mapa['RuaRef'].apply(match_route)
        if 'LocalInstalacao' in df_mapa.columns:
            mask |= df_mapa['LocalInstalacao'].apply(match_route)
            
        matches = df_mapa[mask]
        matches = matches.fillna("")
        
        from .. import adapters
        matches = pd.DataFrame(adapters.normalize_dataframe(matches))
        
        return matches.to_dict(orient="records")

    def get_proactive_routes(self) -> List[Dict[str, Any]]:
        df = database.load_rotas(self.contract_id)
        if df.empty:
            return []
        if 'Status' not in df.columns:
            return []
        alerts = df[df['Status'].notna() & (df['Status'].astype(str).str.strip() != '')]
        return alerts.fillna("").to_dict(orient="records")

    # --- Private Helpers ---

    def _get_contadores_data(self, serie: str) -> Dict[str, Any]:
        df = database.load_normalized("CONTADORES", self.contract_id)
            
        if df.empty or 'Serie' not in df.columns:
            return {}
        
        match = df[df['Serie'] == serie]
        if match.empty:
            return {}
            
        row = match.iloc[0]
        def safe_val(val): return val if pd.notna(val) else ""
        
        counter = 0
        try:
            # Post-normalization column names are TitleCase but Contadores special fields are toner_...
            # The total counter should be mapped to 'ContadorTotal' if we added it, but let's check.
            # Currently adapters.py doesn't map 'TOTAL' to 'ContadorTotal'. I should add it.
            counter = int(float(str(row.get('ContadorTotal', 0)).replace(',', '.')))
        except Exception:
            pass

        return {
            "counter_total": counter,
            "toner_bk_pct": safe_val(row.get('toner_bk_pct')),
            "toner_cy_pct": safe_val(row.get('toner_cy_pct')),
            "toner_mg_pct": safe_val(row.get('toner_mg_pct')),
            "toner_yw_pct": safe_val(row.get('toner_yw_pct'))
        }

    def _get_paper_data(self, serie: str) -> Dict[str, Any]:
        df = database.load_normalized("PAPEL", self.contract_id)
            
        if df.empty or 'Serie' not in df.columns:
            return {}
            
        match = df[df['Serie'] == serie]
        if match.empty:
            return {}
            
        row = match.iloc[0]
        return {
            "media_sheets": self._parse_br_float(row.get('MediaSheets', 0)),
            "a4_resma": self._parse_br_float(row.get('A4Resma', 0))
        }

    def _parse_br_float(self, val):
        if pd.isna(val) or val == '':
            return 0.0
        s = str(val).strip().replace('.', '').replace(',', '.')
        try:
            return float(s)
        except Exception:
            return 0.0

    def _calculate_suggestions(self, serie, usiminas_data, papel_data) -> Dict[str, Any]:
        suggestions = {
            "resmas": 0, "toner_bk": 0, "toner_cy": 0, "toner_mg": 0, "toner_yw": 0
        }
        import math
        
        if papel_data:
            if 'a4_resma' in papel_data and papel_data['a4_resma'] > 0:
                suggestions["resmas"] = int(papel_data['a4_resma'])
            elif 'media_sheets' in papel_data and papel_data['media_sheets'] > 0:
                suggestions["resmas"] = math.ceil(papel_data['media_sheets'] / 500.0)
            if suggestions["resmas"] == 0:
                suggestions["resmas"] = 1

        def check_toner(key_pct):
            val_str = str(usiminas_data.get(key_pct, '')).replace('%', '').strip()
            try:
                return 1 if float(val_str) <= 30 else 0
            except Exception:
                return 0
                
        suggestions['toner_bk'] = check_toner('toner_bk_pct')
        suggestions['toner_cy'] = check_toner('toner_cy_pct')
        suggestions['toner_mg'] = check_toner('toner_mg_pct')
        suggestions['toner_yw'] = check_toner('toner_yw_pct')
        return suggestions

    def _detect_color_equipment(self, equipment: Dict[str, Any], counters: Dict[str, Any]) -> bool:
        """
        Detect if equipment is color based on (in priority order):
        1. Presence of color toner percentages in counter data
        2. TipodoEquipamento field from MAPA (contains 'Color')
        3. Model name heuristics (contains 'C', 'Color', etc.)
        
        Legacy VBA approach: Check tabModelos.Tipo = "Color"
        Modern approach: If %CY, %Mg, or %Yw are present and not empty, it's likely color.
        """
        # Priority 1: Check if counter data has color toner values
        cy = str(counters.get('toner_cy_pct', '')).strip()
        mg = str(counters.get('toner_mg_pct', '')).strip()
        yw = str(counters.get('toner_yw_pct', '')).strip()
        
        # If any color toner value exists and is not empty/zero, it's color
        def has_value(val):
            if not val or val in ['', '0', '0%']:
                return False
            # Check if it's a valid percentage number
            try:
                num = float(val.replace('%', '').strip())
                return num > 0
            except Exception:
                return bool(val)
        
        if has_value(cy) or has_value(mg) or has_value(yw):
            return True
        
        # Priority 2: Check TipodoEquipamento field from MAPA
        # Values like "Multifuncional Color", "Impressora Color" indicate color equipment
        tipo_equipamento = str(equipment.get('TipodoEquipamento', '') or '').upper()
        if 'COLOR' in tipo_equipamento or 'COR' in tipo_equipamento:
            return True
        
        # Priority 3: Fallback to model name heuristics
        model = str(equipment.get('ModeloSimpress', '') or equipment.get('Modelo', '')).upper()
        
        # Known color model patterns
        color_patterns = [
            'C405', 'C7020', 'C7025', 'C7030', 'C8000', 'C9000', 
            'E7860', 'E77660', 'E77650', 'C230', 'C235', 'C400',
            'COLOR', 'CLR', 'MFP-C', 'MPC', 'IRC', 'C60', 'C70', 'C75',
            'VERSALINK C', 'ALTALINK C', 'WORKCENTRE 7', 'PHASER 7'
        ]
        
        for pattern in color_patterns:
            if pattern in model:
                return True
        
        # Additional heuristic: Model starts with 'C' followed by digit
        import re
        if re.match(r'^C\d', model):
            return True
        
        return False

    def get_dashboard_trends(self) -> Dict[str, Any]:
        """
        Calculate dashboard statistics for equipment.
        """
        df_mapa = database.load_mapa(self.contract_id)
        if df_mapa.empty:
            return {
                "total": 0,
                "status_dist": [],
                "model_dist": [],
                "city_dist": []
            }

        # Safe fillNA
        df_mapa = df_mapa.fillna("")
        
        # Helper to find column robustly
        def get_col_robust(keys):
            for k in keys:
                # Direct match
                if k in df_mapa.columns:
                    return k
                # Case insensitive
                for col in df_mapa.columns:
                    if col.upper().replace(' ', '').replace('_', '') == k.upper().replace(' ', '').replace('_', ''):
                        return col
            return None

        # 1. Total
        total = len(df_mapa)
        
        # 2. Status Distribution (Top 10)
        col_status = get_col_robust(['STATUS', 'SITUAÇÃO'])
        if col_status:
            status_counts = df_mapa[col_status].value_counts().head(10).to_dict()
            status_dist = [{"name": str(k), "value": int(v)} for k, v in status_counts.items()]
        else:
            status_dist = []
            
        # 3. Model Distribution (Top 10)
        col_model = get_col_robust(['MODELOSIMPRESS', 'MODELOSIM', 'MODELO'])
        if col_model:
            model_counts = df_mapa[col_model].value_counts().head(10).to_dict()
            model_dist = [{"name": str(k), "value": int(v)} for k, v in model_counts.items()]
        else:
            model_dist = []
            
        # 4. City Distribution (Top 10)
        col_city = get_col_robust(['CIDADE', 'CITY', 'LOCALIDADE'])
        if col_city:
            city_counts = df_mapa[col_city].value_counts().head(10).to_dict()
            city_dist = [{"name": str(k), "value": int(v)} for k, v in city_counts.items()]
        else:
            city_dist = []
            
        return {
            "total": total,
            "status_dist": status_dist,
            "model_dist": model_dist,
            "city_dist": city_dist
        }

    def get_unique_values(self, field: str, current_filters: List[Dict[str, Any]] = None) -> List[str]:
        """
        Get unique sorted values for a specific field in MAPA,
        filtered by current_filters (Context-Aware / Cascading).
        Logic: OR within same field, AND between different fields.

        Operates on the NORMALIZED dataframe so column names and values
        are consistent with what the frontend displays.
        """
        df_raw = database.load_mapa(self.contract_id)
        if df_raw.empty:
            return []

        # Normalize through the adapter pipeline — same as every other view
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters

        normalized = adapters.normalize_dataframe(df_raw)
        if not normalized:
            return []
        df = pd.DataFrame(normalized)

        # Canonical field names after normalization (adapter output keys)
        # Maps UI field name → normalized DataFrame column name
        FIELD_MAP = {
            'Cidade':          'Cidade',
            'Status':          'Status',
            'Modelo':          'ModeloSimpress',
            'ModeloSimpress':  'ModeloSimpress',
            'Fila':            'Fila',
            'Empresa':         'Empresa',
            'Rua':             'RuaRef',
            'RuaRef':          'RuaRef',
            'Planta':          'PlantaInstalada',
            'PlantaInstalada': 'PlantaInstalada',
            'Setor':           'Area',
            'Area':            'Area',
            'Contrato':        'Contrato',
        }

        def resolve_col(f: str) -> Optional[str]:
            """Find the actual column in df for a given UI field name."""
            canonical = FIELD_MAP.get(f, f)
            # Exact match
            if canonical in df.columns:
                return canonical
            # Case-insensitive fallback
            for col in df.columns:
                if col.upper() == canonical.upper():
                    return col
            return None

        # 1. Apply cascade filters (AND between fields, OR within same field)
        if current_filters:
            field_groups: Dict[str, List[str]] = {}
            for flt in current_filters:
                k = flt.get('field', '').strip()
                v = str(flt.get('value', '')).strip()
                if k and v:
                    field_groups.setdefault(k, []).append(v)

            for f_key, vals in field_groups.items():
                col_name = resolve_col(f_key)
                if not col_name:
                    continue  # Unknown field — skip silently
                # OR within group: keep rows where column value is in vals (case-insensitive)
                vals_lower = {v.lower() for v in vals}
                mask = df[col_name].astype(str).str.strip().str.lower().isin(vals_lower)
                df = df[mask]
                if df.empty:
                    return []

        # 2. Get unique values for the requested field
        target_col = resolve_col(field)
        if not target_col:
            return []

        values = (
            df[target_col]
            .dropna()
            .astype(str)
            .str.strip()
            .unique()
            .tolist()
        )
        values = [v for v in values if v and v.lower() not in ('nan', 'none', '')]
        values.sort(key=lambda x: x.lower())
        return values
        
    def _get_last_delivery_data_enhanced(self, serie: str) -> Dict[str, Any]:
        """
        Fetch last delivery data for A4/Toner.
        Used for fallback suggestion logic.
        """
        try:
            df = database.load_entregas(self.contract_id)
        except Exception:
            return {}
            
        if df.empty or 'Serie' not in df.columns:
            return {}
            
        # Use Adapter for consistent lookup
        from .. import adapters
        serie_norm = adapters.normalize_serie(serie)
        df['Serie_Norm'] = df['Serie'].apply(adapters.normalize_serie)
        matches = df[df['Serie_Norm'] == serie_norm].copy()
        
        if matches.empty:
            return {}
            
        # Sort by Date
        if 'DataEntrega' in matches.columns:
            matches['DataEntrega'] = pd.to_datetime(matches['DataEntrega'], dayfirst=True, errors='coerce')
            matches = matches.sort_values('DataEntrega', ascending=False)
            
        # Find last A4 delivery
        # Expect 'A4' column (qty) and 'ContadorFinal' (counter at delivery) or 'ContFinal'
        last_a4 = {}
        
        # Determine counter col
        counter_col = 'ContFinal' if 'ContFinal' in matches.columns else 'ContadorFinal'
        
        # Scan for first row with A4 > 0
        for _, row in matches.iterrows():
            try:
                a4_qty = int(float(str(row.get('A4', 0)).replace(',', '.')))
                if a4_qty > 0:
                    # Found it
                    counter_val = 0
                    if counter_col in row and pd.notna(row[counter_col]):
                         counter_val = int(float(str(row[counter_col]).replace(',', '.')))
                    
                    last_a4 = {
                        'date': row.get('DataEntrega'),
                        'qty': a4_qty,
                        'counter': counter_val
                    }
                    break
            except Exception:
                continue
                
        return last_a4

    def _get_equipment_history(self, serie: str) -> List[Dict[str, Any]]:
        """
        Fetch all past deliveries for the machine.
        """
        try:
            df = database.load_entregas(self.contract_id)
        except Exception:
            return []
            
        if df.empty or 'Serie' not in df.columns:
            return []
            
        # Use Adapter for consistent lookup
        from .. import adapters
        serie_norm = adapters.normalize_serie(serie)
        df['Serie_Norm'] = df['Serie'].apply(adapters.normalize_serie)
        matches = df[df['Serie_Norm'] == serie_norm].copy()
        
        if matches.empty:
            return []
            
        # Sort by Date desc
        if 'DataEntrega' in matches.columns:
             matches['DataEntrega_Dt'] = pd.to_datetime(matches['DataEntrega'], dayfirst=True, errors='coerce')
             matches = matches.sort_values('DataEntrega_Dt', ascending=False)
             # Drop temp col
             matches = matches.drop(columns=['DataEntrega_Dt'])
        
        # Replace NaN with empty string for JSON serialization
        matches = matches.fillna("")
        
        # Return list of dicts
        return matches.to_dict(orient="records")
