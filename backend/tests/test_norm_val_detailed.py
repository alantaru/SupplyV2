import pytest
import pandas as pd
from core.refinery.normalizer import RefineryNormalizer
from core.refinery.validator import RefineryValidator

def test_normalizer_currency_parsing():
    df = pd.DataFrame({
        "valor": ["R$ 1.200,50", "1500,00", "500,50", "-", "invalid"]
    })
    norm = RefineryNormalizer()
    clean_df = norm.normalize(df)
    
    assert clean_df.iloc[0]["valor"] == 1200.50
    assert clean_df.iloc[1]["valor"] == 1500.00
    assert clean_df.iloc[2]["valor"] == 500.50
    assert clean_df.iloc[3]["valor"] == 0.0
    assert clean_df.iloc[4]["valor"] == 0.0

def test_normalizer_boolean_and_date():
    df = pd.DataFrame({
        "is_active": ["Sim", "Não", "1", "0", None],
        "data_leitura": ["20/03/2024", "-", "", "invalid", None] # Added None to match length 5
    })
    norm = RefineryNormalizer()
    clean_df = norm.normalize(df)
    
    # Verify date standardization in the DF
    assert pd.notna(clean_df.iloc[0]["data_leitura"])
    
    # Also test the methods directly for coverage
    assert norm.clean_boolean("Sim") is True
    assert norm.clean_boolean("Não") is False
    assert norm.clean_boolean(None) is False
    
    assert norm.clean_date("-") is None
    assert norm.clean_date("") is None

def test_normalizer_string_cleanup():
    df = pd.DataFrame({
        "serie": ["  SN123  ", "SN  456", "nan"]
    })
    norm = RefineryNormalizer()
    clean_df = norm.normalize(df)
    assert clean_df.iloc[0]["serie"] == "SN123"
    assert clean_df.iloc[1]["serie"] == "SN 456" # double space to single
    assert clean_df.iloc[2]["serie"] is None

def test_validator_ip_and_email():
    df = pd.DataFrame({
        "serie": ["SERIAL01", "SERIAL02", "SERIAL03"],
        "valor": [100.0, 200.0, 300.0],
        "ip": ["192.168.1.1", "invalid-ip", ""], # Empty IP is considered valid format (allowed empty)
        "email": ["test@example.com", "bad-email", None]
    })
    validator = RefineryValidator()
    results = validator.validate(df, "MAPA")
    
    assert len(results["valid_data"]) == 2 # 01 and 03
    assert len(results["rejected_data"]) == 1 # 02
    
    rejected_sn2 = results["rejected_data"][0]
    assert "Invalid IP Format" in rejected_sn2["_validation_errors"]
    assert "Invalid Email Format" in rejected_sn2["_validation_errors"]

def test_validator_exception_handling():
    # Trigger line 71-72 by making check_func explode
    validator = RefineryValidator()
    df = pd.DataFrame({"serie": ["SN_EXPLODE"]})
    # Inject a breaking rule
    validator.RULES["BREAK"] = {"serie": [lambda x: x.split('-')[1], "Should explode"]}
    results = validator.validate(df, "BREAK")
    assert "Validation Exception" in results["rejected_data"][0]["_validation_errors"]
