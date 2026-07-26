#!/usr/bin/env python3
"""
i18n codemod for ZION website (v2).

Converts inline Czech/English conditionals of the form
  cs ? 'CZ' : 'EN'
  lang === 'cs' ? 'CZ' : 'EN'
into copy.key[condition ? 'cs' : 'en'] lookups using a per-file COPY object.

Only simple string literals are converted; template literals with ${...}
expressions and language-code selectors are skipped.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'src'

def find_files():
    files = []
    for f in ROOT.rglob('*.tsx'):
        text = f.read_text()
        if "'use client'" not in text and '"use client"' not in text:
            continue
        if re.search(r'\bcs\s*\?|lang\s*===\s*[\'"]cs[\'"]', text):
            files.append(f)
    return files

def parse_literal(text, i):
    """Parse a JS string literal starting at i. Returns (value, end_index)."""
    while i < len(text) and text[i] in ' \t\n\r':
        i += 1
    if i >= len(text):
        return None, i
    quote = text[i]
    if quote not in ('"', "'", '`'):
        return None, i
    i += 1
    out = []
    while i < len(text):
        ch = text[i]
        if ch == '\\':
            i += 1
            if i < len(text):
                out.append(text[i])
                i += 1
            continue
        if ch == quote:
            i += 1
            return ''.join(out), i
        out.append(ch)
        i += 1
    return None, i

def quote_for(s):
    if '`' not in s and '${' not in s:
        return '`'
    if s.count('"') <= s.count("'"):
        return '"'
    return "'"

def quote_string(s, quote=None):
    if quote is None:
        quote = quote_for(s)
    if quote == '`':
        if '`' in s:
            quote = '"'
    if quote == '"':
        escaped = s.replace('\\', '\\\\').replace('"', '\\"')
    else:
        escaped = s.replace('\\', '\\\\').replace("'", "\\'")
    return f'{quote}{escaped}{quote}'

def slugify(s, max_len=30):
    """Create a camelCase-ish key from English text."""
    s = re.sub(r'\{\{[^}]+\}\}|\$\{[^}]+\}', '', s)
    s = re.sub(r'[^a-zA-Z0-9\s]', ' ', s)
    words = [w for w in s.strip().split() if w]
    if not words:
        return 'text'
    key = words[0].lower()
    for w in words[1:]:
        key += w.capitalize()
        if len(key) >= max_len:
            break
    key = key[:max_len]
    key = re.sub(r'[^a-zA-Z0-9_]', '', key)
    if not key:
        key = 'text'
    if re.match(r'^[0-9]', key):
        key = 'k' + key
    return key

def split_words(s):
    s = re.sub(r'[^a-zA-Z0-9]+', ' ', s)
    s = re.sub(r'([a-z])([A-Z])', r'\1 \2', s)
    return [w for w in s.split() if w]

def to_camel(words):
    return ''.join(w[0].upper() + w[1:].lower() for w in words if w)

def copy_name_for(path):
    """Generate a PascalCase COPY object name from the file path."""
    rel = path.relative_to(ROOT)
    parts = list(rel.parts)
    root_dir = parts[0]
    parts = parts[1:]
    name_parts = []
    if root_dir == 'components':
        stem = Path(parts[-1]).stem
        stem = re.sub(r'(Client|Page|Component)$', '', stem)
        name_parts = split_words(stem)
    elif root_dir == 'app':
        for part in parts:
            stem = Path(part).stem
            if stem in ('page', 'index'):
                continue
            name_parts.extend(split_words(stem))
    if not name_parts:
        name_parts = ['page']
    return to_camel(name_parts) + 'Copy'

def extract_pairs(text):
    """Extract all simple (cz, en) pairs with their condition expression."""
    pairs = []
    cond_re = re.compile(r'(?:\bcs\b|lang\s*===\s*[\'"]cs[\'"])\s*\?', re.S)
    for m in cond_re.finditer(text):
        i = m.end()
        cz_val, i2 = parse_literal(text, i)
        if cz_val is None or i2 >= len(text):
            continue
        if text[m.end():i2].strip().startswith('`') and '${' in cz_val:
            continue
        j = i2
        while j < len(text) and text[j] in ' \t\n\r':
            j += 1
        if j >= len(text) or text[j] != ':':
            continue
        j += 1
        en_val, j2 = parse_literal(text, j)
        if en_val is None:
            continue
        if text[j:j2].strip().startswith('`') and '${' in en_val:
            continue
        # Skip language-code selectors, not UI copy
        if cz_val.strip().lower() in ('cs', 'en', 'czech', 'english') and en_val.strip().lower() in ('cs', 'en', 'czech', 'english'):
            continue
        # condition is the source text before the `?`, e.g. "cs" or "lang === 'cs'"
        condition = text[m.start():m.end()-1].rstrip()
        pairs.append({
            'start': m.start(),
            'end': j2,
            'condition': condition,
            'cz': cz_val,
            'en': en_val,
        })
    return pairs

def process_file(path):
    path = path.resolve()
    text = path.read_text()
    original = text
    pairs = extract_pairs(text)
    if not pairs:
        return 0, 0

    seen = {}
    keys = {}
    for p in pairs:
        pair = (p['cz'], p['en'])
        if pair in seen:
            p['key'] = seen[pair]
            continue
        base = slugify(p['en'])
        key = base
        idx = 2
        while key in keys:
            key = f'{base}_{idx}'
            idx += 1
        keys[key] = pair
        seen[pair] = key
        p['key'] = key

    copy_name = copy_name_for(path)

    copy_lines = [f'const {copy_name} = {{']
    for key in list(keys.keys()):
        cz, en = keys[key]
        copy_lines.append(f'  {key}: {{ cs: {quote_string(cz)}, en: {quote_string(en)} }},')
    copy_lines.append('};')
    copy_block = '\n'.join(copy_lines)

    new_text = original
    for p in sorted(pairs, key=lambda x: x['start'], reverse=True):
        new_text = new_text[:p['start']] + f'{copy_name}.{p["key"]}[{p["condition"]} ? \'cs\' : \'en\']' + new_text[p['end']:]

    # Insert COPY object after the last import line
    last_import = None
    for m in re.finditer(r'^import\s+.+?\s+from\s+[\'"][^\'"]+[\'"]\s*;?', new_text, re.M | re.S):
        last_import = m
    if last_import:
        insert_at = last_import.end()
    else:
        if new_text.startswith("'use client'") or new_text.startswith('"use client"'):
            insert_at = new_text.index('\n') + 1
        else:
            insert_at = 0
    new_text = new_text[:insert_at] + f'\n\n{copy_block}' + new_text[insert_at:]

    path.write_text(new_text)
    return len(pairs), len(keys)

if __name__ == '__main__':
    if len(sys.argv) > 1:
        test_path = Path(sys.argv[1])
        pairs, keys = process_file(test_path)
        print(f'Converted {pairs} expressions ({keys} unique keys) in {test_path}')
    else:
        files = find_files()
        total_pairs = total_keys = 0
        for f in files:
            p, k = process_file(f)
            total_pairs += p
            total_keys += k
            if p:
                print(f'  {p:4d} keys {k:4d} {f.relative_to(ROOT.parents[1])}')
        print(f'Total: {total_pairs} expressions, {total_keys} unique keys')
