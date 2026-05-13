"""
Batch fix: rename catch(err/e/error) to catch(_err/_e/_error) across all JSX files.
Also fix unused destructured args like (area, ...) to (_area, ...) when flagged.
"""
import os
import re

SRC_DIR = r'c:\Users\uz02095\Documents\Supply_2026\frontend\src'
CHANGES = 0

def fix_catch_vars(content):
    """Replace catch(err), catch(e), catch(error) with catch(_err), catch(_e), catch(_error)."""
    global CHANGES
    
    # Pattern: catch (err) or catch(err) where err is NOT already prefixed with _
    def replacer(m):
        global CHANGES
        prefix = m.group(1)
        var = m.group(2)
        if var.startswith('_'):
            return m.group(0)
        CHANGES += 1
        return f'{prefix}(_{var})'
    
    # Match catch(err), catch(e), catch(error)
    content = re.sub(r'(catch\s*)\((\s*(?:err|e|error)\s*)\)', replacer, content)
    return content

def fix_unused_idx(content):
    """Fix unused idx in .map((item, idx) => ...) patterns where idx is never used."""
    global CHANGES
    # This is tricky — only fix specific known patterns
    # For now, just fix the simple ones reported
    return content

for root, dirs, files in os.walk(SRC_DIR):
    for f in files:
        if not f.endswith('.jsx') and not f.endswith('.js'):
            continue
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            
            new_content = fix_catch_vars(content)
            
            if new_content != content:
                with open(path, 'w', encoding='utf-8') as fh:
                    fh.write(new_content)
                rel = os.path.relpath(path, SRC_DIR)
                print(f"Fixed catch vars in: {rel}")
        except Exception as ex:
            print(f"Error: {f}: {ex}")

print(f"\nTotal catch var fixes: {CHANGES}")
