
import pandas as pd
import re
import logging
from typing import Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RefineryNormalizer:
    """
    Layer 3: The 'Normalizer'
    Responsible for:
    1. Cleaning specific data types (Money, Date, Boolean).
    2. String standardization (stripping invisible chars).
    """

    def __init__(self):
        pass

    @staticmethod
    def clean_money(value: Any) -> float:
        """
        Converts 'R$ 1.234,56' or '1.234,56' to 1234.56.
        Handles negative values (e.g. '-').
        """
        if pd.isna(value) or str(value).strip() == '-':
            return 0.0
        
        s = str(value)
        # Remove R$, whitespace, and points (thousand separators)
        # Assuming Brazilian format: 1.000,00
        clean = re.sub(r'[^\d,-]', '', s) # Keep digits, comma, minus
        
        # Replace decimal comma with dot
        clean = clean.replace(',', '.')
        
        try:
            return float(clean)
        except ValueError:
            return 0.0

    @staticmethod
    def clean_boolean(value: Any) -> bool:
        """
        Maps 'Sim', 'Yes', 'S', '1' to True.
        """
        if pd.isna(value):
            return False
        
        s = str(value).lower().strip()
        return s in ['sim', 's', 'yes', 'y', '1', 'verdadeiro', 'true']

    @staticmethod
    def clean_date(value: Any) -> pd.Timestamp:
        """
        Robust date parser. Tries DD/MM/YYYY, YYYY-MM-DD, etc.
        """
        if pd.isna(value) or str(value).strip() in ['-', '', 'nan', 'NaT']:
            return None
        
        s = str(value).strip()
        # Common Brazilian format handling
        try:
            return pd.to_datetime(s, dayfirst=True) # prioritize DD/MM/YYYY
        except Exception:
            return None

    def normalize(self, df: pd.DataFrame, schema_type: str = "MAPA") -> pd.DataFrame:
        """
        Applies normalization rules based on column names.
        """
        df_clean = df.copy()

        # Money Columns
        money_cols = ['valor', 'custo', 'locacao']
        for col in df_clean.columns:
            if any(m in col.lower() for m in money_cols):
                df_clean[col] = df_clean[col].apply(self.clean_money)

        # Date Columns
        date_cols = ['data', 'instalacao', 'atualizacao', 'leitura', 'troca']
        for col in df_clean.columns:
            if any(d in col.lower() for d in date_cols):
                df_clean[col] = df_clean[col].apply(self.clean_date)

        # Boolean Columns (Example assumption)
        # Note: 'Status' in MAPA is usually a string ("Em Produção"), not boolean.
        
        # String Cleaning (Universal)
        # 3. DType Normalization (CRITICAL for modern Pandas/Numpy compatibility)
        for col in df_clean.columns:
            # Check if likely object/string column (covers object, StringDtype, str)
            col_dtype_str = str(df_clean[col].dtype).lower()
            if df_clean[col].dtype == object or 'string' in col_dtype_str or col_dtype_str == 'str':
                # Ensure it is a generic object series with Python strings
                df_clean[col] = df_clean[col].apply(lambda x: str(x).strip() if pd.notna(x) and x is not None else None)
                # Clean multiple spaces while keeping standard Python None
                df_clean[col] = df_clean[col].str.replace(r'\s+', ' ', regex=True)
                # Explicit cleanup of technical strings that might look like nulls
                df_clean[col] = df_clean[col].replace({'nan': None, 'NaN': None, 'None': None, 'NaT': None})

        return df_clean

if __name__ == "__main__":
    # Test Stub
    norm = RefineryNormalizer()
    print(norm.clean_money("R$ 1.234,56")) # 1234.56
    print(norm.clean_money("120,50"))      # 120.50
    print(norm.clean_boolean(" NÃO "))     # False
    print(norm.clean_date("31/12/2025"))   # Timestamp
