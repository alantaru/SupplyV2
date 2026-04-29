import shutil
from pathlib import Path

# Setup paths
BASE_DIR = Path(r"C:\Users\uz02095\Documents\Supply_2026")
CONTRACTS_DIR = BASE_DIR / "contracts"
TARGET_DIR = CONTRACTS_DIR / "6070"

FILES_TO_MOVE = [
    "Entregas.csv",
    "Mapa.csv",
    "Papel.csv",
    "Contadores.csv",
    "Planejamento_Rotas.xlsx",
    "Estoque.csv",
    "EstoqueLancamentos.csv",
    "Solicitantes.csv"
]

def migrate():
    print(f"Starting migration to {TARGET_DIR}...")
    
    # 1. Create Target Dir
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    
    # 2. Move Files
    for filename in FILES_TO_MOVE:
        src = BASE_DIR / filename
        dst = TARGET_DIR / filename
        
        if src.exists():
            print(f"Moving {filename}...")
            shutil.move(str(src), str(dst))
        else:
            print(f"Skipping {filename} (Not found in root)")
            
    # 3. Move Backups Folder
    backup_src = BASE_DIR / "backups"
    backup_dst = TARGET_DIR / "backups"
    
    if backup_src.exists():
        print("Moving backups folder...")
        if backup_dst.exists():
            print("Target backups folder exists. Merging content...")
            for item in backup_src.iterdir():
                shutil.move(str(item), str(backup_dst / item.name))
            shutil.rmtree(backup_src)
        else:
            shutil.move(str(backup_src), str(backup_dst))
            
    print("Migration completed.")

if __name__ == "__main__":
    migrate()
