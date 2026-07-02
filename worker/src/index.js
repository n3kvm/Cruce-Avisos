import * as XLSX from "xlsx";

const GRAPH_ROOT = "https://graph.microsoft.com/v1.0";
const EXCEL_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls"]);
let cachedToken = null;

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return corsJson({ ok: true });

    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/status" && request.method === "GET") {
        return corsJson({
          ok: true,
          mode: "cloudflare-worker",
          site: `${env.SITE_HOST}${env.SITE_PATH}`,
          drive: env.DRIVE_NAME,
          folder: env.FOLDER_PATH || ""
        });
      }

      if (url.pathname === "/api/cruce" && request.method === "POST") {
        const form = await request.formData();
        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") {
          return corsJson({ ok: false, error: "No encontre el archivo XLSX en la solicitud." }, 400);
        }

        const masterAvisos = readMasterFromWorkbook(await file.arrayBuffer());
        const avisoSet = new Set(masterAvisos.map((item) => item.aviso));
        const { hallazgos, errors, stats } = await getHallazgosFromIndex(env, avisoSet);
        const data = buildDataset(masterAvisos, hallazgos, stats);
        data.source = file.name || "AVISOS.xlsx";
        data.errors = errors.slice(0, 50);
        return corsJson({ ok: true, data });
      }

      if (url.pathname === "/api/refresh" && request.method === "POST") {
        return corsJson({
          ok: false,
          error: "En Cloudflare Worker el cruce se ejecuta al cargar AVISOS.xlsx. Usa el boton Cargar AVISOS.xlsx."
        }, 400);
      }

      return corsJson({ ok: false, error: "Ruta no encontrada" }, 404);
    } catch (error) {
      return corsJson({ ok: false, error: error.message || String(error) }, 500);
    }
  }
};

function corsJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

async function getToken(env) {
  if (cachedToken && cachedToken.expiresAt - 180000 > Date.now()) return cachedToken.accessToken;
  if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
    throw new Error("Faltan secretos CLIENT_ID y CLIENT_SECRET en Cloudflare Worker.");
  }

  const tenant = env.TENANT_ID || "organizations";
  const body = new URLSearchParams({
    client_id: env.CLIENT_ID,
    client_secret: env.CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default"
  });

  const response = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`No se pudo obtener token Graph: ${JSON.stringify(payload)}`);
  }
  cachedToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000
  };
  return cachedToken.accessToken;
}

async function graphRequest(env, pathOrUrl, options = {}) {
  const token = await getToken(env);
  const url = String(pathOrUrl).startsWith("http") ? pathOrUrl : `${GRAPH_ROOT}${pathOrUrl}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": options.contentType || "application/json" } : {})
    },
    body: options.body
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Graph error ${response.status}: ${detail}`);
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) return response.json();
  return response.arrayBuffer();
}

async function paged(env, path) {
  const out = [];
  let next = path;
  while (next) {
    const payload = await graphRequest(env, next);
    out.push(...(payload.value || []));
    next = payload["@odata.nextLink"];
  }
  return out;
}

async function getDriveAndFolder(env) {
  const site = await graphRequest(env, `/sites/${env.SITE_HOST}:${env.SITE_PATH}`);
  const drives = await paged(env, `/sites/${site.id}/drives?$select=id,name,webUrl`);
  const wanted = new Set([
    String(env.DRIVE_NAME || "").toLowerCase(),
    "documentos compartidos",
    "shared documents",
    "documents",
    "documentos"
  ]);
  const drive = drives.find((item) => wanted.has(String(item.name || "").toLowerCase())) || drives[0];
  if (!drive) throw new Error("No encontre biblioteca de documentos en SharePoint.");

  const folderPath = String(env.FOLDER_PATH || "").replace(/^\/+|\/+$/g, "");
  const folder = folderPath
    ? await graphRequest(env, `/drives/${drive.id}/root:/${encodeURIComponent(folderPath)}`)
    : await graphRequest(env, `/drives/${drive.id}/root`);

  return { drive, folder };
}

async function listExcelFiles(env) {
  const { drive, folder } = await getDriveAndFolder(env);
  const maxFiles = Number(env.MAX_FILES || 500);
  const pending = [folder.id];
  const files = [];

  while (pending.length) {
    const itemId = pending.pop();
    const children = await paged(env, `/drives/${drive.id}/items/${itemId}/children?$select=id,name,folder,file,lastModifiedDateTime,webUrl,size,eTag`);
    for (const item of children) {
      if (item.folder) {
        pending.push(item.id);
      } else if (isExcelFile(item.name)) {
        files.push({ ...item, driveId: drive.id });
        if (files.length >= maxFiles) return files;
      }
    }
  }
  return files;
}

async function downloadItem(env, item) {
  return graphRequest(env, `/drives/${item.driveId}/items/${item.id}/content`);
}

async function getHallazgosForAvisos(env, avisoSet) {
  const files = await listExcelFiles(env);
  const hallazgos = [];
  const errors = [];
  let scanned = 0;

  for (const item of files) {
    try {
      const content = await downloadItem(env, item);
      const hits = scanWorkbook(content, item, avisoSet);
      hallazgos.push(...hits);
      scanned += 1;
    } catch (error) {
      errors.push({ archivo: item.name, error: error.message || String(error) });
    }
  }

  return { hallazgos, errors, stats: { archivos: files.length, escaneados: scanned, cache: 0 } };
}

async function getHallazgosFromIndex(env, avisoSet) {
  const { drive } = await getDriveAndFolder(env);
  const folderPath = String(env.FOLDER_PATH || "").replace(/^\/+|\/+$/g, "");
  const indexFile = String(env.INDEX_FILE || "indice_avisos.json").replace(/^\/+/, "");
  const indexPath = folderPath ? `${folderPath}/${indexFile}` : indexFile;
  const encoded = encodeGraphPath(indexPath);
  const content = await graphRequest(env, `/drives/${drive.id}/root:/${encoded}:/content`);
  const text = new TextDecoder("utf-8").decode(content);
  const index = JSON.parse(text);
  const hallazgos = (index.hallazgos || []).filter((hit) => avisoSet.has(String(hit.aviso || "")));
  return {
    hallazgos,
    errors: index.errors || [],
    stats: {
      archivos: index.totalFiles || index.archivos?.length || 0,
      escaneados: 0,
      cache: 0,
      indice: true,
      indiceGenerado: index.generatedAt || ""
    }
  };
}

function scanWorkbook(content, item, avisoSet) {
  const hits = [];
  const workbook = XLSX.read(content, { type: "array", cellDates: true, dense: false });
  const tokenRegex = /\d{6,12}/g;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    for (const cellAddress of Object.keys(sheet)) {
      if (cellAddress.startsWith("!")) continue;
      const cell = sheet[cellAddress];
      const raw = cell?.v ?? "";
      if (raw === "") continue;

      const candidates = new Set();
      const normalized = normalizeAviso(raw);
      if (normalized) candidates.add(normalized);
      String(raw).match(tokenRegex)?.forEach((value) => candidates.add(value));

      for (const candidate of candidates) {
        if (!avisoSet.has(candidate)) continue;
        hits.push({
          aviso: candidate,
          archivo: item.name,
          tipo: "Contenido Excel",
          hoja: sheetName,
          celda: cellAddress,
          valor: String(raw).slice(0, 250),
          webUrl: item.webUrl || "",
          cotizacionKey: normalizeCotizacion(item.name)
        });
      }
    }
  }

  String(item.name || "").match(tokenRegex)?.forEach((candidate) => {
    if (!avisoSet.has(candidate)) return;
    hits.push({
      aviso: candidate,
      archivo: item.name,
      tipo: "Nombre archivo",
      hoja: "",
      celda: "",
      valor: item.name,
      webUrl: item.webUrl || "",
      cotizacionKey: normalizeCotizacion(item.name)
    });
  });

  return hits;
}

function readMasterFromWorkbook(content) {
  const workbook = XLSX.read(content, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const headers = (rows.shift() || []).map(clean);
  const headerMap = new Map(headers.map((header, idx) => [normalizeKey(header), idx]));
  const avisoIdx = headerMap.get("aviso");
  if (avisoIdx === undefined) throw new Error(`No encontre una columna llamada Aviso. Columnas: ${headers.join(", ")}`);

  const rowValue = (row, ...names) => {
    for (const name of names) {
      const idx = headerMap.get(normalizeKey(name));
      if (idx !== undefined) return row[idx] ?? "";
    }
    return "";
  };

  const avisos = [];
  for (const row of rows) {
    const aviso = normalizeAviso(row[avisoIdx]);
    if (!aviso) continue;
    const fecha = formatDate(rowValue(row, "Fecha de aviso", "Fecha"));
    const statusSistema = clean(rowValue(row, "Status sistema"));
    avisos.push({
      aviso,
      fecha,
      anio: fecha ? fecha.slice(0, 4) : "",
      mes: fecha && fecha.length >= 7 ? fecha.slice(5, 7) : "",
      grupo: clean(rowValue(row, "Grupo planif.", "Grupo")),
      emplazamiento: clean(rowValue(row, "Emplazamiento")),
      contratista: clean(rowValue(row, "Nombre Contratista", "Contratista")),
      prioridad: clean(rowValue(row, "Prioridad")),
      statusSistema,
      codif: clean(rowValue(row, "Codif.txt.cod.", "Codif.txt.cód.", "Codif")),
      ptbo: statusSistema.toUpperCase().includes("PTBO"),
      statusUsuario: clean(rowValue(row, "Status usuario")),
      descripcion: clean(rowValue(row, "Descripcion", "Descripción")),
      denominacion: clean(rowValue(row, "Denominacion", "Denominación"))
    });
  }
  return avisos;
}

function buildDataset(masterAvisos, hallazgos, stats) {
  const byAviso = new Map();
  for (const hit of hallazgos) {
    if (!byAviso.has(hit.aviso)) byAviso.set(hit.aviso, []);
    byAviso.get(hit.aviso).push(hit);
  }

  const avisos = masterAvisos.map((item) => {
    const hits = byAviso.get(item.aviso) || [];
    const quoteKeys = unique(hits.map((hit) => hit.cotizacionKey || normalizeCotizacion(hit.archivo)).filter(Boolean));
    const files = unique(hits.map((hit) => hit.archivo).filter(Boolean));
    const types = unique(hits.map((hit) => hit.tipo).filter(Boolean));
    const veces = quoteKeys.length;
    return {
      ...item,
      estado: veces === 0 ? "Pendiente" : (veces === 1 ? "Montado" : "Duplicado"),
      veces,
      hallazgos: hits.length,
      archivos: files.join(" | "),
      tipos: types.join(" | ")
    };
  });

  const meta = {
    totalAvisos: avisos.length,
    montados: avisos.filter((a) => a.estado === "Montado").length,
    pendientes: avisos.filter((a) => a.estado === "Pendiente").length,
    duplicados: avisos.filter((a) => a.estado === "Duplicado").length,
    hallazgos: hallazgos.length,
    archivos: stats.archivos || 0,
    estados: unique(avisos.map((a) => a.estado)).sort(),
    ptbo: avisos.filter((a) => a.ptbo).length,
    graph: stats
  };

  return { meta, avisos, hallazgos };
}

function isExcelFile(name = "") {
  if (name.startsWith("~$")) return false;
  const lower = name.toLowerCase();
  return [...EXCEL_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

function encodeGraphPath(path) {
  return String(path)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function normalizeHeader(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return normalizeHeader(value).replace(/[^a-z0-9]+/g, "");
}

function normalizeAviso(value) {
  let text = String(value ?? "").trim();
  if (text.endsWith(".0") && /^\d+\.0$/.test(text)) text = text.slice(0, -2);
  return text.replace(/\D+/g, "");
}

function normalizeCotizacion(value) {
  return String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\.(XLSX|XLSM|XLS|PDF)$/i, "")
    .replace(/\s*\([0-9]+\)\s*$/g, "")
    .replace(/\s*-\s*COPIA\s*$/g, "")
    .replace(/\s*-\s*FUSIONADO\s*$/g, "")
    .replace(/[^A-Z0-9]+/g, "");
}

function clean(value) {
  return String(value ?? "").trim();
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && String(value).trim() !== ""))];
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const yyyy = String(parsed.y).padStart(4, "0");
      const mm = String(parsed.m).padStart(2, "0");
      const dd = String(parsed.d).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  const text = String(value).trim();
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return text.slice(0, 10);
}
