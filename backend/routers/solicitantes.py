"""
Router de Solicitantes — substitui GET /data/solicitantes de data.py.
Prefixo: /data/solicitantes
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel

try:
    from ..dependencies import get_authorized_session
    from ..core.session import ContractSession
    from ..core.services.solicitantes import SolicitantesService
except (ImportError, ValueError):
    from dependencies import get_authorized_session
    from core.session import ContractSession
    from core.services.solicitantes import SolicitantesService

router = APIRouter(prefix="/data/solicitantes", tags=["solicitantes"])


# ─── Pydantic Models ─────────────────────────────────────────────────────────

class SolicitanteCreate(BaseModel):
    nome: str
    ramal: str = ""
    obs: str = ""


class SolicitanteUpdate(BaseModel):
    ramal: Optional[str] = None
    obs: Optional[str] = None
    area: Optional[str] = None


class AssociateRequest(BaseModel):
    serie: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("")
def list_solicitantes(
    q: str = Query("", alias="q"),
    empresa: str = Query(""),
    source: str = Query(""),
    session: ContractSession = Depends(get_authorized_session),
):
    """Lista solicitantes com filtros opcionais. Compatível com SolicitanteInput.jsx."""
    svc = SolicitantesService(session.contract_id)
    return svc.list_all(query=q, empresa=empresa, source=source)


@router.post("")
def create_solicitante(
    body: SolicitanteCreate,
    session: ContractSession = Depends(get_authorized_session),
):
    """Cria novo solicitante manual."""
    svc = SolicitantesService(session.contract_id)
    try:
        return svc.create(body.nome, body.ramal, body.obs)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.put("/{nome}")
def update_solicitante(
    nome: str,
    body: SolicitanteUpdate,
    session: ContractSession = Depends(get_authorized_session),
):
    """Atualiza Ramal e/ou Obs. Não altera Source."""
    svc = SolicitantesService(session.contract_id)
    try:
        return svc.update(nome, body.ramal, body.obs, body.area)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/{nome}")
def delete_solicitante(
    nome: str,
    session: ContractSession = Depends(get_authorized_session),
):
    """Remove solicitante. Não afeta Entregas.csv."""
    svc = SolicitantesService(session.contract_id)
    try:
        return svc.delete(nome)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/import-from-mapa")
def import_from_mapa(
    session: ContractSession = Depends(get_authorized_session),
):
    """Importação em massa do Mapa. Não sobrescreve registros manuais."""
    svc = SolicitantesService(session.contract_id)
    return svc.import_from_mapa()


@router.post("/{nome}/associate")
def associate_solicitante(
    nome: str,
    body: AssociateRequest,
    session: ContractSession = Depends(get_authorized_session),
):
    """Associa solicitante a equipamento do Mapa."""
    svc = SolicitantesService(session.contract_id)
    try:
        return svc.associate(nome, body.serie)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
