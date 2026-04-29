from fastapi import APIRouter, Depends, HTTPException
try:
    from ..core.session import ContractSession
    from ..dependencies import get_authorized_session
except (ImportError, ValueError):
    from core.session import ContractSession
    from dependencies import get_authorized_session

router = APIRouter(prefix="/stock", tags=["stock"])

@router.get("/")
def get_stock(session: ContractSession = Depends(get_authorized_session)):
    return session.stock.get_levels()

@router.get("/history")
def get_history(session: ContractSession = Depends(get_authorized_session)):
    return session.stock.get_history()

@router.post("/adjust")
def adjust_stock(data: dict, session: ContractSession = Depends(get_authorized_session)):
    # data: { item: str, qty: int, user: str, reason: str, empresa: str, code: str }
    return session.stock.adjust(data)

@router.post("/item")
def create_item(data: dict, session: ContractSession = Depends(get_authorized_session)):
    """
    Cria um novo item de estoque com categoria definida.
    Categorias: 'papel', 'toner', 'customizado'.
    """
    result = session.stock.create_item(data)
    if result.get("status") == "error":
        msg = result.get("message", "Erro ao criar item")
        if "já existe" in msg.lower():
            raise HTTPException(status_code=409, detail=msg)
        raise HTTPException(status_code=422, detail=msg)
    return result

@router.get("/modelos")
def get_modelos(session: ContractSession = Depends(get_authorized_session)):
    """Retorna lista de modelos únicos do MAPA.csv para dropdown de toners."""
    return session.stock.get_modelos()

@router.put("/item")
def update_item(data: dict, session: ContractSession = Depends(get_authorized_session)):
    # data: { original_item: str, new_item: str, code: str, empresa: str }
    return session.stock.update_item(data)

@router.delete("/item")
def delete_item(item: str, session: ContractSession = Depends(get_authorized_session)):
    # item maps to query parameter ?item=...
    return session.stock.delete_item(item)
