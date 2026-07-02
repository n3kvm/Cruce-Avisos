import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import openpyxl

EXCEL_EXTENSIONS = {".xlsx", ".xlsm", ".xls"}
TOKEN_RE = re.compile(r"\d{6,12}")


def normalize_aviso(value):
    text = str(value or "").strip()
    if text.endswith(".0") and text[:-2].isdigit():
        text = text[:-2]
    return re.sub(r"\D+", "", text).strip()


def normalize_cotizacion(value):
    text = str(value or "").upper()
    text = "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")
    text = re.sub(r"\.(XLSX|XLSM|XLS|PDF)$", "", text, flags=re.I)
    text = re.sub(r"\s*\([0-9]+\)\s*$", "", text)
    text = re.sub(r"\s*-\s*COPIA\s*$", "", text)
    text = re.sub(r"\s*-\s*FUSIONADO\s*$", "", text)
    return re.sub(r"[^A-Z0-9]+", "", text)


def is_excel(path):
    return path.suffix.lower() in EXCEL_EXTENSIONS and not path.name.startswith("~$")


def scan_file(path, root):
    hits = []
    errors = []
    rel = str(path.relative_to(root))
    meta = {
        "archivo": path.name,
        "ruta": rel.replace("\\", "/"),
        "modificado": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat(),
        "tamano": path.stat().st_size,
    }

    for candidate in set(TOKEN_RE.findall(path.name)):
        hits.append({
            "aviso": candidate,
            "archivo": path.name,
            "ruta": meta["ruta"],
            "tipo": "Nombre archivo",
            "hoja": "",
            "celda": "",
            "valor": path.name,
            "cotizacionKey": normalize_cotizacion(path.name),
        })

    try:
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    except Exception as exc:
        errors.append({"archivo": path.name, "ruta": meta["ruta"], "error": str(exc)})
        return hits, errors, meta

    for sheet in wb.worksheets:
        try:
            for row in sheet.iter_rows():
                for cell in row:
                    value = cell.value
                    if value is None:
                        continue
                    candidates = set()
                    normalized = normalize_aviso(value)
                    if normalized:
                        candidates.add(normalized)
                    if isinstance(value, str):
                        candidates.update(TOKEN_RE.findall(value))
                    for candidate in candidates:
                        hits.append({
                            "aviso": candidate,
                            "archivo": path.name,
                            "ruta": meta["ruta"],
                            "tipo": "Contenido Excel",
                            "hoja": sheet.title,
                            "celda": cell.coordinate,
                            "valor": str(value)[:250],
                            "cotizacionKey": normalize_cotizacion(path.name),
                        })
        except Exception as exc:
            errors.append({"archivo": path.name, "ruta": meta["ruta"], "hoja": sheet.title, "error": str(exc)})
    return hits, errors, meta


def main():
    parser = argparse.ArgumentParser(description="Genera indice_avisos.json desde la carpeta espejo de soportes.")
    parser.add_argument("--folder", default=r"D:\OneDrive - BRILLASEO SAS\Soportes Espejo - Documentos\Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez")
    parser.add_argument("--output", default=r"D:\OneDrive - BRILLASEO SAS\Soportes Espejo - Documentos\Z3 MODULO DE APROBACIONES - Maria Fernanda Gutierrez\indice_avisos.json")
    args = parser.parse_args()

    root = Path(args.folder)
    output = Path(args.output)
    if not root.exists():
        raise FileNotFoundError(f"No existe la carpeta: {root}")

    files = sorted(path for path in root.rglob("*") if path.is_file() and is_excel(path))
    hallazgos = []
    errors = []
    archivos = []

    for idx, path in enumerate(files, start=1):
        print(f"[{idx}/{len(files)}] {path.name}")
        hits, file_errors, meta = scan_file(path, root)
        hallazgos.extend(hits)
        errors.extend(file_errors)
        archivos.append(meta | {"hallazgos": len(hits), "errores": len(file_errors)})

    data = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFolder": str(root),
        "totalFiles": len(files),
        "totalHits": len(hallazgos),
        "archivos": archivos,
        "hallazgos": hallazgos,
        "errors": errors[:500],
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"Indice generado: {output}")
    print(f"Archivos: {len(files)} | Hallazgos: {len(hallazgos)} | Errores: {len(errors)}")


if __name__ == "__main__":
    main()
