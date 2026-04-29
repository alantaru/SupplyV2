from fastapi import APIRouter, Depends, Query
from typing import Optional
try:
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
    from ..core.services.bi import BIService
except (ImportError, ValueError):
    from core.session import ContractSession
    from dependencies import get_authorized_session
    from core.services.bi import BIService

router = APIRouter(prefix="/bi", tags=["BI"])


@router.get("/dashboard")
def get_bi_dashboard(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    session: ContractSession = Depends(get_authorized_session)
):
    service = BIService(session.contract_id)
    return service.compute(start_date=start_date, end_date=end_date)
