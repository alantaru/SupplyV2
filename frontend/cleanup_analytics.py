import os
import re

TARGET_DIRS = [
    r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Analytics',
    r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Analytics\tabs',
    r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Analytics\widgets'
]

for target_dir in TARGET_DIRS:
    if not os.path.exists(target_dir): continue
    for f in os.listdir(target_dir):
        if f.endswith('.jsx'):
            path = os.path.join(target_dir, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            
            # Remove "import React, {" -> "import {"
            content = re.sub(r'import\s+React,\s*\{', 'import {', content)
            # Remove "import React from 'react';"
            content = re.sub(r"import\s+React\s+from\s+['\"]react['\"];?\n?", "", content)
            
            # Specific cleanups
            if f == 'DeliveriesTab.jsx':
                content = content.replace(", Legend", "").replace(" Legend,", "")

            with open(path, 'w', encoding='utf-8') as file:
                file.write(content)
            print(f"Cleaned {f}")
