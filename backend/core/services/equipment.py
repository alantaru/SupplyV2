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
        Search for equipment in Mapa by Fila or Serie.
        """
        df_mapa = database.load_mapa(self.contract_id)
        if df_mapa.empty:
            return []
            
        term = str(term).strip().lower()
        if len(term) < 1:
            return []

        # Use Adapter for normalization EARLY
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
            
        # Normalize the whole DF to get canonical keys (Fila, Serie, etc.)
        normalized_all = adapters.normalize_dataframe(df_mapa)
        df_norm = pd.DataFrame(normalized_all)
        
        if df_norm.empty:
            return []
            
        # Ensure we have Fila and Serie keys
        if 'Fila' not in df_norm.columns or 'Serie' not in df_norm.columns:
            return []

        def safe_str(val):
            return str(val).strip().lower() if pd.notna(val) else ""

        # Search on Canonical Keys + some fallback fields that might be in the normalized dicts
        mask = (
            df_norm['Fila'].apply(safe_str).str.contains(term) | 
            df_norm['Serie'].apply(safe_str).str.contains(term)
        )
        
        # Optional check for IP or other fields that might be present
        for col in ['IP', 'ModeloSimpress', 'LocalInstalacao']:
            if col in df_norm.columns:
                mask = mask | df_norm[col].apply(safe_str).str.contains(term)
                
        matches = df_norm[mask]
        
        if matches.empty:
            return []
            
        # Limit to 50 results
        matches = matches.head(50)
        
        # Search returns a specific subset for the dropdown
        results = []
        for _, row in matches.iterrows():
            results.append({
                "Serie": row.get('Serie', ''),
                "Fila": row.get('Fila', ''),
                "Modelo": row.get('ModeloSimpress', ''), 
                "Status": row.get('Status', ''), # Mixed case is fine for frontend
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
        
        # Use Adapter
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        normalized_results = adapters.normalize_dataframe(df_mapa)
        
        results = []
        for row in normalized_results:
            results.append({
                "Serie": row.get('Serie', ''),
                "Fila": row.get('Fila', ''),
                "Modelo": row.get('ModeloSimpress', ''), 
                "Status": row.get('STATUS', ''),
                "Empresa": row.get('Empresa', ''),
                "Cidade": row.get('Cidade', ''),
                "Local": row.get('LocalInstalacao', ''),
                "Contato": row.get('Contato', ''),
                "Ramal": row.get('Ramal', '')
            })
            
        return results

    def get_details(self, serie: str) -> Optional[Dict[str, Any]]:
        """
        Get full equipment details including counters and suggestions.
        """
        df_mapa = database.load_mapa(self.contract_id)
        if 'SERIE' not in df_mapa.columns and 'Serie' in df_mapa.columns:
            df_mapa.rename(columns={'Serie': 'SERIE'}, inplace=True)

        if df_mapa.empty or 'SERIE' not in df_mapa.columns:
            return None
        
        try:
            from .. import adapters
        except (ImportError, ValueError):
            from core import adapters
        df_mapa = pd.DataFrame(adapters.normalize_dataframe(df_mapa))
        
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
        try:
            df = database.load_contadores(self.contract_id)
        except Exception:
            return {}
            
        if df.empty:
            return {}
        
        # Determine Serie Col
        col_serie = 'SERIE' if 'SERIE' in df.columns else 'Serie'
        if col_serie not in df.columns:
            return {}
            
        # Use Adapter for consistent normalization
        from .. import adapters
        serie_norm = adapters.normalize_serie(serie)
        df['Serie_Norm'] = df[col_serie].apply(adapters.normalize_serie)
        
        match = df[df['Serie_Norm'] == serie_norm]
        if match.empty:
            return {}
            
        row = match.iloc[0]
        def safe_val(val): return val if pd.notna(val) else ""
        
        counter = 0
        try:
            # Try canonical TOTAL first, then legacy variants (case-insensitive)
            col_map_upper = {c.upper(): c for c in row.index}
            for candidate in ['TOTAL', 'E&C COUNTER TOTAL', 'EQA4 COUNTER TOTAL']:
                actual = col_map_upper.get(candidate.upper())
                if actual and pd.notna(row.get(actual)):
                    counter = int(float(str(row[actual]).replace(',', '.')))
                    break
        except Exception:
            pass

        return {
            "counter_total": counter,
            "toner_bk_pct": safe_val(row.get('%BK')),
            "toner_cy_pct": safe_val(row.get('%CY')),
            "toner_mg_pct": safe_val(row.get('%Mg') or row.get('%MG')), # Case variance
            "toner_yw_pct": safe_val(row.get('%Yw') or row.get('%YW'))
        }

    def _get_paper_data(self, serie: str) -> Dict[str, Any]:
        try:
            df = database.load_papel(self.contract_id)
        except Exception:
            return {}
            
        col_serie = 'SERIE' if 'SERIE' in df.columns else 'Serie'
        if df.empty or col_serie not in df.columns:
            return {}
            
        # Use col_serie found earlier
        # Use Adapter for consistent normalization
        from .. import adapters
        serie_norm = adapters.normalize_serie(serie)
        df['Serie_Norm'] = df[col_serie].apply(adapters.normalize_serie)
        
        match = df[df['Serie_Norm'] == serie_norm]
        if match.empty:
            return {}
            
        row = match.iloc[0]
        return {
            "media_sheets": self._parse_br_float(row.get('MEDIA', 0)),
            "a4_resma": self._parse_br_float(row.get('A4RESMA', 0))
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
        """
        df = database.load_mapa(self.contract_id)
        if df.empty:
            return []

        # Mapping common UI names to internal CSV columns
        # Mapping common UI names to internal CSV columns (Use Canonical UPPER)
        mapping = {
            'Cidade': 'CIDADE',
            'Status': 'STATUS', 
            'Modelo': 'MODELOSIMPRESS',
            'ModeloSimpress': 'MODELOSIMPRESS',
            'Fila': 'FILA',
            'Empresa': 'EMPRESA',
            'Rua': 'RUAREF',
            'RuaRef': 'RUAREF',
            'Planta': 'PLANTAINSTALADA',
            'PlantaInstalada': 'PLANTAINSTALADA',
            'Setor': 'AREA',
            'Area': 'AREA',
            'Contrato': 'CONTRATO'
        }
        
        # Helper to get internal col name
        def get_col(f):
            # First direct map
            c = mapping.get(f, f)
            if c in df.columns:
                return c
            
            # Try upper (Canonical)
            if c.upper() in df.columns:
                return c.upper()
            
            # Try finding case-insensitive match
            for col in df.columns:
                if col.upper() == c.upper():
                    return col
            return None

        # 1. Apply Filters
        if current_filters:
            # Group by field
            field_groups = {}
            for f in current_filters:
                k = f.get('field')
                v = f.get('value')
                if not k or not v:
                    continue
                if k not in field_groups:
                    field_groups[k] = []
                field_groups[k].append(v)
            
            # Apply groups (AND between groups)
            for f_key, vals in field_groups.items():
                col_name = get_col(f_key)
                if not col_name:
                    continue
                
                # OR within group
                # Filter df to rows where col_name is in vals
                # Use str comparison for safety
                mask = df[col_name].astype(str).isin([str(v) for v in vals])
                df = df[mask]
                
        if df.empty:
            return []
        
        # 2. Get Targets
        target_col = get_col(field)
        
        if not target_col:
            return []
            
        # Get unique, non-null values
        values = df[target_col].dropna().astype(str).unique().tolist()
        values = [v for v in values if v.strip()] # Remove empty strings
        values.sort()
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
