from typing import Optional
try:
    from .. import config
except (ImportError, ValueError):
    import config

from .services.stock import StockService
from .services.protocol import ProtocolService
from .services.equipment import EquipmentService
from .services.route import RouteService
from .services.maintenance import MaintenanceService

class ContractSession:
    """
    Manages the context for a specific contract interaction.
    Instantiates services with the contract_id pre-configured.
    """
    def __init__(self, contract_id: Optional[str] = None):
        # Sanitize contract_id using database logic (or move that logic here)
        if contract_id is None or str(contract_id).lower() in ['null', 'undefined', 'none']:
            self.contract_id = config.DEFAULT_CONTRACT
        else:
            self.contract_id = str(contract_id)
            
        # Initialize Services
        self.stock = StockService(self.contract_id)
        self.protocols = ProtocolService(self.contract_id) 
        self.equipment = EquipmentService(self.contract_id) 
        self.routes = RouteService(self.contract_id)
        self.maintenance = MaintenanceService(self.contract_id)
