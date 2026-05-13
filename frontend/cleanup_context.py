import os
import re

TARGET_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\context'

for f in os.listdir(TARGET_DIR):
    if f.endswith('.jsx'):
        path = os.path.join(TARGET_DIR, f)
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Remove "import React, {" -> "import {"
        content = re.sub(r'import\s+React,\s*\{', 'import {', content)
        # Remove "import React from 'react';"
        content = re.sub(r"import\s+React\s+from\s+['\"]react['\"];?\n?", "", content)
        
        # Specific cleanup for AuthProvider.jsx
        if f == 'AuthProvider.jsx':
             content = content.replace(", useCallback", "").replace("useCallback, ", "")

        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Cleaned {f}")
