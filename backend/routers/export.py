from fastapi import APIRouter, Query, Depends
from fastapi.responses import StreamingResponse
try:
    from ..core.services.export import ExportService
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    from core.services.export import ExportService
    from core.session import ContractSession
    from dependencies import get_authorized_session
from typing import List, Optional

router = APIRouter(prefix="/export", tags=["Export"])

@router.get("/pendencias")
def export_pendencias(session: ContractSession = Depends(get_authorized_session)):
    service = ExportService(session.contract_id)
    buffer = service.export_pendencias(session.contract_id)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pendencias_entrega.csv"}
    )

@router.get("/stock/levels")
def export_stock_levels(session: ContractSession = Depends(get_authorized_session)):
    service = ExportService(session.contract_id)
    buffer = service.export_stock_levels(session.contract_id)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=estoque_geral.csv"}
    )

@router.get("/stock/history")
def export_stock_history(session: ContractSession = Depends(get_authorized_session)):
    service = ExportService(session.contract_id)
    buffer = service.export_stock_history(session.contract_id)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historico_movimentacoes.csv"}
    )

@router.get("/routes/planning")
def export_route_planning(session: ContractSession = Depends(get_authorized_session)):
    service = ExportService(session.contract_id)
    buffer = service.export_route_planning(session.contract_id)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=planejamento_rotas.csv"}
    )

@router.post("/routes/analysis")
def export_route_analysis(
    series: List[str],
    route_name: Optional[str] = Query(None),
    session: ContractSession = Depends(get_authorized_session)
):
    service = ExportService(session.contract_id)
    buffer = service.export_route_analysis(session.contract_id, series)
    filename = f"rota_{route_name or 'analise'}.csv"
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/inventory")
def export_inventory(session: ContractSession = Depends(get_authorized_session)):
    service = ExportService(session.contract_id)
    buffer = service.export_inventory(session.contract_id)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=inventario_completo.csv"}
    )

@router.get("/deliveries")
def export_deliveries(
    status: str = "all",
    city: str = None,
    fila: str = None,
    empresa: str = None,
    search: str = None,
    start_date: str = None,
    end_date: str = None,
    session: ContractSession = Depends(get_authorized_session)
):
    service = ExportService(session.contract_id)
    filters = {
        "status": status,
        "city": city,
        "fila": fila,
        "empresa": empresa,
        "search": search,
        "start_date": start_date,
        "end_date": end_date
    }
    # Remove None values
    filters = {k: v for k, v in filters.items() if v is not None}

    buffer = service.export_deliveries(session.contract_id, filters)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=historico_entregas.csv"}
    )
