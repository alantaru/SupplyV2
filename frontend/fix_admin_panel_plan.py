import os

FILE = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Admin\AdminPanel.jsx'

with open(FILE, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    # 1. Remove unused React
    if line.startswith('import React,'):
        line = line.replace('import React,', 'import')
    
    # 2. Add missing useToast destructuring in ContractsTab and BasePurgePanel
    if 'function ContractsTab() {' in line:
        new_lines.append(line)
        new_lines.append('    const { addToast } = useToast();\n')
        continue
    
    if 'function BasePurgePanel({ addToast }) {' in line:
        # BasePurgePanel already has addToast as prop? 
        # Check: Line 1107: function BasePurgePanel({ addToast }) {
        # If it's a prop, why is it undefined? Ah, maybe it's passed but used as addToast?
        # Let's check line 1107.
        pass

    new_lines.append(line)

# Actually, I'll just do it manually with multi_replace_file_content for precision.
