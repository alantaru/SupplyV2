import os
import re

ROOT_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src'

for root, dirs, files in os.walk(ROOT_DIR):
    for f in files:
        if f.endswith('.jsx') or f.endswith('.js'):
            path = os.path.join(root, f)
            try:
                with open(path, 'r', encoding='utf-8') as file:
                    content = file.read()
                
                # Remove "import React, {" -> "import {"
                new_content = re.sub(r'import\s+React,\s*\{', 'import {', content)
                # Remove "import React from 'react';"
                new_content = re.sub(r"import\s+React\s+from\s+['\"]react['\"];?\n?", "", new_content)
                
                if new_content != content:
                    with open(path, 'w', encoding='utf-8') as file:
                        file.write(new_content)
                    print(f"Cleaned {os.path.relpath(path, ROOT_DIR)}")
            except Exception as e:
                print(f"Error processing {f}: {e}")
