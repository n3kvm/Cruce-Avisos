import sys
import os
from pathlib import Path
import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))
from cruce_avisos_local import read_master

master_path = os.getenv("AVISOS_MASTER_PATH", str(BASE_DIR / "data" / "AVISOS.xlsx"))
dash_path = os.getenv("CRUCE_OUTPUT_PATH", str(BASE_DIR / "salidas" / "dashboard_avisos_local.xlsx"))
out = Path(os.getenv("POWERBI_OUTPUT_DIR", str(BASE_DIR / "powerbi")))
out.mkdir(parents=True, exist_ok=True)

def save(df, name):
    df.to_csv(out / name, index=False, encoding='utf-8-sig', sep=';')

master, aviso_col = read_master(master_path)
hall = pd.read_excel(dash_path, sheet_name='Hallazgos', dtype=str)
files = pd.read_excel(dash_path, sheet_name='Archivos_revisados', dtype=str)
errors = pd.read_excel(dash_path, sheet_name='Errores', dtype=str)
indic = pd.read_excel(dash_path, sheet_name='Dashboard', dtype=str)

if hall.empty:
    grouped = pd.DataFrame(columns=['Aviso', 'Veces_encontrado', 'Archivos', 'Tipos_hallazgo', 'Hojas'])
else:
    grouped = hall.groupby('Aviso', dropna=False).agg(
        Veces_encontrado=('Archivo', 'count'),
        Archivos=('Archivo', lambda x: ' | '.join(sorted(set(map(str, x))))),
        Tipos_hallazgo=('Tipo hallazgo', lambda x: ' | '.join(sorted(set(map(str, x))))),
        Hojas=('Hoja', lambda x: ' | '.join(sorted(set(v for v in map(str, x) if v and v != 'nan')))),
    ).reset_index()

avisos = master.merge(grouped, left_on='Aviso_normalizado', right_on='Aviso', how='left', suffixes=('', '_hallazgo'))
avisos['Veces_encontrado'] = avisos['Veces_encontrado'].fillna(0).astype(int)
avisos['Estado montaje'] = avisos['Veces_encontrado'].map(lambda n: 'Pendiente' if n == 0 else ('Montado' if n == 1 else 'Duplicado'))
for col in ['Archivos', 'Tipos_hallazgo', 'Hojas']:
    avisos[col] = avisos[col].fillna('')
if 'Aviso_hallazgo' in avisos.columns:
    avisos = avisos.drop(columns=['Aviso_hallazgo'])

for col in ['Fecha de aviso', 'Inicio deseado', 'Fin deseado', 'Modificado el']:
    if col in avisos.columns:
        avisos[col] = pd.to_datetime(avisos[col], errors='coerce').dt.date

save(avisos, 'avisos_estado.csv')
save(hall, 'hallazgos.csv')
save(files, 'archivos_revisados.csv')
save(errors, 'errores.csv')
save(indic, 'indicadores.csv')

if 'Fecha de aviso' in avisos.columns and pd.to_datetime(avisos['Fecha de aviso'], errors='coerce').notna().any():
    dates = pd.to_datetime(avisos['Fecha de aviso'], errors='coerce')
    cal = pd.DataFrame({'Fecha': pd.date_range(dates.min(), dates.max(), freq='D')})
    cal['Anio'] = cal['Fecha'].dt.year
    cal['Mes Numero'] = cal['Fecha'].dt.month
    cal['Mes'] = cal['Fecha'].dt.month_name()
    cal['Anio Mes'] = cal['Fecha'].dt.strftime('%Y-%m')
    cal['Fecha'] = cal['Fecha'].dt.date
else:
    cal = pd.DataFrame(columns=['Fecha', 'Anio', 'Mes Numero', 'Mes', 'Anio Mes'])
save(cal, 'calendario.csv')

if not hall.empty:
    resumen = hall.groupby('Archivo', dropna=False).agg(
        Hallazgos=('Aviso', 'count'),
        Avisos_unicos=('Aviso', pd.Series.nunique),
        Tipos_hallazgo=('Tipo hallazgo', lambda s: ' | '.join(sorted(set(str(x) for x in s if pd.notna(x))))),
    ).reset_index()
else:
    resumen = pd.DataFrame(columns=['Archivo', 'Hallazgos', 'Avisos_unicos', 'Tipos_hallazgo'])
save(resumen, 'resumen_archivos.csv')

print('Power BI data OK')
print(avisos['Estado montaje'].value_counts().to_string())
