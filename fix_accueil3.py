from pathlib import Path

path = Path('frontend/src/pages/AccueilPage/index.jsx')
lines = path.read_text(encoding='utf-8').splitlines(True)
start = 36
end = 70
replacement = [
    "    const normalizeKey = (value = '') =>\n",
    "        String(value || '')\n",
    "            .toLowerCase()\n",
    "            .normalize('NFD')\n",
    "            .replace(/[\\u0300-\\u036f]/g, '')\n",
    "            .replace(/[^a-z0-9]+/g, '_')\n",
    "            .replace(/_+/g, '_')\n",
    "            .replace(/^_|_$/g, '');\n",
    "\n",
]

if len(lines) < end:
    raise SystemExit('File is shorter than expected')

lines[start:end] = replacement
path.write_text(''.join(lines), encoding='utf-8')
print('patched')
