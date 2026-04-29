
import pandas as pd
import logging
import difflib
from typing import Dict, List
from .cortex import RefineryCortex
from .ingestor import _normalize_for_matching

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RefineryMapper:
    """
    Layer 2: The 'Smart Mapper'
    Responsible for:
    1. Mapping input columns to Canonical Schema.
    2. Fuzzy matching for unknown columns.
    3. Type casting hints based on canonical schema.
    """

    # The "Perfect" Schema we want to achieve
    # IMPORTANT: Order matters! More specific canonicals must come BEFORE generic ones
    # to avoid the generic one stealing the match first.
    CANONICAL_SCHEMA = {
        "MAPA": {
            # ── Required ──────────────────────────────────────────────────────
            "serie": [
                "serie", "serial", "s/n", "num_serie", "serial number",
                "serial no", "sn", "nº de série", "n. de serie",
                "numeroserie", "asset", "assetid", "servicetag",
                "numero de serie", "n serie",
            ],
            # ── Specific fields BEFORE generic ones ───────────────────────────
            # modelosimpress BEFORE modelo (to avoid modelo stealing 'Modelo Simpress')
            "modelosimpress": [
                "modelo simpress", "modelosimpress", "modelo_simpress",
            ],
            # fila BEFORE hostname (to avoid hostname stealing 'HOST NAME')
            "fila": [
                "fila", "queue", "nomefila", "printqueue",
                "nome_fila", "fila_impressao", "host name", "hostname",
            ],
            # plantainstalada BEFORE data_instalacao (to avoid data_instalacao stealing 'Planta Instalada')
            "plantainstalada": [
                "planta instalada", "plantainstalada", "planta", "plant",
                "unidade", "facility",
            ],
            # centrodecusto BEFORE setor (to avoid setor stealing 'Centro de Custo')
            "centrodecusto": [
                "centro de custo", "centrodecusto", "centro_custo",
                "cost center", "cc",
            ],
            # ── Generic fields ────────────────────────────────────────────────
            "modelo": [
                "modelo", "model", "equipamento", "tipo_equipamento",
                "modelo equip", "modelnumber", "modelo_numero", "modelo numero",
            ],
            "marca": ["marca", "brand", "fabricante", "manufacturer"],
            "valor": [
                "valor", "custo", "locacao", "valor_locacao", "preco",
                "vlr unit.", "locacao valor", "locação valor",
                "valor locacao", "valor de locacao",
            ],
            "status": [
                "status", "estado", "situacao", "status_device",
                "status rede", "situação",
            ],
            "ip": ["ip", "ip_address", "endereco_ip", "tcp/ip", "ip address"],
            "hostname": [
                "hostname", "host", "nome_rede", "nome de rede",
            ],
            "contrato": [
                "contrato", "contract", "nº contrato",
                "numero contrato", "contrato ",
            ],
            "empresa": [
                "empresa", "company", "cliente",
                "razao social", "razão social",
            ],
            "endereco": [
                "endereco", "logradouro", "endereco completo",
                "enderecocompleto", "address", "location", "endereço",
            ],
            "cidade": ["cidade", "city", "municipio", "município"],
            "uf": ["uf", "estado_uf", "state", "estado"],
            "cep": ["cep", "zip", "cep postal"],
            "setor": [
                "setor", "area", "departamento",
                "setor/area", "área", "area setor",
            ],
            "observacao": [
                "observacao", "obs", "nota", "comentario",
                "description", "observação", "observacoes", "observações",
            ],
            "usuario": ["usuario", "responsavel", "gestor"],
            "data_instalacao": [
                "data_instalacao", "instalado_em", "data_ativacao",
                "data_inst", "data install",
                "data de instalacao", "data de instalação corporate",
                "data instalacao corporate", "data de instalação",
            ],
            "data_atualizacao": [
                "data_atualizacao", "ultimo_scan", "monitorado_em",
                "data ultima atualizacao inv", "data ultima atualização inv",
                "data ultima atualizacao", "data ultima alteracao",
                "data ultima alteração",
            ],
            "contatosetor": [
                "contato setor", "contato_setor", "contatosetor",
            ],
            "ramal": [
                "ramal", "telefone", "extension",
                "ramal/telefone", "ramal telefone",
            ],
            "localinstalacao": [
                "local instalacao", "local instalação", "localinstalacao",
                "local_instalacao", "local de instalacao",
                "local de instalação", "local instalação",
                "local instalation", "installation location",
                "local",  # short form — low priority but valid
            ],
            "ruaref": [
                "rua / ref", "rua/ref", "ruaref", "rua ref",
                "rua_ref", "street", "rua",
            ],
            "horario": ["horario", "horário", "turno", "shift", "hora"],
            "almoxarifado": [
                "almoxarifado", "warehouse", "almox", "estoque_local",
            ],
            "gerencia": [
                "gerencia", "gerência", "diretoria",
                "vice presidencia", "vp", "management",
            ],
        },
        "CONTADORES": {
            "serie": ["serie", "serial", "num_serie", "equipamento"],
            "total": [
                "total", "contador", "contador_geral", "total_counter",
                "life_count", "contador total", "counter", "totalcounter",
                "contador_total", "e&c counter total", "eqa4 counter total",
            ],
            "data": [
                "data", "date", "leitura", "timestamp", "read_at",
                "data_coleta", "data leitura", "data_leitura", "last scan date",
            ],
            "contador_mono": [
                "mono", "pb", "preto_branco", "mono_counter",
                "contador pb", "contador mono",
            ],
            "contador_color": [
                "color", "cor", "colorido", "color_counter",
                "contador cor", "contador colorido",
            ],
        },
        "PAPEL": {
            "serie": ["serie", "serial", "equipamento"],
            "data_troca": ["data", "troca", "substituicao", "data troca"],
            "nivel_toner_preto": [
                "toner_preto", "black_level", "k_level", "preto", "toner k",
            ],
            "nivel_toner_cyan": [
                "toner_cyan", "cyan_level", "c_level", "cyan", "toner c",
            ],
            "nivel_toner_magenta": [
                "toner_magenta", "magenta_level", "m_level", "magenta", "toner m",
            ],
            "nivel_toner_yellow": [
                "toner_yellow", "yellow_level", "y_level", "yellow", "toner y",
            ],
            "meta_papel": ["meta", "meta_papel", "target", "meta mensal"],
        },
    }

    def __init__(self, data_type: str = "MAPA"):
        self.data_type = data_type.upper()
        if self.data_type not in self.CANONICAL_SCHEMA:
            raise ValueError(f"Unknown data type: {self.data_type}")
        
        self.schema = self.CANONICAL_SCHEMA[self.data_type]
        self.column_mapping = {}
        self.cortex = RefineryCortex()

    def _normalize(self, text: str) -> str:
        """
        Normalize text for matching using the universal normalizer.
        Handles mojibake, accents, and special characters.
        """
        return _normalize_for_matching(text)

    def auto_map(self, input_columns: List[str]) -> Dict[str, str]:
        """
        Maps input columns to canonical columns using Cortex, exact aliases, and fuzzy matching.
        Returns: {CanonicalName: InputColumnName}
        """
        mapping = {}
        # Normalize input columns for matching
        # Key: cleaned version, Value: original version
        normalized_inputs = {self._normalize(col): col for col in input_columns if col}
        
        assigned_inputs = set()

        for canonical, aliases in self.schema.items():
            best_match = None
            best_score = 0.0

            # 0. Cortex Recall (Highest Priority)
            for input_norm, original_col in normalized_inputs.items():
                learned_canonical = self.cortex.get_mapping(input_norm)
                if learned_canonical and learned_canonical.lower() == canonical.lower():
                    best_match = original_col
                    best_score = 2.0 
                    break
            
            if best_match:
                 if best_match not in assigned_inputs:
                    mapping[canonical] = best_match
                    assigned_inputs.add(best_match)
                    logger.info(f"Cortex Recall: '{best_match}' -> '{canonical}'")
                 continue 

            # 1. Exact / Normalized Alias Match
            norm_canonical = self._normalize(canonical)
            if norm_canonical in normalized_inputs:
                best_match = normalized_inputs[norm_canonical]
                best_score = 1.0
            else:
                for alias in aliases:
                    norm_alias = self._normalize(alias)
                    if norm_alias in normalized_inputs:
                        best_match = normalized_inputs[norm_alias]
                        best_score = 1.0
                        break
            
            # 2. Fuzzy Match (if no exact alias)
            if not best_match:
                keys = list(normalized_inputs.keys())
                for alias in aliases:
                    norm_alias = self._normalize(alias)
                    matches = difflib.get_close_matches(norm_alias, keys, n=1, cutoff=0.75) # Lowered from 0.85
                    if matches:
                        match_key = matches[0]
                        score = difflib.SequenceMatcher(None, norm_alias, match_key).ratio()
                        if score > best_score:
                            best_score = score
                            best_match = normalized_inputs[match_key]

            # 3. Assign if score is good enough
            if best_match and best_match not in assigned_inputs:
                mapping[canonical] = best_match
                assigned_inputs.add(best_match)
                logger.info(f"Mapped '{best_match}' -> '{canonical}' (Score: {best_score:.2f})")
        
        self.column_mapping = mapping
        return mapping

    def apply_mapping(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Builds a new DataFrame based on the mapping.
        Also preserves optional columns (like %BK, %CY, %Mg, %Yw) that exist in the
        input CSV even if not explicitly mapped — so toner data is never silently dropped.
        """
        if not self.column_mapping:
            self.auto_map(df.columns.tolist())
        
        # Prepare case-insensitive lookup for DF columns
        df_cols_lower = {c.lower().strip(): c for c in df.columns}
        
        new_df = pd.DataFrame(index=df.index)
        
        # 1. Apply explicit mapping: {Canonical: InputColumn}
        for canonical, input_col in self.column_mapping.items():
            if not input_col:
                continue
            
            input_lower = str(input_col).lower().strip()
            real_col = df_cols_lower.get(input_lower)
            
            if real_col is not None:
                new_df[canonical] = df[real_col]

        # 2. Preserve optional columns that exist in the CSV but weren't mapped
        # This ensures toner percentages (%BK, %CY, %Mg, %Yw) are never lost
        already_used_inputs = {str(v).lower().strip() for v in self.column_mapping.values() if v}
        for col in df.columns:
            col_lower = col.lower().strip()
            col_upper = col.upper().replace('%', '').strip()
            # Keep toner percentage columns and other known optional fields
            is_toner = col.startswith('%') or col_upper in ('BK', 'CY', 'MG', 'YW', 'MG', 'YW')
            if is_toner and col_lower not in already_used_inputs and col not in new_df.columns:
                new_df[col] = df[col]

        return new_df

if __name__ == "__main__":
    # Test Stub
    mapper = RefineryMapper("MAPA")
    inputs = ["Serial No", "Valor Locação", "Endereço Completo", "Setor/Area", "Data Install"]
    print("Inputs:", inputs)
    result = mapper.auto_map(inputs)
    print("Mapping Result:", result)
