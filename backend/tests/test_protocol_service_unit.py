import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from core.services.protocol import ProtocolService
from datetime import datetime

@pytest.fixture
def protocol_service():
    return ProtocolService(contract_id="TEST_CONTRACT")

def test_protocol_get_pending_basic(protocol_service):
    mock_df = pd.DataFrame({
        "Protocolo": [1, 2],
        "DataEntrega": ["", "20/03/2024"],
        "Serie": ["SN1", "SN2"]
    })
    with patch('core.services.protocol.database.load_entregas', return_value=mock_df):
        # Only pending (DataEntrega == "")
        results = protocol_service.get_pending(filters={"status": "pending"})
        assert len(results) == 1
        assert str(results[0]["Protocolo"]) == "1"

def test_protocol_create_with_enrichment(protocol_service):
    # Entregas might have some rows
    mock_entregas = pd.DataFrame({
        "Protocolo": [10],
        "Serie": ["PREV"]
    })
    mock_equip_details = {
        "equipment": {
            "Serie": "SN001",
            "ModeloSimpress": "M1",
            "Fila": "F1",
            "Cidade": "SAO PAULO"
        }
    }
    
    with patch('core.services.protocol.database.load_entregas', return_value=mock_entregas), \
         patch('core.services.protocol.database.get_data_uri', return_value="file:///tmp/e.csv"), \
         patch('core.services.protocol.database.save_dataframe_csv') as mock_save, \
         patch('core.services.protocol.EquipmentService') as mock_equip_svc_class:
        
        # Patch the instance return value
        mock_equip_svc_class.return_value.get_details.return_value = mock_equip_details
        
        data = {"serie": "SN001", "solicitante": "User1"}
        res = protocol_service.create(data)
        
        assert res["status"] == "success"
        assert res["protocol_id"] == 11
        
        saved_df = mock_save.call_args_list[0][0][0]
        # In saved_df, columns are NOT normalized yet (they are raw CSV names for saving)
        # Wait, create() uses new_row with keys like "Solicitante", "Modelo", etc.
        assert saved_df.iloc[-1]["Modelo"] == "M1"
        assert saved_df.iloc[-1]["Solicitante"] == "User1"

def test_protocol_deliver_and_stock_update(protocol_service):
    mock_entregas = pd.DataFrame({
        "Protocolo": [100],
        "Serie": ["SN100"],
        "Modelo": ["MOD_A"],
        "Fila": ["FILA100"],
        "DataEntrega": [""],
        "Empresa": ["EMP1"],
        "Status": ["Pendente"]
    })
    mock_estoque = pd.DataFrame({
        "TipoModelo": ["MOD_A PRETO", "A4 (RESMAS)"],
        "EstoqueAtual": [10, 100],
        "Empresa": ["EMP1", "EMP1"]
    })
    mock_lanc = pd.DataFrame(columns=["TipoMaterial"])
    
    with patch('core.services.protocol.database.load_entregas', return_value=mock_entregas), \
         patch('core.services.protocol.database.load_estoque', return_value=mock_estoque), \
         patch('core.services.protocol.database.load_estoque_lancamentos', return_value=mock_lanc), \
         patch('core.services.protocol.database.save_dataframe_csv'), \
         patch('core.services.protocol.database.get_data_uri', return_value="file:///tmp/dummy.csv"):
        
        delivery_data = {
            "Items": {"Toner Preto": 2, "A4": 5},
            "user": "Tester",
            "RecebidoPor": "Receiver1"
        }
        res = protocol_service.deliver(100, delivery_data)
        assert res["status"] == "success"

def test_protocol_get_by_id(protocol_service):
    mock_df = pd.DataFrame({"Protocolo": [123, 456], "Serie": ["S1", "S2"]})
    with patch('core.services.protocol.database.load_entregas', return_value=mock_df):
        res = protocol_service.get_by_id(123)
        assert res["Serie"] == "S1"
        assert protocol_service.get_by_id(999) == {}

def test_protocol_export(protocol_service):
    mock_df = pd.DataFrame({"Protocolo": [1], "DataEntrega": [""]})
    with patch('core.services.protocol.database.load_entregas', return_value=mock_df):
        csv_str = protocol_service.get_export(filters={"status": "pending"})
        assert "Protocolo;DataEntrega" in csv_str
        assert "1;" in csv_str

def test_protocol_update(protocol_service):
    mock_df = pd.DataFrame({"Protocolo": [1], "Status": ["Pendente"]})
    with patch('core.services.protocol.database.load_entregas', return_value=mock_df), \
         patch('core.services.protocol.database.save_dataframe_csv') as mock_save, \
         patch('core.services.protocol.database.get_data_uri', return_value="file:///tmp/e.csv"):
        
        res = protocol_service.update(1, {"status": "Aguardando"})
        assert res["status"] == "success"
        saved_df = mock_save.call_args[0][0]
        assert saved_df.iloc[0]["Status"] == "Aguardando"

def test_protocol_get_filter_options(protocol_service):
    mock_df = pd.DataFrame({
        "Cidade": ["SPO", "RIO"],
        "DataEntrega": ["", ""]
    })
    with patch('core.services.protocol.database.load_entregas', return_value=mock_df):
        opts = protocol_service.get_filter_options()
        assert "SPO" in opts["cidades"]
        assert "RIO" in opts["cidades"]

def test_protocol_solicitantes_management(protocol_service):
    # Test fallback extraction from Entregas
    mock_entregas = pd.DataFrame({"Solicitante": ["User1"], "Ramal": ["123"]})
    with patch('core.services.protocol.database.load_entregas', return_value=mock_entregas), \
         patch('core.services.protocol.database.get_storage') as mock_storage:
        
        mock_storage.return_value.exists.return_value = False
        res = protocol_service.get_solicitantes(query="User1")
        assert len(res) == 1
        assert res[0]["Solicitante"] == "User1"

    # Test add_solicitante (new file creation)
    with patch('core.services.protocol.database.get_storage') as mock_storage, \
         patch('core.services.protocol.database.save_dataframe_csv') as mock_save, \
         patch('core.services.protocol.database.get_data_uri', return_value="file:///tmp/s.csv"):
        
        mock_storage.return_value.exists.return_value = False
        protocol_service.add_solicitante("NewUser", "456")
        
        saved_df = mock_save.call_args[0][0]
        assert saved_df.iloc[0]["Nome"] == "NewUser"

def test_protocol_cancel(protocol_service):
    mock_entregas = pd.DataFrame({
        "Protocolo": [123],
        "Status": ["Pendente"],
        "Cancelado": ["FALSO"],
        "Obs": [""],
        "IncidenteRds": [""],
        "Funcionario": [""],
        "DataEntrega": [""],
        "Serie": ["SN123"]
    })
    with patch('core.services.protocol.database.load_entregas', return_value=mock_entregas), \
         patch('core.services.protocol.database.save_dataframe_csv') as mock_save, \
         patch('core.services.protocol.database.get_data_uri', return_value="file:///tmp/dummy.csv"):
        
        res = protocol_service.cancel(123, "Test Reason")
        assert res["status"] == "success"
        
        saved_df = mock_save.call_args[0][0]
        assert saved_df.iloc[0]["Status"] == "Cancelado"
        assert "Test Reason" in saved_df.iloc[0]["Obs"]
