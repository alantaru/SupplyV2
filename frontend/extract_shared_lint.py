import json
import os

LINT_FILE = r'c:\Users\uz02095\Documents\Supply_2026\frontend\lint_output.json'
TARGET_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src\components\Shared'

with open(LINT_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

for item in data:
    path = item['filePath']
    if TARGET_DIR.lower() in path.lower():
        print(f"\nFile: {os.path.basename(path)}")
        for msg in item['messages']:
            print(f"  Line {msg['line']}: {msg['ruleId']} - {msg['message']}")
