from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import base64
from pathlib import Path

router = APIRouter(prefix="/debug", tags=["Debug"])

# Define the verification directory relative to this file or specific workspace path
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent
VERIFICATION_DIR = WORKSPACE_ROOT / "exports_verification"

class SaveDownloadRequest(BaseModel):
    filename: str
    content: str  # Base64 encoded content
    target_dir: Optional[str] = None

@router.post("/save-download")
async def save_download(request: SaveDownloadRequest):
    # Determine base directory
    if request.target_dir:
        base_dir = Path(request.target_dir)
    else:
        # Default to workspace exports_verification
        base_dir = VERIFICATION_DIR
    
    try:
        base_dir.mkdir(parents=True, exist_ok=True)
        file_path = base_dir / request.filename
        
        # Decode base64 content
        file_content = base64.b64decode(request.content)
        
        with open(file_path, "wb") as f:
            f.write(file_content)
            
        return {"status": "success", "path": str(file_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/test-save")
def test_save():
    """Returns a dummy CSV for verification of the internal download mechanism."""
    from fastapi.responses import StreamingResponse
    import io
    
    output = io.StringIO()
    output.write("id,status,mensagem\n1,success,Teste de conexao bem sucedido\n2,info,Destino verificado")
    output.seek(0)
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=teste_conexao.csv"}
    )
