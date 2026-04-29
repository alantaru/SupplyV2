import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
from core.services.stock import StockService
from datetime import datetime

@pytest.fixture
def stock_service():
    return StockService(contract_id="TEST_CONTRACT")

def test_stock_get_levels(stock_service):
    mock_df = pd.DataFrame({
        "TipoModelo": ["Toner BK", "A4"],
        "EstoqueAtual": [10, 50],
        "Cor": ["BLACK", ""]
    })
    with patch('core.services.stock.database.load_estoque', return_value=mock_df):
        levels = stock_service.get_levels()
        assert len(levels) == 2
        # Adapter will normalize column names
        assert levels[0]["TipoModelo"] == "Toner BK"

def test_stock_adjust_new_item(stock_service):
    mock_stk = pd.DataFrame(columns=["TipoModelo", "EstoqueAtual", "UltimaAlteracao"])
    mock_hist = pd.DataFrame(columns=["TipoMaterial"])
    
    with patch('core.services.stock.database.load_estoque', return_value=mock_stk), \
         patch('core.services.stock.database.load_estoque_lancamentos', return_value=mock_hist), \
         patch('core.services.stock.database.save_dataframe_csv') as mock_save, \
         patch('core.services.stock.database.get_data_uri', return_value="file:///tmp/s.csv"):
        
        data = {
            "item": "NewToner",
            "qty": 10,
            "user": "Admin",
            "reason": "Initial Load",
            "type": "Entrada"
        }
        res = stock_service.adjust(data)
        assert res["status"] == "success"
        
        # Check stock save
        stock_df = mock_save.call_args_list[0][0][0]
        assert stock_df.iloc[0]["TipoModelo"] == "NewToner"
        assert stock_df.iloc[0]["EstoqueAtual"] == 10

def test_stock_adjust_existing_item(stock_service):
    mock_stk = pd.DataFrame({
        "TipoModelo": ["A4"],
        "EstoqueAtual": [50],
        "UltimaAlteracao": ["01/01/2024"]
    })
    mock_hist = pd.DataFrame(columns=["TipoMaterial"])
    
    with patch('core.services.stock.database.load_estoque', return_value=mock_stk), \
         patch('core.services.stock.database.load_estoque_lancamentos', return_value=mock_hist), \
         patch('core.services.stock.database.save_dataframe_csv') as mock_save, \
         patch('core.services.stock.database.get_data_uri', return_value="file:///tmp/s.csv"):
        
        data = {"item": "A4", "qty": -5, "user": "User1"}
        res = stock_service.adjust(data)
        assert res["status"] == "success"
        
        stock_df = mock_save.call_args_list[0][0][0]
        assert stock_df.iloc[0]["EstoqueAtual"] == 45

def test_stock_update_item(stock_service):
    mock_df = pd.DataFrame({"TipoModelo": ["OldName"], "Codigo": ["C1"]})
    with patch('core.services.stock.database.load_estoque', return_value=mock_df), \
         patch('core.services.stock.database.save_dataframe_csv') as mock_save, \
         patch('core.services.stock.database.get_data_uri', return_value="file:///tmp/s.csv"):
        
        res = stock_service.update_item({"original_item": "OldName", "new_item": "NewName", "code": "C2"})
        assert res["status"] == "success"
        
        saved_df = mock_save.call_args[0][0]
        assert saved_df.iloc[0]["TipoModelo"] == "NewName"
        assert saved_df.iloc[0]["Codigo"] == "C2"

def test_stock_delete_item(stock_service):
    mock_df = pd.DataFrame({"TipoModelo": ["ToDelete"], "EstoqueAtual": [10]})
    with patch('core.services.stock.database.load_estoque', return_value=mock_df), \
         patch('core.services.stock.database.save_dataframe_csv') as mock_save, \
         patch('core.services.stock.database.get_data_uri', return_value="file:///tmp/s.csv"):
        
        res = stock_service.delete_item("ToDelete")
        assert res["status"] == "success"
        assert len(mock_save.call_args[0][0]) == 0

def test_stock_get_history(stock_service):
    mock_df = pd.DataFrame({
        "Modelo": ["A4"],
        "Quantidade": [5],
        "TipoLancamento": ["Entrada"]
    })
    with patch('core.services.stock.database.load_estoque_lancamentos', return_value=mock_df):
        history = stock_service.get_history()
        assert len(history) == 1
        assert history[0]["Modelo"] == "A4"

def test_stock_adjust_zero(stock_service):
    res = stock_service.adjust({"item": "A4", "qty": 0})
    assert res["status"] == "error"
