import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from core.services.equipment import EquipmentService

@pytest.fixture
def equipment_service():
    return EquipmentService(contract_id="TEST_CONTRACT")

def test_equipment_search_basic(equipment_service):
    # Mock database.load_mapa
    mock_df = pd.DataFrame({
        "FILA": ["A1", "B2"],
        "SERIE": ["SN001", "SN002"],
        "MODELOSIMPRESS": ["M1", "M2"],
        "STATUS": ["ATIVO", "ATIVO"],
        "LOCALINSTALACAO": ["Local1", "Local2"]
    })
    
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        results = equipment_service.search("SN001")
        assert len(results) == 1
        assert results[0]["Serie"] == "SN001"
        assert results[0]["Fila"] == "A1"

def test_equipment_search_empty_term(equipment_service):
    results = equipment_service.search("")
    assert results == []

def test_equipment_get_all(equipment_service):
    mock_df = pd.DataFrame({
        "FILA": ["A1"],
        "SERIE": ["SN001"],
        "STATUS": ["ATIVO"]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        results = equipment_service.get_all()
        assert len(results) == 1
        assert results[0]["Serie"] == "SN001"

def test_equipment_get_details_not_found(equipment_service):
    with patch('core.services.equipment.database.load_mapa', return_value=pd.DataFrame()):
        result = equipment_service.get_details("SN_NONE")
        assert result is None

def test_equipment_get_details_success(equipment_service):
    mock_mapa = pd.DataFrame({
        "SERIE": ["SN001"],
        "FILA": ["F1"],
        "MODELOSIMPRESS": ["MOD1"],
        "STATUS": ["ATIVO"],
        "TipodoEquipamento": ["Multifuncional Color"]
    })
    mock_contadores = pd.DataFrame({
        "SERIE": ["SN001"],
        "TOTAL": [1000],
        "%BK": ["50%"],
        "%CY": ["20%"]
    })
    mock_papel = pd.DataFrame({
        "SERIE": ["SN001"],
        "MEDIA": ["100,5"],
        "A4RESMA": [2]
    })
    mock_entregas = pd.DataFrame({
        "Serie": ["SN001"],
        "DataEntrega": ["20/03/2024"],
        "A4": [5],
        "ContFinal": [900]
    })
    
    with patch('core.services.equipment.database.load_mapa', return_value=mock_mapa), \
         patch('core.services.equipment.database.load_contadores', return_value=mock_contadores), \
         patch('core.services.equipment.database.load_papel', return_value=mock_papel), \
         patch('core.services.equipment.database.load_entregas', return_value=mock_entregas):
        
        result = equipment_service.get_details("SN001")
        assert result is not None
        assert result["equipment"]["Serie"] == "SN001"
        assert result["is_color"] is True
        assert result["counters"]["counter_total"] == 1000
        assert result["papel_stats"]["a4_resma"] == 2.0
        assert len(result["history"]) == 1
        assert result["last_delivery"]["qty"] == 5

def test_equipment_color_detection_heuristics(equipment_service):
    # Test case: No color toner but model name suggests color
    equip = {"ModeloSimpress": "C405"}
    counters = {}
    assert equipment_service._detect_color_equipment(equip, counters) is True
    
    # Test case: TipodoEquipamento says color
    equip = {"TipodoEquipamento": "Color MFP"}
    assert equipment_service._detect_color_equipment(equip, counters) is True

def test_equipment_unique_values_complex(equipment_service):
    mock_df = pd.DataFrame({
        "CIDADE": ["SAO PAULO", "RIO", "CURITIBA"],
        "STATUS": ["ATIVO", "RESERVA", "ATIVO"],
        "EMPRESA": ["EMP1", "EMP1", "EMP2"]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        # Filter by MULTIPLE fields (AND)
        # Status=ATIVO AND Empresa=EMP1 -> Should only be SAO PAULO
        filters = [
            {"field": "Status", "value": "ATIVO"},
            {"field": "Empresa", "value": "EMP1"}
        ]
        cities = equipment_service.get_unique_values("Cidade", filters)
        assert cities == ["SAO PAULO"]

def test_equipment_legacy_columns(equipment_service):
    # Test fallback renaming logic in search()
    mock_df = pd.DataFrame({
        "Fila": ["A1"], # Lowercase
        "Serie": ["SN_LEGACY"], # Lowercase
        "Status": ["ATIVO"]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        results = equipment_service.search("SN_LEGACY")
        assert len(results) == 1
        assert results[0]["Serie"] == "SN_LEGACY"

def test_equipment_details_history_sorting(equipment_service):
    mock_mapa = pd.DataFrame({"SERIE": ["SN001"], "STATUS": ["ATIVO"]})
    mock_entregas = pd.DataFrame({
        "Serie": ["SN001", "SN001"],
        "DataEntrega": ["20/03/2024", "21/03/2024"],
        "A4": [5, 10]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_mapa), \
         patch('core.services.equipment.database.load_entregas', return_value=mock_entregas):
        result = equipment_service.get_details("SN001")
        # History should be sorted by date descending (21/03/2024 first)
        assert result["history"][0]["DataEntrega"] == "21/03/2024"

def test_equipment_dashboard_trends(equipment_service):
    mock_df = pd.DataFrame({
        "STATUS": ["ATIVO", "ATIVO", "RESERVA"],
        "MODELOSIMPRESS": ["M1", "M1", "M2"],
        "CIDADE": ["CIT1", "CIT2", "CIT1"]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        trends = equipment_service.get_dashboard_trends()
        assert trends["total"] == 3
        # Check status_dist contains ATIVO and RESERVA
        status_names = [s["name"] for s in trends["status_dist"]]
        assert "ATIVO" in status_names
        assert "RESERVA" in status_names

def test_equipment_unique_values(equipment_service):
    mock_df = pd.DataFrame({
        "CIDADE": ["SAO PAULO", "RIO", "SAO PAULO"],
        "STATUS": ["ATIVO", "ATIVO", "RESERVA"]
    })
    with patch('core.services.equipment.database.load_mapa', return_value=mock_df):
        # Unique Cities
        cities = equipment_service.get_unique_values("Cidade")
        assert cities == ["RIO", "SAO PAULO"]
        
        # Unique Cities filtered by Status=RESERVA
        cities_filtered = equipment_service.get_unique_values("Cidade", [{"field": "Status", "value": "RESERVA"}])
        assert cities_filtered == ["SAO PAULO"]
