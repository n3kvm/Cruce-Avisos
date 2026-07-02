import csv
import json
import os
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pandas as pd

base = Path(os.getenv("PROJECT_BASE_DIR", str(Path(__file__).resolve().parents[1])))
powerbi = base / 'powerbi'
out = base / 'dashboard_html'
master_path = Path(os.getenv("AVISOS_MASTER_PATH", str(base / "data" / "AVISOS.xlsx")))

def normalize_aviso(value):
    if value is None:
        return ''
    text = str(value).strip()
    if text.endswith('.0') and text[:-2].isdigit():
        text = text[:-2]
    return re.sub(r'\D+', '', text)

def normalize_key(value):
    text = str(value or '')
    text = ''.join(ch for ch in unicodedata.normalize('NFD', text) if unicodedata.category(ch) != 'Mn')
    text = text.upper()
    text = re.sub(r'\.(XLSX|XLSM|XLS|PDF)$', '', text)
    text = re.sub(r'\s*\([0-9]+\)\s*$', '', text)
    text = re.sub(r'\s*-\s*COPIA\s*$', '', text)
    text = re.sub(r'\s*-\s*FUSIONADO\s*$', '', text)
    text = re.sub(r'[^A-Z0-9]+', '', text)
    return text

def read_semicolon_csv(name):
    with open(powerbi / name, newline='', encoding='utf-8-sig') as f:
        return list(csv.DictReader(f, delimiter=';'))

def clean(value):
    return '' if pd.isna(value) else str(value).strip()

def row_value(row, wanted):
    wanted_norm = ''.join(ch for ch in unicodedata.normalize('NFD', wanted.lower()) if unicodedata.category(ch) != 'Mn')
    wanted_norm = re.sub(r'[^a-z0-9]+', '', wanted_norm)
    for key in row.index:
        key_norm = ''.join(ch for ch in unicodedata.normalize('NFD', str(key).lower()) if unicodedata.category(ch) != 'Mn')
        key_norm = re.sub(r'[^a-z0-9]+', '', key_norm)
        if key_norm == wanted_norm:
            return row.get(key)
    return ''

def date_text(value):
    date = pd.to_datetime(value, errors='coerce')
    if pd.isna(date):
        return clean(value)
    return date.strftime('%Y-%m-%d')

master = pd.read_excel(master_path, dtype=str)
aviso_col = next((c for c in master.columns if str(c).strip().casefold() == 'aviso'), None)
if not aviso_col:
    raise ValueError('No encontre columna Aviso')
master['Aviso_normalizado'] = master[aviso_col].map(normalize_aviso)
master = master[master['Aviso_normalizado'] != ''].copy()

hall_rows = read_semicolon_csv('hallazgos.csv')
file_rows = read_semicolon_csv('archivos_revisados.csv')

hallazgos = []
hits_by_aviso = {}
for row in hall_rows:
    aviso = normalize_aviso(row.get('Aviso'))
    item = {
        'aviso': aviso,
        'archivo': row.get('Archivo', ''),
        'cotizacionKey': normalize_key(row.get('Archivo', '')),
        'tipo': row.get('Tipo hallazgo', ''),
        'hoja': row.get('Hoja', ''),
        'celda': row.get('Celda', ''),
        'valor': row.get('Valor celda', ''),
        'modificado': row.get('Modificado', ''),
    }
    hallazgos.append(item)
    if aviso:
        hits_by_aviso.setdefault(aviso, []).append(item)

avisos = []
for _, row in master.iterrows():
    aviso = row['Aviso_normalizado']
    hits = hits_by_aviso.get(aviso, [])
    quote_keys = sorted({h['cotizacionKey'] for h in hits if h.get('cotizacionKey')})
    files = sorted({h['archivo'] for h in hits if h.get('archivo')})
    types = sorted({h['tipo'] for h in hits if h.get('tipo')})
    cotizaciones = len(quote_keys)
    estado = 'Pendiente' if cotizaciones == 0 else ('Montado' if cotizaciones == 1 else 'Duplicado')
    avisos.append({
        'aviso': aviso,
        'estado': estado,
        'fecha': date_text(row.get('Fecha de aviso')),
        'anio': date_text(row.get('Fecha de aviso'))[:4] if date_text(row.get('Fecha de aviso')) else '',
        'mes': date_text(row.get('Fecha de aviso'))[5:7] if len(date_text(row.get('Fecha de aviso'))) >= 7 else '',
        'grupo': clean(row.get('Grupo planif.')),
        'emplazamiento': clean(row.get('Emplazamiento')),
        'contratista': clean(row.get('Nombre Contratista')),
        'prioridad': clean(row.get('Prioridad')),
        'statusSistema': clean(row.get('Status sistema')),
        'codif': clean(row.get('Codif.txt.cód.')),
        'ptbo': 'PTBO' in clean(row.get('Status sistema')).upper(),
        'statusUsuario': clean(row.get('Status usuario')),
        'descripcion': clean(row_value(row, 'Descripción')),
        'denominacion': clean(row_value(row, 'Denominación')),
        'veces': cotizaciones,
        'hallazgos': len(hits),
        'archivos': ' | '.join(files),
        'tipos': ' | '.join(types),
    })

archivos = []
for row in file_rows:
    archivos.append({
        'archivo': row.get('Archivo', ''),
        'extension': row.get('Extension', ''),
        'tamano': int(row.get('Tamano bytes') or 0),
        'modificado': row.get('Modificado', ''),
    })

status_counts = Counter(a['estado'] for a in avisos)
meta = {
    'totalAvisos': len(avisos),
    'montados': status_counts.get('Montado', 0),
    'pendientes': status_counts.get('Pendiente', 0),
    'duplicados': status_counts.get('Duplicado', 0),
    'hallazgos': len(hallazgos),
    'archivos': len(archivos),
    'porEstado': dict(status_counts),
    'porGrupo': Counter(a['grupo'] or 'Sin grupo' for a in avisos).most_common(20),
    'porEmplazamiento': Counter(a['emplazamiento'] or 'Sin emplazamiento' for a in avisos).most_common(20),
    'porContratista': Counter(a['contratista'] or 'Sin contratista' for a in avisos).most_common(20),
    'porArchivo': Counter(h['archivo'] for h in hallazgos).most_common(20),
    'grupos': sorted({a['grupo'] for a in avisos if a['grupo']}),
    'emplazamientos': sorted({a['emplazamiento'] for a in avisos if a['emplazamiento']}),
    'contratistas': sorted({a['contratista'] for a in avisos if a['contratista']}),
    'statusSistemas': sorted({a['statusSistema'] for a in avisos if a['statusSistema']}),
    'codifs': sorted({a['codif'] for a in avisos if a['codif']}),
    'anios': sorted({a['anio'] for a in avisos if a['anio']}),
    'meses': sorted({a['mes'] for a in avisos if a['mes']}),
    'estados': ['Montado', 'Pendiente', 'Duplicado'],
    'ptbo': sum(1 for a in avisos if a['ptbo']),
}

(out / 'data.js').write_text('window.DASHBOARD_DATA = ' + json.dumps({
    'meta': meta,
    'avisos': avisos,
    'hallazgos': hallazgos,
    'archivos': archivos,
}, ensure_ascii=False) + ';\n', encoding='utf-8')
print(status_counts)
