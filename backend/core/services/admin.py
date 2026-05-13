from typing import List, Dict, Any
import logging
try:
    from .. import users
    from ..core.contracts import ContractsManager
except (ImportError, ValueError):
    import users
    from core.contracts import ContractsManager

logger = logging.getLogger(__name__)

class AdminService:
    def __init__(self, admin_username: str, admin_role: str):
        self.admin_username = admin_username
        self.admin_role = admin_role
        self.mgr = ContractsManager()

    def list_users(self) -> List[Dict[str, Any]]:
        all_users = users.load_users()
        safe_list = []
        superadmin_usernames = {u for u, d in all_users.items() if d.get("role") == "superadmin"}

        for u, data in all_users.items():
            if self.admin_role != "superadmin":
                if data.get("role") == "superadmin":
                    continue
                if u != self.admin_username and not self._admin_manages_user(self.admin_username, data):
                    continue

            user_info = data.copy()
            user_info["username"] = u
            user_info.pop("password", None)
            user_info.pop("recovery_key_hash", None)

            raw_admin_ids = self._get_user_admin_ids(data)
            if self.admin_role != "superadmin":
                user_info["admin_ids"] = [a for a in raw_admin_ids if a not in superadmin_usernames]
            else:
                user_info["admin_ids"] = raw_admin_ids

            safe_list.append(user_info)
        return safe_list

    def _get_user_admin_ids(self, user_data: Dict[str, Any]) -> List[str]:
        if "admin_ids" in user_data:
            v = user_data["admin_ids"]
            return v if isinstance(v, list) else [v]
        legacy = user_data.get("created_by", "")
        return [legacy] if legacy else []

    def _admin_manages_user(self, admin_username: str, user_data: Dict[str, Any]) -> bool:
        return admin_username in self._get_user_admin_ids(user_data)

    def _get_contract_admin_ids(self, contract: Dict[str, Any]) -> List[str]:
        if "admin_ids" in contract:
            v = contract["admin_ids"]
            return v if isinstance(v, list) else [v]
        legacy = contract.get("admin_id", "")
        return [legacy] if legacy else []

    def _admin_owns_contract(self, admin_username: str, contract: Dict[str, Any]) -> bool:
        return admin_username in self._get_contract_admin_ids(contract)
