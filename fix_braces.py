import os
import re

dir_path = "frontend/src/core/templates"
files = [f for f in os.listdir(dir_path) if f.startswith("english_m") and f.endswith(".ts") and f != "english_index.ts"]

for file in files:
    path = os.path.join(dir_path, file)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # We messed up the closing of Topics. A Topic starts with `{ id: `
    # And ends before the next `{ id:` or `];`.
    # Let's fix the missing closing brace before the next topic.
    content = re.sub(r'(\n\s*\])\s*,\s*\n(\s*\{\s*\n\s*id:)', r'\1\n  },\n\2', content)
    
    # Let's also fix the missing closing brace at the very end of the array before `];`
    content = re.sub(r'(\n\s*\])\s*\n(\s*\];)', r'\1\n  }\n\2', content)
    
    # Let's also fix the `def: ... }],` thing again just in case there are other variations.
    content = re.sub(r'(def:\s*(?:(?:(?!\}\s*\]\s*\}).)+))\s*\}\s*\]\s*,', r'\1}] },', content)
    
    # Wait, some lines might still have `{ type: 'keyTerms', terms: [{ term: '...', def: '...' }],`
    content = re.sub(r'(\{\s*type:\s*[\'"]keyTerms[\'"],\s*terms:\s*\[\s*\{\s*term:\s*[\'"][^\'"]+[\'"],\s*def:\s*[\'"][^\'"]+[\'"]\s*\})\s*\]\s*,', r'\1 }] },', content)

    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

print("Fixed closing braces!")
