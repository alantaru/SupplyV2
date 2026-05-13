"""
Analyze lint_output.json to find which errors remain AFTER our cleanups.
Cross-references current file content against reported errors.
"""
import json
import os
import re

LINT_FILE = r'c:\Users\uz02095\Documents\Supply_2026\frontend\lint_output.json'
SRC_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src'

with open(LINT_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

remaining = []

for item in data:
    path = item['filePath']
    if not os.path.exists(path):
        continue
    
    with open(path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    for msg in item['messages']:
        rule = msg.get('ruleId', '')
        line = msg.get('line', 0)
        message = msg.get('message', '')
        
        # Skip React import errors - already cleaned
        if rule == 'no-unused-vars' and "'React'" in message:
            # Check if React import still exists
            if re.search(r'import\s+React\b', content):
                remaining.append({
                    'file': os.path.relpath(path, SRC_DIR),
                    'line': line,
                    'rule': rule,
                    'message': message
                })
            continue
        
        # For non-React errors, they likely still exist
        if rule not in ('no-unused-vars',):
            remaining.append({
                'file': os.path.relpath(path, SRC_DIR),
                'line': line,
                'rule': rule,
                'message': message
            })
        else:
            # Check if the unused var still exists in file  
            # Extract var name from message like "'X' is defined but never used"
            match = re.search(r"'([^']+)'", message)
            if match:
                var_name = match.group(1)
                # Simple check: is the var still in the file?
                if var_name in content:
                    remaining.append({
                        'file': os.path.relpath(path, SRC_DIR),
                        'line': line,
                        'rule': rule,
                        'message': message
                    })

# Group by rule
from collections import Counter
rule_counts = Counter(r['rule'] for r in remaining)

print(f"=== ESTIMATED REMAINING ERRORS: {len(remaining)} ===")
print()
for rule, count in rule_counts.most_common():
    print(f"  {rule}: {count}")

print(f"\n=== BY FILE (non-React unused-vars) ===")
for r in remaining:
    if r['rule'] != 'no-unused-vars' or "'React'" not in r['message']:
        print(f"  {r['file']}:{r['line']} [{r['rule']}] {r['message'][:80]}")
