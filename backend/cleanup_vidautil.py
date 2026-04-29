import pandas as pd
import os
from pathlib import Path

# Since we migrated to S3, we might need to clean up S3 files.
# But for local files on EC2 that might be synced, we clean them too.

def clean_csv(path):
    try:
        df = pd.read_csv(path, sep=';', encoding='utf-8-sig')
        if 'VIDAUTILTONER' in df.columns or 'VidaUtilToner' in df.columns:
            print(f"Cleaning {path}...")
            df = df.drop(columns=[col for col in df.columns if col.upper() == 'VIDAUTILTONER'])
            df.to_csv(path, index=False, sep=';', encoding='utf-8-sig')
            return True
    except Exception as e:
        print(f"Error cleaning {path}: {e}")
    return False

if __name__ == "__main__":
    # Target common locations
    base_dir = Path("/app/contracts")
    if not base_dir.exists():
        base_dir = Path("contracts")

    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith("Mapa.csv") or file.endswith("Entregas.csv"):
                clean_csv(os.path.join(root, file))
