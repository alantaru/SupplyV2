from fastapi import APIRouter, UploadFile, File, HTTPException, Query, Depends
try:
    from .. import logic_upload, database
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    import logic_upload
    import database
    from core.session import ContractSession
    from dependencies import get_authorized_session

router = APIRouter()

@router.post("/upload/csv/{file_key}")
async def upload_file(
    file_key: str, 
    file: UploadFile = File(...),
    force_review: bool = Query(False),
    session: ContractSession = Depends(get_authorized_session)
):
    """
    Upload and replace a CSV file.
    contract_id always comes from the authenticated session — no override allowed.
    """
    return await logic_upload.process_upload(file_key, file, session.contract_id, force_review=force_review)

@router.get("/backups/{file_key}")
def list_backups(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    """
    List available backups for a file key.
    """
    return logic_upload.list_backups(file_key, session.contract_id)

@router.post("/restore/{filename}")
def restore_backup(filename: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Restore a specific backup file.
    """
    return logic_upload.restore_backup(filename, session.contract_id)

@router.delete("/backups/{filename}")
def delete_backup(filename: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Delete a specific backup file.
    """
    return logic_upload.delete_backup(filename, session.contract_id)

@router.get("/preview/{file_key}")
def preview_file(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Get preview of current file (dates, first 20 rows).
    """
    return logic_upload.get_preview(file_key, session.contract_id)

@router.get("/download/{file_key}")
def download_file(file_key: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Download the specified file (CSV/Excel).
    """
    file_key = file_key.upper()
    
    # S3 / Storage Abstraction
    key = database.get_data_key(file_key, session.contract_id)
    if not database.get_storage().exists(key):
        raise HTTPException(status_code=404, detail="Arquivo não encontrado.")
    
    # Get URI (s3://... or file://...)
    uri = database.get_data_uri(file_key, session.contract_id)
    
    # Use fsspec to open the file (stream)
    import fsspec
    from fastapi.responses import StreamingResponse
    
    def iterfile():
        # Open in binary mode for streaming
        with fsspec.open(uri, "rb") as f:
            yield from f

    # Determine media type based on key/URI extension? 
    # Actually our keys usually end in .csv but sometimes .xlsx (ROTAS)
    media_type = "text/csv"
    filename = f"{file_key}.csv"
    
    if key.lower().endswith('.xlsx'):
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{file_key}.xlsx"
        
    return StreamingResponse(
        iterfile(), 
        media_type=media_type, 
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/download-backup/{filename}")
def download_backup_file(filename: str, session: ContractSession = Depends(get_authorized_session)):
    """
    Download a specific backup file by filename.
    """
    import fsspec
    from fastapi.responses import StreamingResponse

    backup_key = f"{session.contract_id}/backups/{filename}"
    if not database.get_storage().exists(backup_key):
        raise HTTPException(status_code=404, detail="Backup não encontrado.")

    uri = database.get_storage().get_uri(backup_key)

    def iterfile():
        with fsspec.open(uri, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/upload/confirm-mapping")
async def confirm_mapping_endpoint(
    payload: dict, # temp_token, mapping, save_for_future
    session: ContractSession = Depends(get_authorized_session)
):
    """
    Confirm validation mapping for a pending upload.
    contract_id always comes from the authenticated session.
    """
    return logic_upload.confirm_mapping(session.contract_id, payload)

@router.post("/upload/csv/{file_key}/delete")
async def delete_csv_file(
    file_key: str,
    session: ContractSession = Depends(get_authorized_session)
):
    """
    Deletes an individual data file. Only for Admins/Superadmins (handled by get_authorized_session + logic_upload).
    """
    return logic_upload.delete_data_file(file_key, session.contract_id)
