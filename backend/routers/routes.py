from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
try:
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    from core.session import ContractSession
    from dependencies import get_authorized_session

router = APIRouter(prefix="/routes", tags=["Routes"])

class RouteCreate(BaseModel):
    name: str
    series: List[str]
    filters: Optional[List[Dict[str, str]]] = None
    excluded_series: Optional[List[str]] = None

class AnalyzeRequest(BaseModel):
    series: List[str]

class PreviewRequest(BaseModel):
    filters: List[Dict[str, str]]
    excluded_series: Optional[List[str]] = None

class GenerateRequest(BaseModel):
    selection: List[Dict[str, Any]]
    # selection items must match what generate_protocols expects


class SettingsUpdate(BaseModel):
    cycle_days_threshold: int
    alert_enabled: bool

class MetadataUpdate(BaseModel):
    scheduled_date: Optional[str] = ""
    notes: Optional[str] = ""

@router.get("/settings")
def get_settings(session: ContractSession = Depends(get_authorized_session)):
    return session.routes.load_settings()

@router.post("/settings")
def update_settings(settings: SettingsUpdate, session: ContractSession = Depends(get_authorized_session)):
    return session.routes.save_settings(settings.model_dump())

@router.post("/{name}/metadata")
def update_metadata(name: str, meta: MetadataUpdate, session: ContractSession = Depends(get_authorized_session)):
    # We use .model_dump(exclude_unset=True) to allow partial updates if needed, 
    # but here we update what is sent.
    return session.routes.update_metadata(name, meta.model_dump())

@router.get("/")
def list_routes(session: ContractSession = Depends(get_authorized_session)):
    return session.routes.list_routes()

@router.get("/planning")
def get_planning_summary(session: ContractSession = Depends(get_authorized_session)):
    return session.routes.get_planning_summary()

@router.post("/")
def save_route(route: RouteCreate, session: ContractSession = Depends(get_authorized_session)):
    return session.routes.save_route(route.name, route.series, route.filters, route.excluded_series)

@router.delete("/{name}")
def delete_route(name: str, session: ContractSession = Depends(get_authorized_session)):
    success = session.routes.delete_route(name)
    if not success:
        raise HTTPException(status_code=404, detail="Route not found")
    return {"status": "deleted"}

@router.post("/analyze")
def analyze_route(req: AnalyzeRequest, session: ContractSession = Depends(get_authorized_session)):
    return session.routes.analyze_route(req.series)

@router.post("/preview")
def preview_route(req: PreviewRequest, session: ContractSession = Depends(get_authorized_session)):
    return session.routes.preview_from_filters(req.filters, req.excluded_series)

@router.post("/generate")
def generate_protocol_batch(req: GenerateRequest, session: ContractSession = Depends(get_authorized_session)):
    # Pass protocol service instance so RouteService can use it
    ids = session.routes.generate_protocols(req.selection, session.protocols)
    return {"created_ids": ids}
