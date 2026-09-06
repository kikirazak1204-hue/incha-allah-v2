from pathlib import Path

path = Path('frontend/src/pages/AccueilPage/index.jsx')
text = path.read_text(encoding='utf-8')

old_block = """    const normalizeKey = (value = '') =>
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
            .replace(/[-]/g, '')
            .replace(/[-]/g, '')
            .replace(/[^a-z0-9]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
"""

new_block = """    const normalizeKey = (value = '') =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\\u0300-\\u036f/g, '')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');
"""

if old_block not in text:
    raise SystemExit('normalizeKey block not found')

text = text.replace(old_block, new_block, 1)

# If there is a duplicate getServiceImage block due to a prior partial edit, remove the first one.
dup_block = """    const getServiceImage = (service) => {
        if (!service) return '/backgrounds/transport.png';
        if (service.image) return service.image;
        const key = normalizeKey(service.code || service.nom || 'transport');
        return SERVICE_BACKGROUND_IMAGES[key] || '/backgrounds/transport.png';
    };

"""

# Remove duplicate only if it appears before the panier comment, leaving the final block.
if text.count(dup_block) > 1:
    first_occurrence = text.find(dup_block)
    second_occurrence = text.find(dup_block, first_occurrence + 1)
    if second_occurrence != -1:
        text = text[:first_occurrence] + text[first_occurrence + len(dup_block):]

path.write_text(text, encoding='utf-8')
print('updated')
