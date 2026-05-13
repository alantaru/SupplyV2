"""
Módulo de Testes: Logic Upload (backend.logic_upload)
Descrição: Testes para o fluxo de processamento de upload (Ingestão, Mapeamento, Validação).
Cobertura: process_upload function
Idioma: PT-BR
"""
import pytest
import pandas as pd
from unittest.mock import MagicMock, AsyncMock, patch
from backend.logic_upload import process_upload

@pytest.fixture
def mock_dependencies(fs_isolation):
    with patch("backend.core.contracts.ContractsManager") as MockMgr, \
         patch("backend.logic_upload.RefineryIngestor") as MockIngestor, \
         patch("backend.logic_upload.RefineryMapper") as MockMapper, \
         patch("backend.logic_upload.RefineryNormalizer") as MockNormalizer, \
         patch("backend.logic_upload.save_file") as MockSave, \
         patch("backend.logic_upload.os.remove") as MockRemove:
         
        # Setup Default Mocks
        mgr_instance = MockMgr.return_value
        mgr_instance.get_required_columns.return_value = ["SERIE"] 
        mgr_instance.get_optional_columns.return_value = []
        mgr_instance.get_mappings.return_value = {"MAPA": {"SERIE": "Serial Number"}} # Saved map exists
        
        # Ingestor returns a DF
        ingestor_instance = MockIngestor.return_value
        ingestor_instance.ingest.return_value = pd.DataFrame({"Serial Number": ["123"]})
        
        # Mapper
        mapper_instance = MockMapper.return_value
        mapper_instance.auto_map.return_value = {"serie": "Serial Number"}
        mapper_instance.apply_mapping.return_value = pd.DataFrame({"SERIE": ["123"]}) # Mapped DF
        
        # Normalizer
        norm_instance = MockNormalizer.return_value
        norm_instance.normalize.return_value = pd.DataFrame({"SERIE": ["123"]})
        
        yield {
            "mgr": mgr_instance, 
            "ingestor": ingestor_instance, 
            "mapper": mapper_instance,
            "save": MockSave,
            "remove": MockRemove
        }

@pytest.mark.asyncio
async def test_process_upload_success(mock_dependencies, tmp_path):
    """
    Cenário: Upload de arquivo válido que é mapeado automaticamente.
    Ação: process_upload("MAPA", file).
    Resultado: Sucesso, arquivo salvo.
    """
    # Mock UploadFile
    mock_file = MagicMock()
    mock_file.read = AsyncMock(return_value=b"content")
    
    result = await process_upload("MAPA", mock_file, "123")
    
    assert result["status"] == "success"
    mock_dependencies["save"].assert_called_once()
    mock_dependencies["remove"].assert_called()

@pytest.mark.asyncio
async def test_process_upload_mapping_required(mock_dependencies):
    """
    Cenário: Arquivo faltando colunas obrigatórias após auto-map.
    Ação: process_upload("MAPA", file) onde auto-map falha para coluna obrigatória.
    Resultado: status mapping_required.
    """
    deps = mock_dependencies
    # Require X, but Ingestor returns Y
    deps["mgr"].get_required_columns.return_value = ["SERIE", "OUTRO"]
    # Mapper maps "serie" but not "OUTRO"
    deps["mapper"].apply_mapping.return_value = pd.DataFrame({"SERIE": ["123"]}) # Missing OUTRO
    
    mock_file = MagicMock()
    mock_file.read = AsyncMock(return_value=b"content")
    
    result = await process_upload("MAPA", mock_file, "123")
    
    assert result["status"] == "mapping_required"
    assert "OUTRO" in result["missing_after_mapping"]
    deps["save"].assert_not_called()

@pytest.mark.asyncio
async def test_process_upload_unknown_type(mock_dependencies):
    """
    Cenário: Upload de tipo desconhecido (Legacy).
    Ação: process_upload("UNKNOWN", file).
    Resultado: Salvo direto sem Refinaria.
    """
    mock_file = MagicMock()
    mock_file.read = AsyncMock(return_value=b"content")
    
    deps = mock_dependencies
    # Use side_effect to enforce logic based on input
    def get_reqs(key):
        return [] if key == "UNKNOWN" else ["SERIE"]
    deps["mgr"].get_required_columns.side_effect = get_reqs
    
    # Create contract directory to ensure save path exists
    from backend import config
    (config.CONTRACTS_DIR / "123").mkdir(parents=True, exist_ok=True)
    
    result = await process_upload("UNKNOWN", mock_file, "123")
    
    assert result["status"] == "success"
    assert "File saved directly" in result["message"]
    # Verify Refinery was NOT used
    deps["ingestor"].ingest.assert_not_called()
