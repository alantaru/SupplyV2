"""
Módulo de Testes: Upload Integration Flow
Descrição: Testes de integração para o fluxo completo de upload via API.
Cobertura: /upload/csv, /backups, /restore, /upload/confirm-mapping
Idioma: PT-BR
"""
import pytest
from fastapi.testclient import TestClient
from backend.core.contracts import ContractsManager

@pytest.fixture
def setup_contract(fs_isolation, clean_fs):
    """Garante que existam metadados do contrato 6071 com mapeamento inicial"""
    mgr = ContractsManager()
    # clean_fs wipes contracts dir, so we must recreate
    try:
        mgr.create_contract("6071", "Test Contract", "Integration Test")
        # Seed Mappings for PAPEL to avoid 'mapping_required' on first upload
        mgr.save_mapping("6071", "PAPEL", {"SERIE": "SERIE", "A4RESMA": "A4RESMA", "MEDIA": "MEDIA"})
    except ValueError:
        pass # Already exists
    return "6071"

@pytest.mark.integration
def test_upload_simple_file(client: TestClient, mock_auth_admin, setup_contract):
    """
    Cenário: Upload de arquivo PAPEL simples.
    Ação: POST /upload/csv/PAPEL.
    Resultado: 200 OK e arquivo salvo.
    """
    csv_content = "SERIE;A4RESMA;MEDIA\nABC123;10;100"
    files = {"file": ("papel.csv", csv_content, "text/csv")}
    
    response = client.post(
        "/upload/csv/PAPEL?contract_id=6071", 
        headers=mock_auth_admin, 
        files=files
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    
    # Verify backup listing
    res_bkp = client.get("/backups/PAPEL?contract_id=6071", headers=mock_auth_admin)
    assert res_bkp.status_code == 200
    backups = res_bkp.json()
    # Initial save might not trigger backup unless file existed before. 
    # Logic in `logic_upload.save_file`: if target.exists() -> backup.
    # First upload -> No backup created yet (unless we loop).
    
    # Upload AGAIN to trigger backup
    client.post( "/upload/csv/PAPEL?contract_id=6071", headers=mock_auth_admin, files=files)
    
    res_bkp2 = client.get("/backups/PAPEL?contract_id=6071", headers=mock_auth_admin)
    backups2 = res_bkp2.json()
    assert len(backups2) >= 1

@pytest.mark.integration
def test_delete_backup(client: TestClient, mock_auth_admin, setup_contract):
    """
    Cenário: Deletar um backup existente.
    Ação: Criar 2 versões -> Listar -> Deletar um.
    Resultado: Backup removido da lista.
    """
    # 1. Create file 1
    files1 = {"file": ("papel1.csv", "SERIE;A4RESMA\n1;1", "text/csv")}
    client.post("/upload/csv/PAPEL?contract_id=6071", headers=mock_auth_admin, files=files1)
    
    # 2. Create file 2 (Backup generated)
    files2 = {"file": ("papel2.csv", "SERIE;A4RESMA\n2;2", "text/csv")}
    client.post("/upload/csv/PAPEL?contract_id=6071", headers=mock_auth_admin, files=files2)
    
    # 3. List
    res_list = client.get("/backups/PAPEL?contract_id=6071", headers=mock_auth_admin)
    backups = res_list.json()
    assert len(backups) > 0
    target_bkp = backups[0]["filename"]
    
    # 4. Delete
    res_del = client.delete(f"/backups/{target_bkp}?contract_id=6071", headers=mock_auth_admin)
    assert res_del.status_code == 200
    
    # 5. Verify gone
    res_list_after = client.get("/backups/PAPEL?contract_id=6071", headers=mock_auth_admin)
    current_filenames = [b["filename"] for b in res_list_after.json()]
    assert target_bkp not in current_filenames

@pytest.mark.integration
def test_upload_mapping_required_flow(client: TestClient, mock_auth_admin, setup_contract):
    """
    Cenário: Upload que exige mapeamento manual.
    Ação: Upload CSV com header desconhecido -> Receber 'mapping_required' -> Confirmar Mapping.
    Resultado: Sucesso após confirmação.
    """
    # Arquivo com header totalmente desconhecido para evitar Fuzzy Match
    csv_content = "ABACAXI;VALOR\nSN123;99"
    files = {"file": ("unknown.csv", csv_content, "text/csv")}
    
    # 1. Upload
    response = client.post(
        "/upload/csv/PAPEL?contract_id=6071", 
        headers=mock_auth_admin, 
        files=files
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "mapping_required", f"Expected mapping_required, got {data['status']}. Full: {data}"
    assert "temp_token" in data
    
    temp_token = data["temp_token"]
    
    # 2. Confirm Mapping
    confirmed_payload = {
        "temp_token": temp_token,
        "file_key": "PAPEL",
        "mapping": {"SERIE": "ABACAXI"}, # Map canonical SERIE to input ABACAXI
        "save_for_future": False
    }
    
    res_confirm = client.post(
        "/upload/confirm-mapping?contract_id=6071",
        headers=mock_auth_admin,
        json=confirmed_payload
    )
    
    assert res_confirm.status_code == 200
    data_confirm = res_confirm.json()
    assert data_confirm["status"] == "success"
