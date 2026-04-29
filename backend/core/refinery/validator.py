
import pandas as pd
import re
import logging
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RefineryValidator:
    """
    Layer 3.5: The 'Iron Validator'
    Responsible for:
    1. Validating row data against strict rules.
    2. Generating Audit Reports (Errors/Warnings).
    3. Filtering invalid rows (if strict mode is on).
    """

    # Validation Rules per Data Type
    # Format: {ColumnName: [CheckFunction, ErrorMessage]}
    RULES = {
        "MAPA": {
            "serie": [lambda x: bool(x) and len(str(x)) > 3, "Serial Missing or too short"],
            "valor": [lambda x: isinstance(x, (int, float)) and x >= 0, "Invalid Value"],
            "ip": [lambda x: RefineryValidator.is_valid_ip(x), "Invalid IP Format"],
            "email": [lambda x: RefineryValidator.is_valid_email(x), "Invalid Email Format"]
        }
    }

    @staticmethod
    def is_valid_ip(val):
        if not val or pd.isna(val):
            return True # Allow empty, validation is for format correctness if present
        return bool(re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', str(val)))

    @staticmethod
    def is_valid_email(val):
        if not val or pd.isna(val):
            return True
        return bool(re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', str(val)))

    def __init__(self, partial_rescue: bool = True):
        # Partition rescue logic is handled entirely by the Validator.validate method 
        # which separates valid/invalid rows. No extra flag needed here.
        self.partial_rescue = partial_rescue

    def validate(self, df: pd.DataFrame, data_type: str = "MAPA") -> Dict[str, Any]:
        """
        Validates the DataFrame.
        Returns:
        {
            "valid_data": List[Dict],
            "rejected_data": List[Dict], # including error details
            "stats": {"total": 100, "valid": 95, "rejected": 5}
        }
        """
        valid_rows = []
        rejected_rows = []
        
        rules = self.RULES.get(data_type, {})
        
        for idx, row in df.iterrows():
            errors = []
            
            for col, (check_func, err_msg) in rules.items():
                if col in row:
                    val = row[col]
                    try:
                        if not check_func(val):
                            errors.append(f"{col}: {err_msg} ('{val}')")
                    except Exception:
                        errors.append(f"{col}: Validation Exception")
            
            record = row.to_dict()
            if errors:
                record["_validation_errors"] = "; ".join(errors)
                rejected_rows.append(record)
            else:
                valid_rows.append(record)
        
        return {
            "valid_data": valid_rows,
            "rejected_data": rejected_rows,
            "stats": {
                "total": len(df),
                "valid": len(valid_rows),
                "rejected": len(rejected_rows)
            }
        }

if __name__ == "__main__":
    # Test Stub
    df_test = pd.DataFrame([
        {"serie": "12345", "valor": 100.0, "ip": "192.168.1.1"},
        {"serie": "123", "valor": -50.0, "ip": "999.999"}, # Fail: Short serial, neg value, bad IP
        {"serie": "ABCDE", "valor": 0.0, "ip": None}
    ])
    
    val = RefineryValidator()
    result = val.validate(df_test, "MAPA")
    print("Valid:", len(result["valid_data"]))
    print("Rejected:", len(result["rejected_data"]))
    print("Errors:", result["rejected_data"][0]["_validation_errors"])
