import os
import re

TARGET_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Shared'

for f in os.listdir(TARGET_DIR):
    if f.endswith('.jsx'):
        path = os.path.join(TARGET_DIR, f)
        with open(path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        # Remove "import React, {" -> "import {"
        content = re.sub(r'import\s+React,\s*\{', 'import {', content)
        # Remove "import React from 'react';"
        content = re.sub(r"import\s+React\s+from\s+['\"]react['\"];?\n?", "", content)
        
        # Specific cleanup for ExportButton.jsx
        if f == 'ExportButton.jsx':
            content = content.replace("import { Download, File, Loader2 } from 'lucide-react';", "import { Download, Loader2 } from 'lucide-react';")

        with open(path, 'w', encoding='utf-8') as file:
            file.write(content)
        print(f"Cleaned {f}")
