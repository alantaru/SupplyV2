from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
try:
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
    from .. import logic_archive
except (ImportError, ValueError):
    from core.session import ContractSession
    from dependencies import get_authorized_session
    import logic_archive

router = APIRouter(prefix="/archive", tags=["archive"])

class SplitRequest(BaseModel):
    cutoff_date: str # YYYY-MM-DD

@router.post("/split")
def split_database(
    req: SplitRequest, 
    session: ContractSession = Depends(get_authorized_session)
):
    result = logic_archive.split_entregas_by_date(req.cutoff_date, session.contract_id)
    if result["status"] == "error":
        raise HTTPException(status_code=400, detail=result["message"])
    return result

@router.get("/list")
def list_archives(session: ContractSession = Depends(get_authorized_session)):
    return logic_archive.list_archives(session.contract_id)

@router.get("/download/{filename}")
def download_archive(filename: str, session: ContractSession = Depends(get_authorized_session)):
    """Download a specific archived file."""
    import fsspec
    from fastapi.responses import StreamingResponse
    try:
        from .. import database
    except (ImportError, ValueError):
        import database

    prefix = logic_archive.get_history_prefix(session.contract_id)
    archive_key = f"{prefix}{filename}"

    if not database.get_storage().exists(archive_key):
        raise HTTPException(status_code=404, detail="Arquivo arquivado não encontrado.")

    uri = database.get_storage().get_uri(archive_key)

    def iterfile():
        with fsspec.open(uri, "rb") as f:
            yield from f

    return StreamingResponse(
        iterfile(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
