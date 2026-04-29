"""
RefineryIngestor — Universal CSV/Excel Translator

Handles any file format, encoding, delimiter, and header position.
Designed to be a universal translator for the Supply 2026 system.
"""

import pandas as pd
import io
import logging
import re
import unicodedata
from typing import List, Optional
import fsspec

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _normalize_for_matching(text: str) -> str:
    """
    Normalize text for fuzzy matching.
    Handles mojibake (cp850/cp1252 corruption), accents, and special chars.
    Order: mojibake fix → lowercase → NFD accent removal → alphanumeric only.
    """
    if not text:
        return ""
    text = str(text).strip()

    # ── Step 1: Fix mojibake BEFORE lowercasing ──────────────────────────────
    # When cp1252/latin1 bytes are misread as cp850, accented chars become
    # box-drawing chars or other symbols. Must fix BEFORE lower() because
    # the mojibake chars are uppercase (e.g. Ò, Ó, Ú, Ý...).
    #
    # Mapping: cp850_char → normalized_ascii
    # Source: byte 0xC0-0xFF in latin1 vs cp850
    _MOJIBAKE = {
        # Box-drawing (cp850 misread of À-Ï range, 0xC0-0xCF)
        '\u2514': 'a',  # 0xC0 À→└
        '\u2534': 'a',  # 0xC1 Á→┴  ← fixes 'Área' → '┴rea'
        '\u252c': 'a',  # 0xC2 Â→┬
        '\u251c': 'a',  # 0xC3 Ã→├
        '\u2500': 'a',  # 0xC4 Ä→─
        '\u253c': 'a',  # 0xC5 Å→┼
        '\u255a': 'e',  # 0xC8 È→╚
        '\u2554': 'e',  # 0xC9 É→╔
        '\u2569': 'e',  # 0xCA Ê→╩
        '\u2566': 'e',  # 0xCB Ë→╦
        '\u2560': 'i',  # 0xCC Ì→╠
        '\u2550': 'i',  # 0xCD Í→═
        '\u256c': 'i',  # 0xCE Î→╬
        '\u2518': 'u',  # 0xD9 Ù→┘
        '\u250c': 'u',  # 0xDA Ú→┌
        '\u2588': 'u',  # 0xDB Û→█
        '\u2584': 'u',  # 0xDC Ü→▄
        # cp850 misread of à-ÿ range (0xE0-0xFF) — uppercase before lower()
        '\xd3': 'a',   # 0xE0 à→Ó
        '\xdf': 'a',   # 0xE1 á→ß  ← fixes 'Horário' → 'Horßrio'
        '\xd4': 'a',   # 0xE2 â→Ô
        '\xd2': 'a',   # 0xE3 ã→Ò  ← fixes 'Locação' → 'LocaþÒo'
        '\xde': 'e',   # 0xE8 è→Þ
        '\xda': 'e',   # 0xE9 é→Ú
        '\xdb': 'e',   # 0xEA ê→Û
        '\xd9': 'e',   # 0xEB ë→Ù
        '\xdd': 'i',   # 0xED í→Ý
        '\xfe': 'c',   # 0xE7 ç→þ  ← fixes 'Locação' → 'LocaþÒo'
        '\xd0': 'n',   # 0xD1 Ñ→Ð
        '\xbe': 'o',   # 0xF3 ó→¾
        '\xb6': 'o',   # 0xF4 ô→¶
        '\xa7': 'o',   # 0xF5 õ→§
        '\xb7': 'u',   # 0xFA ú→·
        '\xb9': 'u',   # 0xFB û→¹
        '\xb3': 'u',   # 0xFC ü→³
        '\xb2': 'y',   # 0xFD ý→²
        # cp1252 control chars (0x80-0x9F) that appear as garbage in latin1
        '\x96': '',    # en dash → remove
        '\x97': '',    # em dash → remove
        '\x91': '',    # left single quote
        '\x92': '',    # right single quote
        '\x93': '',    # left double quote
        '\x94': '',    # right double quote
        '\x85': '',    # ellipsis
        '\x80': 'e',   # euro sign
        '\x8a': 's',   # Š
        '\x8e': 'z',   # Ž
        '\x9a': 's',   # š
        '\x9e': 'z',   # ž
    }
    for bad, good in _MOJIBAKE.items():
        if bad in text:
            text = text.replace(bad, good)

    # ── Step 2: Lowercase ────────────────────────────────────────────────────
    text = text.lower()

    # ── Step 3: NFD accent removal ───────────────────────────────────────────
    try:
        text = ''.join(
            c for c in unicodedata.normalize('NFD', text)
            if unicodedata.category(c) != 'Mn'
        )
    except Exception:
        pass

    # ── Step 4: Alphanumeric only ────────────────────────────────────────────
    return ''.join(c for c in text if c.isalnum())


class RefineryIngestor:
    """
    Universal CSV/Excel Ingestor.

    Handles:
    - Any encoding (UTF-8, UTF-8-BOM, cp1252, latin1, UTF-16, cp850, etc.)
    - Any delimiter (;, ,, TAB, |)
    - Any header position (title rows, blank rows before header)
    - Excel files (.xlsx, .xls)
    - Files with duplicate column names
    - Files with trailing whitespace in column names
    - Files with BOM markers
    - Files with mixed line endings (\\r\\n, \\n, \\r)
    """

    # Keywords that indicate a row is a header (Portuguese + English)
    KNOWN_COLUMNS = {
        # Equipment / MAPA
        "serie", "serial", "sn", "modelo", "marca", "tipo", "equipamento",
        "valor", "locacao", "status", "ip", "hostname", "host", "fila",
        "latitude", "longitude", "contrato", "empresa", "cidade", "uf",
        "centro", "custo", "area", "setor", "endereco", "rua", "local",
        "instalacao", "observacao", "grupo", "servidor", "impressao",
        "leitor", "cracha", "cor", "departamento", "usuario", "email",
        "telefone", "ramal", "celular", "planta", "gerencia", "cnpj",
        "horario", "almoxarifado", "contato", "inventario", "tamanho",
        # Counters / CONTADORES
        "contadores", "page", "count", "mono", "color", "total", "papel",
        "toner", "counter", "leitura", "data", "bk", "cy", "mg", "yw",
        # Paper / PAPEL
        "resma", "media", "meta", "mensal",
        # Generic
        "name", "model", "brand", "address", "city", "state", "contract",
        "company", "location", "floor", "building", "department",
    }

    # Encoding detection order — cp1252 BEFORE latin1 to handle Windows files correctly
    # cp1252 is a superset of latin1 for printable chars (0x80-0x9F range)
    ENCODINGS_TO_TRY = [
        'utf-8-sig',   # UTF-8 with BOM (Excel exports)
        'utf-8',       # Standard UTF-8
        'cp1252',      # Windows Western European (most common for PT-BR Excel)
        'latin1',      # ISO-8859-1 (fallback, accepts all bytes)
        'utf-16',      # UTF-16 with BOM
        'utf-16-le',   # UTF-16 Little Endian
        'utf-16-be',   # UTF-16 Big Endian
        'cp850',       # DOS Western European (legacy)
        'cp437',       # DOS US (legacy)
    ]

    # Deep Scan Patterns
    PATTERNS = {
        "email": re.compile(r'\b[\w\.-]+@[\w\.-]+\.\w+\b'),
        "ip": re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'),
        "date": re.compile(r'\d{2}[/-]\d{2}[/-]\d{2,4}'),
        "money_br": re.compile(r'R\$\s?[\d.,]+'),
        "serial": re.compile(r'\b[A-Z0-9]{5,20}\b'),
        "coord": re.compile(r'-?\d{1,3}\.\d{4,}'),  # GPS coordinates
    }

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.raw_content: Optional[str] = None
        self.raw_bytes: Optional[bytes] = None
        self.encoding = 'utf-8'
        self.delimiter = ';'
        self.header_row_index = 0
        self.is_excel = False

    # ─── Encoding Detection ───────────────────────────────────────────────────

    def _detect_encoding_from_bytes(self, raw: bytes) -> str:
        """
        Detect encoding from raw bytes using BOM markers and heuristics.
        Falls back to chardet if available.
        """
        # BOM detection
        if raw[:3] == b'\xef\xbb\xbf':
            return 'utf-8-sig'
        if raw[:2] in (b'\xff\xfe', b'\xfe\xff'):
            return 'utf-16'
        if raw[:4] in (b'\xff\xfe\x00\x00', b'\x00\x00\xfe\xff'):
            return 'utf-32'

        # Try chardet for smart detection
        try:
            import chardet
            result = chardet.detect(raw[:50000])
            if result and result.get('confidence', 0) > 0.7:
                detected = result['encoding']
                if detected:
                    # Normalize encoding name
                    detected = detected.lower().replace('-', '').replace('_', '')
                    # Map common aliases
                    alias_map = {
                        'windows1252': 'cp1252',
                        'iso88591': 'latin1',
                        'ascii': 'utf-8',
                    }
                    detected = alias_map.get(detected, result['encoding'])
                    logger.info(f"chardet detected encoding: {result['encoding']} (confidence: {result['confidence']:.0%})")
                    return detected
        except ImportError:
            pass

        # Heuristic: if file has bytes in 0x80-0x9F range, it's cp1252 not latin1
        # (these bytes are control chars in latin1 but printable in cp1252)
        cp1252_specific = sum(1 for b in raw[:10000] if 0x80 <= b <= 0x9F)
        if cp1252_specific > 0:
            return 'cp1252'

        # Check for high-byte frequency (indicates non-ASCII encoding)
        high_bytes = sum(1 for b in raw[:10000] if b > 0x7F)
        if high_bytes > 0:
            return 'cp1252'  # Safe default for PT-BR Windows files

        return 'utf-8'

    def load_raw(self) -> str:
        """
        Load file content with automatic encoding detection.
        Supports local paths, S3 URIs, and Excel files.
        """
        # Check if Excel
        path_lower = str(self.file_path).lower()
        if path_lower.endswith('.xlsx') or path_lower.endswith('.xls'):
            return self._load_excel()

        # Read raw bytes first for encoding detection
        try:
            with fsspec.open(self.file_path, 'rb') as f:
                self.raw_bytes = f.read()
        except Exception as e:
            logger.error(f"Failed to read file bytes: {e}")
            raise ValueError(f"Cannot read file: {self.file_path}")

        # Detect best encoding
        best_encoding = self._detect_encoding_from_bytes(self.raw_bytes)

        # Build encoding attempt order: detected first, then fallbacks
        encodings = [best_encoding] + [e for e in self.ENCODINGS_TO_TRY if e != best_encoding]

        last_error = None
        for enc in encodings:
            try:
                content = self.raw_bytes.decode(enc)
                self.encoding = enc
                self.raw_content = content
                logger.info(f"Loaded {self.file_path} with encoding: {enc}")
                return content
            except (UnicodeDecodeError, LookupError):
                last_error = enc
                continue

        # Last resort: decode with errors='replace'  # pragma: no cover
        logger.warning(f"All encodings failed for {self.file_path}, using latin1 with replacement")  # pragma: no cover
        content = self.raw_bytes.decode('latin1', errors='replace')  # pragma: no cover
        self.encoding = 'latin1'  # pragma: no cover
        self.raw_content = content  # pragma: no cover
        return content  # pragma: no cover

    def _load_excel(self) -> str:
        """Load Excel file and convert to CSV-like string."""
        self.is_excel = True
        try:
            with fsspec.open(self.file_path, 'rb') as f:
                excel_bytes = f.read()

            df = pd.read_excel(io.BytesIO(excel_bytes), dtype=str, header=None)
            # Convert to semicolon-separated string
            self.delimiter = ';'
            self.encoding = 'utf-8'
            content = df.to_csv(sep=';', index=False, header=False)
            self.raw_content = content
            logger.info(f"Loaded Excel file: {self.file_path} ({len(df)} rows)")
            return content
        except Exception as e:
            logger.error(f"Excel load failed: {e}")
            raise ValueError(f"Cannot read Excel file: {e}")

    # ─── Delimiter Detection ──────────────────────────────────────────────────

    def sniff_delimiter(self, sample_lines: List[str]) -> str:
        """
        Detect delimiter from sample lines.
        Prioritizes ';' for PT-BR files, then TAB, then ','.
        """
        candidates = [';', '\t', ',', '|', ':']
        best_delim = ';'
        max_score = -1

        for delim in candidates:
            counts = [line.count(delim) for line in sample_lines if line.strip()]
            if not counts:
                continue

            avg = sum(counts) / len(counts)
            if avg < 1:
                continue

            # Low variance = consistent column count = good delimiter
            variance = sum((c - avg) ** 2 for c in counts) / len(counts)
            score = avg / (variance + 0.1)

            # Bias towards PT-BR standard delimiters
            if delim == ';':
                score *= 1.3
            elif delim == '\t':
                score *= 1.1

            if score > max_score:
                max_score = score
                best_delim = delim

        self.delimiter = best_delim
        logger.info(f"Sniffed delimiter: {repr(best_delim)} (score: {max_score:.2f})")
        return best_delim

    # ─── Header Detection ─────────────────────────────────────────────────────

    def _score_header_candidate(self, parts: List[str]) -> float:
        """Score a line as a potential header based on keyword density."""
        if not parts or len(parts) < 2:
            return 0.0

        clean = [p.strip() for p in parts if p.strip()]
        if not clean:
            return 0.0

        keyword_hits = 0
        for part in clean:
            # Normalize for matching (handles mojibake and accents)
            norm = _normalize_for_matching(part)
            if any(kw in norm for kw in self.KNOWN_COLUMNS):
                keyword_hits += 1

        width_score = len(parts)
        density = keyword_hits / len(clean) if clean else 0
        return (width_score * 2) + (keyword_hits * 5) + (density * 10)

    def header_hunt(self, lines: List[str], max_scan_lines: int = 30) -> int:
        """
        Find the header row by scoring each candidate line.
        Uses keyword matching with mojibake-aware normalization.
        """
        scan_limit = min(len(lines), max_scan_lines)
        best_score = -1
        best_idx = 0

        for idx in range(scan_limit):
            line = lines[idx]
            parts = [p.strip() for p in line.split(self.delimiter)]

            if len(parts) < 2:
                continue

            score = self._score_header_candidate(parts)
            deep = self.deep_scan_boost(lines, idx, parts)
            total = score + deep

            if total > best_score:
                best_score = total
                best_idx = idx

        logger.info(
            f"Header Hunt: row {best_idx} (score: {best_score:.2f}) "
            f"-> {lines[best_idx][:60].strip()!r}"
        )
        self.header_row_index = best_idx
        return best_idx

    def deep_scan_boost(self, lines: List[str], header_idx: int, header_parts: List[str]) -> float:
        """Boost score if data rows below the candidate match known patterns."""
        boost = 0.0
        rows_to_check = lines[header_idx + 1: header_idx + 5]
        if not rows_to_check:
            return 0.0

        target_col_count = len(header_parts)

        for row in rows_to_check:
            row_parts = row.split(self.delimiter)

            # Structural consistency boost
            if abs(len(row_parts) - target_col_count) <= 2 and target_col_count > 1:
                boost += 3.0

            for cell in row_parts:
                cell = cell.strip()
                if not cell or cell in ('-', 'N/A', 'n/a', '#N/D', '#REF!'):
                    continue
                if self.PATTERNS["ip"].search(cell):
                    boost += 0.5
                elif self.PATTERNS["email"].search(cell):
                    boost += 0.5
                elif self.PATTERNS["coord"].search(cell):
                    boost += 0.4
                elif self.PATTERNS["money_br"].search(cell):
                    boost += 0.3
                elif self.PATTERNS["date"].search(cell):
                    boost += 0.2

        return min(boost, 12.0)

    # ─── Main Pipeline ────────────────────────────────────────────────────────

    def ingest(self) -> pd.DataFrame:
        """
        Main pipeline: Load → Sniff → Hunt → Parse → Clean → Return DataFrame.

        Returns a DataFrame with:
        - String dtype for all columns
        - Stripped column names
        - Deduplicated column names (col, col_1, col_2, ...)
        - None for empty/null values
        """
        if not self.raw_content:
            self.load_raw()

        # Excel files are already parsed
        if self.is_excel:
            return self._parse_from_string()

        return self._parse_from_string()

    def _parse_from_string(self) -> pd.DataFrame:
        """Parse raw string content into a DataFrame."""
        buffer = io.StringIO(self.raw_content)
        lines = buffer.readlines()

        if not lines:
            raise ValueError("File is empty")

        # Sniff delimiter
        sample = [l for l in lines[:15] if l.strip()]
        self.sniff_delimiter(sample)

        # Find header
        start_idx = self.header_hunt(lines)

        # Parse with pandas
        buffer.seek(0)
        try:
            df = pd.read_csv(
                buffer,
                sep=self.delimiter,
                header=start_idx,
                on_bad_lines='skip',
                dtype=str,
                skip_blank_lines=False,
                # Do NOT pass encoding — StringIO is already decoded
            )
        except Exception as e:
            logger.error(f"pd.read_csv failed: {e}")
            raise

        return self._clean_dataframe(df)

    def _clean_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Clean and standardize the DataFrame:
        - Flatten MultiIndex columns
        - Strip whitespace from column names
        - Deduplicate column names
        - Convert all values to native Python strings
        - Replace null-like strings with None
        """
        # Flatten MultiIndex columns (can happen with some Excel files)
        if isinstance(df.columns, pd.MultiIndex):
            raw_cols = ['_'.join(str(c).strip() for c in col if str(c).strip()) for col in df.columns.values]
        else:
            raw_cols = [str(c).strip() for c in df.columns]

        # Deduplicate column names
        seen: dict = {}
        new_cols = []
        for col in raw_cols:
            if col in seen:
                seen[col] += 1
                new_cols.append(f"{col}_{seen[col]}")
            else:
                seen[col] = 0
                new_cols.append(col)

        df.columns = new_cols

        # Remove completely empty columns (unnamed artifacts)
        df = df.loc[:, ~df.columns.str.match(r'^Unnamed:\s*\d+$')]

        # Remove completely empty rows
        df = df.dropna(how='all')

        # Convert all values to native Python strings
        NULL_STRINGS = {'nan', 'none', 'nat', '<na>', 'null', 'n/a', '#n/d', '#ref!', '#value!', '#name?'}
        for col in df.columns:
            df[col] = df[col].map(
                lambda x: None if (
                    x is None or
                    (isinstance(x, float) and pd.isna(x)) or
                    str(x).strip().lower() in NULL_STRINGS
                ) else str(x).strip()
            )

        logger.info(
            f"Ingested: {len(df)} rows × {len(df.columns)} columns "
            f"(encoding={self.encoding}, delimiter={repr(self.delimiter)}, "
            f"header_row={self.header_row_index})"
        )
        return df


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        path = sys.argv[1]
        print(f"Testing Ingestor on: {path}")
        ingestor = RefineryIngestor(path)
        try:
            df = ingestor.ingest()
            print(f"\n--- Ingestion Success ---")
            print(f"Encoding:    {ingestor.encoding}")
            print(f"Delimiter:   {repr(ingestor.delimiter)}")
            print(f"Header Row:  {ingestor.header_row_index}")
            print(f"Shape:       {df.shape}")
            print(f"Columns:     {df.columns.tolist()}")
            print(f"\nFirst 3 rows:")
            print(df.head(3).to_string())
        except Exception as err:
            import traceback
            print(f"Ingestion Failed: {err}")
            traceback.print_exc()
