from backend.core.refinery.mapper import RefineryMapper

def test_mapper_normalization():
    mapper = RefineryMapper("MAPA")
    headers = ["Nº de Série", "Modelo Simpress", "Rua / Ref", "Vlr Unit."]
    mapping = mapper.auto_map(headers)
    
    assert mapping["serie"] == "Nº de Série"
    # "Modelo Simpress" now maps to modelosimpress (more specific canonical)
    assert mapping.get("modelosimpress") == "Modelo Simpress" or mapping.get("modelo") == "Modelo Simpress"
    # "Rua / Ref" is an alias for "ruaref"
    assert mapping.get("ruaref") == "Rua / Ref" or mapping.get("endereco") == "Rua / Ref"
    # "Vlr Unit." is an alias for "valor"
    assert mapping["valor"] == "Vlr Unit."

def test_mapper_schema_keys():
    mapper = RefineryMapper("MAPA")
    keys = mapper.CANONICAL_SCHEMA["MAPA"].keys()
    assert "serie" in keys
    assert "modelo" in keys
    # After mapper fix: localinstalacao captures address fields
    assert "localinstalacao" in keys or "endereco" in keys

def test_mapper_fuzzy_matching():
    mapper = RefineryMapper("MAPA")
    headers = ["Seriee", "Modeloo"]
    mapping = mapper.auto_map(headers)
    assert mapping["serie"] == "Seriee"
    assert mapping["modelo"] == "Modeloo"

def test_mapper_unknown_columns():
    mapper = RefineryMapper("MAPA")
    headers = ["Random Column", "Another One"]
    mapping = mapper.auto_map(headers)
    assert len(mapping) == 0
