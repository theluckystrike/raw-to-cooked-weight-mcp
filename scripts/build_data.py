#!/usr/bin/env python3
"""Build data/cooking-yields.json from the USDA Table of Cooking Yields for Meat and Poultry, Release 2 (2014).

Source: https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.xlsx
Usage: python3 -I scripts/build_data.py data/USDA_CookingYields_MeatPoultry02.xlsx data/cooking-yields.json
Standard library only (the xlsx is read as zip + XML).
"""
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
GROUPS = {'05': 'poultry', '07': 'sausages and luncheon meats', '10': 'pork', '13': 'beef', '17': 'lamb, veal and game'}


def col(ref):
    return re.match(r'[A-Z]+', ref).group(0)


def num(v):
    if v in (None, '', 'n/a', 'N/A'):
        return None
    return round(float(v), 2)


def main(src, out):
    z = zipfile.ZipFile(src)
    ss = [''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])) for si in ET.fromstring(z.read('xl/sharedStrings.xml'))]
    rows = ET.fromstring(z.read('xl/worksheets/sheet1.xml')).findall('.//m:row', NS)
    header = None
    items = []
    for r in rows:
        cells = {}
        for c in r.findall('m:c', NS):
            v = c.find('m:v', NS)
            val = v.text if v is not None else ''
            if c.get('t') == 's':
                val = ss[int(val)]
            cells[col(c.get('r'))] = val.strip() if isinstance(val, str) else val
        if header is None:
            header = cells
            continue
        if not cells.get('C') or not cells.get('E'):
            continue
        grp = str(cells.get('A', '')).zfill(2)
        ndb = cells.get('B') or None
        n = cells.get('F')
        items.append({
            'id': len(items) + 1,
            'group': GROUPS.get(grp, grp),
            'group_code': grp,
            'ndb': str(int(float(ndb))).zfill(5) if ndb and re.match(r'^[0-9.]+$', str(ndb)) else None,
            'description': re.sub(r'\s+', ' ', cells['C']).strip(),
            'method': re.sub(r'\s+', ' ', cells.get('D', '')).strip(),
            'yield_pct': num(cells['E']),
            'n': int(float(n)) if n and re.match(r'^[0-9.]+$', str(n)) else None,
            'sd': num(cells.get('G')),
            'min_pct': num(cells.get('H')),
            'max_pct': num(cells.get('I')),
            'moisture_change_pct': num(cells.get('J')),
            'fat_change_pct': num(cells.get('K')),
            'release_year': int(float(cells['L'])) if cells.get('L') and re.match(r'^[0-9.]+$', str(cells['L'])) else None,
        })
    json.dump({
        'source': 'USDA Table of Cooking Yields for Meat and Poultry, Release 2 (2014), USDA ARS Nutrient Data Laboratory',
        'source_url': 'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/retn/USDA_CookingYields_MeatPoultry02.xlsx',
        'header': header,
        'items': items,
    }, open(out, 'w'), indent=1)
    print(f'{len(items)} rows -> {out}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
