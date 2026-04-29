from datetime import datetime
try:
    from . import database
    from .core.contracts import ContractsManager
    from . import config
except (ImportError, ValueError):
    try:
        import database
        from core.contracts import ContractsManager
        import config
    except (ImportError, ValueError):
        pass

def reset_contract_database(contract_id: str):
    """
    Virada de Período (Split):
    1. Salva cópias de Entregas, Estoque e EstoqueLancamentos em reset_backups/ com timestamp.
    2. Re-inicializa os arquivos com headers padrão (base limpa).
    Os arquivos salvos ficam disponíveis para download via /admin/contracts/{id}/reset-backups.
    """
    storage = database.get_storage()
    mgr = ContractsManager()

    files_to_reset = ["ENTREGAS", "ESTOQUE", "ESTOQUE_LANCAMENTOS"]

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_folder = f"{contract_id}/reset_backups/{timestamp}/"
    saved_files = []

    for file_key in files_to_reset:
        key = database.get_data_key(file_key, contract_id)
        if storage.exists(key):
            filename = config.FILES.get(file_key, f"{file_key.lower()}.csv")
            dest_key = f"{backup_folder}{filename}"
            storage.ensure_dir(dest_key)
            storage.copy(key, dest_key)
            storage.delete(key)
            saved_files.append(filename)

    # Re-inicializa com bases limpas
    mgr.initialize_files(contract_id)

    return {
        "status": "success",
        "message": f"Virada de período concluída. {len(saved_files)} arquivo(s) arquivado(s).",
        "backup_folder": backup_folder,
        "saved_files": saved_files,
        "timestamp": timestamp
    }


def list_reset_backups(contract_id: str):
    """Lista todos os conjuntos de reset_backups disponíveis para download."""
    storage = database.get_storage()
    prefix = f"{contract_id}/reset_backups/"

    try:
        all_files = storage.list_files(prefix)
    except Exception:
        return []

    # Agrupa por timestamp (subpasta)
    groups = {}
    for filepath in all_files:
        # filepath pode ser "20250101_120000/Entregas.csv" ou similar
        parts = filepath.split('/')
        if len(parts) >= 2:
            ts = parts[0]
            fname = parts[-1]
        else:
            ts = "legacy"
            fname = filepath

        if ts not in groups:
            groups[ts] = {"timestamp": ts, "files": [], "date": ""}
            try:
                dt = datetime.strptime(ts, "%Y%m%d_%H%M%S")
                groups[ts]["date"] = dt.strftime("%d/%m/%Y %H:%M:%S")
            except Exception:
                groups[ts]["date"] = ts

        full_key = f"{prefix}{filepath}"
        meta = storage.get_metadata(full_key)
        size = meta.get('size', 0)
        groups[ts]["files"].append({
            "filename": fname,
            "full_path": filepath,
            "size": f"{size / 1024:.1f} KB" if size else "—"
        })

    return sorted(groups.values(), key=lambda x: x["timestamp"], reverse=True)
