from pathlib import Path

path = Path('frontend/src/pages/AccueilPage/index.jsx')
text = path.read_text(encoding='utf-8')
old = """    const normalizeKey = (value = '') =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[-]/g, (c) => c)
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

"""
new = """    const normalizeKey = (value = '') =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\\u0300-\\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');

"""

if old not in text:
    raise SystemExit('normalizeKey block not found in file')

text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
print('patched')
