const data = window.DASHBOARD_DATA;
const BACKEND_URL = window.BACKEND_URL || (window.location.protocol.startsWith("http") ? window.location.origin : "http://127.0.0.1:8765");
const state = { estado: "", anio: "", mes: "", statusUserExcluded: new Set(), statusExcluded: new Set(), codifExcluded: new Set(), excludePtbo: true, excludeCotizaciones: true, contratista: "", search: "" };
const colors = { Montado: "#1f9f64", Pendiente: "#e44848", Duplicado: "#f0a330" };
const fmt = new Intl.NumberFormat("es-CO");
const monthNames = { "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril", "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto", "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre" };

function fillSelect(id, items, formatter = value => value) {
  const el = document.getElementById(id);
  const first = el.querySelector("option");
  el.innerHTML = "";
  if (first) el.appendChild(first);
  items.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item;
    opt.textContent = formatter(item);
    el.appendChild(opt);
  });
}

function init() {
  rebuildFilterOptions();
  document.getElementById("stateFilter").addEventListener("change", e => { state.estado = e.target.value; render(); });
  document.getElementById("yearFilter").addEventListener("change", e => { state.anio = e.target.value; render(); });
  document.getElementById("monthFilter").addEventListener("change", e => { state.mes = e.target.value; render(); });
  document.getElementById("excludePtbo").addEventListener("change", e => { state.excludePtbo = e.target.checked; render(); });
  document.getElementById("excludeCotizaciones").addEventListener("change", e => { state.excludeCotizaciones = e.target.checked; render(); });
  document.querySelectorAll("[data-check-action]").forEach(button => button.addEventListener("click", () => {
    setCheckboxGroup(button.dataset.target, button.dataset.checkAction === "all");
    render();
  }));  document.getElementById("contractorFilter").addEventListener("change", e => { state.contratista = e.target.value; render(); });
  document.getElementById("searchInput").addEventListener("input", e => { state.search = e.target.value.trim().toLowerCase(); render(); });
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
  document.getElementById("exportCsv").addEventListener("click", exportCurrent);
  document.getElementById("exportAvisosExcel").addEventListener("click", exportAvisosExcel);
  document.getElementById("refreshCross").addEventListener("click", refreshLocalCross);
  document.getElementById("loadXlsx").addEventListener("click", () => document.getElementById("xlsxInput").click());
  document.getElementById("xlsxInput").addEventListener("change", handleXlsxUpload);
  render();
}
function rebuildFilterOptions() {
  data.meta.grupos = uniqueSorted(data.avisos.map(a => a.grupo));
  data.meta.emplazamientos = uniqueSorted(data.avisos.map(a => a.emplazamiento));
  data.meta.contratistas = uniqueSorted(data.avisos.map(a => a.contratista));
  data.meta.statusUsuarios = uniqueSorted(data.avisos.map(a => a.statusUsuario || "Sin dato"));
  data.meta.statusSistemas = uniqueSorted(data.avisos.map(a => a.statusSistema));
  data.meta.codifs = uniqueSorted(data.avisos.map(a => a.codif));
  data.meta.anios = uniqueSorted(data.avisos.map(a => a.anio || getYear(a.fecha)));
  data.meta.meses = uniqueSorted(data.avisos.map(a => a.mes || getMonth(a.fecha)));
  fillSelect("stateFilter", data.meta.estados);
  fillSelect("yearFilter", data.meta.anios);
  fillSelect("monthFilter", data.meta.meses, value => `${value} - ${monthNames[value] || value}`);
  renderCheckboxGroup("statusSystemChecks", data.meta.statusSistemas, state.statusExcluded);
  renderCheckboxGroup("codifChecks", data.meta.codifs, state.codifExcluded);
  renderCheckboxGroup("statusUserChecks", data.meta.statusUsuarios, state.statusUserExcluded);
  fillSelect("contractorFilter", data.meta.contratistas);
}
function avisosForOptions(excludeKey) {
  return data.avisos.filter(a => {
    if (excludeKey !== "estado" && state.estado && a.estado !== state.estado) return false;
    if (excludeKey !== "anio" && state.anio && (a.anio || getYear(a.fecha)) !== state.anio) return false;
    if (excludeKey !== "mes" && state.mes && (a.mes || getMonth(a.fecha)) !== state.mes) return false;
    if (excludeKey !== "statusSistema" && state.statusExcluded.has(a.statusSistema || "Sin dato")) return false;
    if (excludeKey !== "codif" && state.codifExcluded.has(a.codif || "Sin dato")) return false;
    if (excludeKey !== "ptbo" && state.excludePtbo && a.ptbo) return false;
    if (excludeKey !== "cotizaciones" && state.excludeCotizaciones && isCotizaciones(a)) return false;
    if (excludeKey !== "statusUsuario" && state.statusUserExcluded.has(a.statusUsuario || "Sin dato")) return false;
    if (excludeKey !== "contratista" && state.contratista && a.contratista !== state.contratista) return false;
    return true;
  });
}
function renderCheckboxGroup(containerId, items, excludedSet) {
  const container = document.getElementById(containerId);
  const options = uniqueSorted(items.map(value => value || "Sin dato"));
  container.innerHTML = options.map(value => `
    <label class="check-line"><input type="checkbox" value="${escapeHtml(value)}" ${excludedSet.has(value) ? "" : "checked"}> ${escapeHtml(value)}</label>
  `).join("");
  container.querySelectorAll("input").forEach(input => input.addEventListener("change", () => {
    if (input.checked) excludedSet.delete(input.value);
    else excludedSet.add(input.value);
    render();
  }));
}

function setCheckboxGroup(containerId, checked) {
  const excludedSet = containerId === "statusSystemChecks" ? state.statusExcluded : (containerId === "statusUserChecks" ? state.statusUserExcluded : state.codifExcluded);
  document.querySelectorAll(`#${containerId} input`).forEach(input => {
    input.checked = checked;
    if (checked) excludedSet.delete(input.value);
    else excludedSet.add(input.value);
  });
}

function isCotizaciones(aviso) {
  return normalizeHeader(aviso.codif).replace(/[^a-z0-9]+/g, "") === "cotizaciones";
}
function syncSelectOptions() {
  const specs = [
    ["stateFilter", "estado", uniqueSorted(avisosForOptions("estado").map(a => a.estado))],
    ["yearFilter", "anio", uniqueSorted(avisosForOptions("anio").map(a => a.anio || getYear(a.fecha)))],
    ["monthFilter", "mes", uniqueSorted(avisosForOptions("mes").map(a => a.mes || getMonth(a.fecha))), value => `${value} - ${monthNames[value] || value}`],    ["contractorFilter", "contratista", uniqueSorted(avisosForOptions("contratista").map(a => a.contratista))]
  ];
  specs.forEach(([id, key, options, formatter]) => {
    const selected = state[key];
    fillSelect(id, options, formatter || (value => value));
    if (selected && options.includes(selected)) {
      document.getElementById(id).value = selected;
    } else if (selected) {
      state[key] = "";
      document.getElementById(id).value = "";
    }
  });
  renderCheckboxGroup("statusSystemChecks", uniqueSorted(avisosForOptions("statusSistema").map(a => a.statusSistema || "Sin dato")), state.statusExcluded);
  renderCheckboxGroup("codifChecks", uniqueSorted(avisosForOptions("codif").map(a => a.codif || "Sin dato")), state.codifExcluded);
  renderCheckboxGroup("statusUserChecks", uniqueSorted(avisosForOptions("statusUsuario").map(a => a.statusUsuario || "Sin dato")), state.statusUserExcluded);
}
function filteredAvisos() {
  return data.avisos.filter(a => {
    if (state.estado && a.estado !== state.estado) return false;
    if (state.anio && (a.anio || getYear(a.fecha)) !== state.anio) return false;
    if (state.mes && (a.mes || getMonth(a.fecha)) !== state.mes) return false;
    if (state.statusExcluded.has(a.statusSistema || "Sin dato")) return false;
    if (state.codifExcluded.has(a.codif || "Sin dato")) return false;
    if (state.excludePtbo && a.ptbo) return false;
    if (state.excludeCotizaciones && isCotizaciones(a)) return false;
    if (state.statusUserExcluded.has(a.statusUsuario || "Sin dato")) return false;
    if (state.contratista && a.contratista !== state.contratista) return false;
    if (state.search) {
      const haystack = `${a.aviso} ${a.descripcion} ${a.denominacion} ${a.statusUsuario} ${a.archivos} ${a.grupo} ${a.emplazamiento} ${a.contratista}`.toLowerCase();
      if (!haystack.includes(state.search)) return false;
    }
    return true;
  });
}

function linkedHallazgos(avisos) {
  const avisosSet = new Set(avisos.map(a => a.aviso));
  return data.hallazgos.filter(h => avisosSet.has(h.aviso));
}

function render() {
  syncSelectOptions();
  const avisos = filteredAvisos();
  const hallazgos = linkedHallazgos(avisos);
  const counts = countBy(avisos, "estado");
  const mounted = (counts.Montado || 0) + (counts.Duplicado || 0);
  setText("kpiTotal", fmt.format(avisos.length));
  setText("kpiMontados", fmt.format(counts.Montado || 0));
  setText("kpiPendientes", fmt.format(counts.Pendiente || 0));
  setText("kpiDuplicados", fmt.format(counts.Duplicado || 0));
  setText("kpiPct", avisos.length ? `${Math.round((mounted / avisos.length) * 1000) / 10}%` : "0%");
  setText("kpiFiles", fmt.format(new Set(hallazgos.map(h => h.archivo)).size || data.meta.archivos));
  setText("kpiPtbo", fmt.format(avisos.filter(a => a.ptbo).length));
  setText("visibleCount", `${fmt.format(avisos.length)} registros`);
  renderDonut(counts, avisos.length);
  renderBars("groupBars", topEntries(countBy(avisos, "grupo"), 12));
  renderBars("fileBars", topEntries(countBy(hallazgos, "archivo"), 12));
  renderAvisosTable(avisos.slice(0, 300));
  renderHallazgosTable(hallazgos.slice(0, 120));
  setText("avisosCount", `${fmt.format(avisos.length)} avisos`);
  setText("hallazgosCount", `${fmt.format(hallazgos.length)} hallazgos`);
}


async function refreshLocalCross() {
  if (BACKEND_URL.includes("workers.dev")) {
    const status = document.getElementById("fileStatus");
    status.textContent = "Selecciona el archivo AVISOS.xlsx para consultar el SharePoint espejo desde el backend cloud.";
    document.getElementById("xlsxInput").click();
    return;
  }
  const button = document.getElementById("refreshCross");
  const status = document.getElementById("fileStatus");
  const original = button.textContent;
  button.disabled = true;
  button.textContent = "Actualizando...";
  status.textContent = "Solicitando actualizacion del cruce al backend.";
  try {
    const response = await fetch(`${BACKEND_URL}/api/refresh`, { method: "POST" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || `No se pudo actualizar (${response.status})`);
    status.textContent = `Cruce actualizado a las ${payload.finished}. Recargando dashboard...`;
    window.location.reload();
  } catch (error) {
    status.textContent = `No se pudo actualizar el cruce: ${error.message}`;
    console.error(error);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}
async function tryBackendCross(file, status) {
  const form = new FormData();
  form.append("file", file, file.name);
  const response = await fetch(`${BACKEND_URL}/api/cruce`, { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    if (payload?.auth_required) throw new Error("Debes autorizar Bryan en el backend: abre /api/auth/start en Azure.");
    throw new Error(payload?.error || `Backend no respondio correctamente (${response.status})`);
  }
  data.avisos = payload.data.avisos || [];
  data.hallazgos = payload.data.hallazgos || [];
  data.meta = { ...data.meta, ...(payload.data.meta || {}) };
  resetFilters(false);
  rebuildFilterOptions();
  render();
  const graph = payload.data.meta?.graph || {};
  const indexText = graph.indice ? ` | Indice: ${graph.indiceGenerado || "activo"}` : ` | Reescaneados: ${fmt.format(graph.escaneados || 0)} | Cache: ${fmt.format(graph.cache || 0)}`;
  status.textContent = `Fuente actual: ${file.name} | ${fmt.format(data.avisos.length)} avisos cruzados contra SharePoint. Archivos: ${fmt.format(graph.archivos || data.meta.archivos || 0)}${indexText}.`;
  return true;
}
async function handleXlsxUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const status = document.getElementById("fileStatus");
  status.textContent = `Consultando SharePoint con backend para ${file.name}...`;
  try {
    await tryBackendCross(file, status);
    return;
  } catch (backendError) {
    console.warn("Backend Graph no disponible; usando data local.", backendError);
    if (BACKEND_URL) {
      status.textContent = `No se pudo consultar SharePoint desde el backend: ${backendError.message}`;
      return;
    }
    status.textContent = `Backend Graph no disponible: ${backendError.message}. Usando data local precargada...`;
  }
  try {
    if (!window.XLSX) throw new Error("No se pudo cargar la libreria local para leer Excel.");
    status.textContent = `Leyendo ${file.name}...`;
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet], { defval: "", raw: false });
    if (!rows.length) throw new Error("El archivo no tiene filas para procesar.");

    const headers = Object.keys(rows[0]);
    const avisoHeader = headers.find(h => normalizeHeader(h) === "aviso");
    if (!avisoHeader) throw new Error(`No encontre una columna llamada Aviso. Columnas detectadas: ${headers.join(", ")}`);

    const hitsByAviso = groupHallazgosByAviso(data.hallazgos);
    const nextAvisos = rows.map(row => buildAvisoFromRow(row, avisoHeader, hitsByAviso)).filter(Boolean);
    if (!nextAvisos.length) throw new Error("No encontre avisos validos en el archivo seleccionado.");

    data.avisos = nextAvisos;
    resetFilters(false);
    rebuildFilterOptions();
    render();
    status.textContent = `Fuente actual: ${file.name} | ${fmt.format(nextAvisos.length)} avisos cruzados. Duplicado = mas de una cotizacion distinta.`;
  } catch (error) {
    status.textContent = `No se pudo procesar el archivo: ${error.message}`;
    console.error(error);
  } finally {
    event.target.value = "";
  }
}

function rowValue(row, wanted) {
  const wantedNorm = normalizeHeader(wanted).replace(/[^a-z0-9]+/g, "");
  const key = Object.keys(row).find(k => normalizeHeader(k).replace(/[^a-z0-9]+/g, "") === wantedNorm);
  return key ? row[key] : "";
}
function buildAvisoFromRow(row, avisoHeader, hitsByAviso) {
  const normalized = normalizeAviso(row[avisoHeader]);
  if (!normalized) return null;
  const hits = hitsByAviso.get(normalized) || [];
  const quoteKeys = [...new Set(hits.map(h => h.cotizacionKey || normalizeCotizacion(h.archivo)).filter(Boolean))];
  const uniqueFiles = [...new Set(hits.map(h => h.archivo).filter(Boolean))];
  const uniqueTypes = [...new Set(hits.map(h => h.tipo).filter(Boolean))];
  const cotizaciones = quoteKeys.length;
  const fecha = formatExcelDate(rowValue(row, "Fecha de aviso"));
  return {
    aviso: normalized,
    estado: cotizaciones === 0 ? "Pendiente" : (cotizaciones === 1 ? "Montado" : "Duplicado"),
    fecha,
    anio: getYear(fecha),
    mes: getMonth(fecha),
    grupo: cleanValue(rowValue(row, "Grupo planif.")),
    emplazamiento: cleanValue(rowValue(row, "Emplazamiento")),
    contratista: cleanValue(rowValue(row, "Nombre Contratista")),
    prioridad: cleanValue(rowValue(row, "Prioridad")),
    statusSistema: cleanValue(rowValue(row, "Status sistema")),
    codif: cleanValue(rowValue(row, "Codif.txt.cod.")),
    ptbo: cleanValue(rowValue(row, "Status sistema")).toUpperCase().includes("PTBO"),
    statusUsuario: cleanValue(rowValue(row, "Status usuario")),
    descripcion: cleanValue(rowValue(row, "Descripcion")),
    denominacion: cleanValue(rowValue(row, "Denominacion")),
    veces: cotizaciones,
    hallazgos: hits.length,
    archivos: uniqueFiles.join(" | "),
    tipos: uniqueTypes.join(" | ")
  };
}

function groupHallazgosByAviso(rows) {
  const map = new Map();
  rows.forEach(row => {
    const aviso = normalizeAviso(row.aviso);
    if (!aviso) return;
    row.cotizacionKey = row.cotizacionKey || normalizeCotizacion(row.archivo);
    if (!map.has(aviso)) map.set(aviso, []);
    map.get(aviso).push(row);
  });
  return map;
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

function renderDonut(counts, total) {
  const estados = ["Montado", "Pendiente", "Duplicado"];
  let acc = 0;
  const stops = estados.map(estado => {
    const value = counts[estado] || 0;
    const start = total ? (acc / total) * 100 : 0;
    acc += value;
    const end = total ? (acc / total) * 100 : 0;
    return `${colors[estado]} ${start}% ${end}%`;
  });
  document.getElementById("donut").style.background = `conic-gradient(${stops.join(", ")})`;
  document.getElementById("legend").innerHTML = estados.map(estado => `
    <div class="legend-row"><span class="swatch" style="background:${colors[estado]}"></span><span>${estado}</span><b>${fmt.format(counts[estado] || 0)}</b></div>
  `).join("");
}

function renderBars(id, entries) {
  const max = Math.max(...entries.map(([, value]) => value), 1);
  document.getElementById(id).innerHTML = entries.map(([label, value]) => `
    <div class="bar-row" title="${escapeHtml(label)}">
      <span class="bar-label">${escapeHtml(label)}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(value / max) * 100}%"></span></span>
      <b>${fmt.format(value)}</b>
    </div>
  `).join("");
}

function renderAvisosTable(rows) {
  document.getElementById("avisosTable").innerHTML = rows.map(a => `
    <tr>
      <td>${escapeHtml(a.aviso)}</td>
      <td><span class="status ${escapeHtml(a.estado)}">${escapeHtml(a.estado)}</span></td>
      <td>${escapeHtml(a.statusSistema)}</td>
      <td class="status-user ${hasEj(a.statusUsuario) ? "has-ej" : ""}">${escapeHtml(a.statusUsuario)}</td>
      <td>${escapeHtml(a.codif)}</td>
      <td class="description-cell">${escapeHtml(a.descripcion || a.denominacion)}</td>
      <td>${escapeHtml(a.fecha)}</td>
      <td>${escapeHtml(a.grupo)}</td>
      <td>${escapeHtml(a.emplazamiento)}</td>
      <td>${escapeHtml(a.contratista)}</td>
      <td>${fmt.format(a.veces || 0)}</td>
      <td>${fmt.format(a.hallazgos || 0)}</td>
    </tr>
  `).join("");
}

function renderHallazgosTable(rows) {
  document.getElementById("hallazgosTable").innerHTML = rows.map(h => `
    <tr>
      <td>${escapeHtml(h.aviso)}</td>
      <td>${escapeHtml(h.archivo)}</td>
      <td>${escapeHtml(h.tipo)}</td>
      <td>${escapeHtml(h.hoja)}</td>
      <td>${escapeHtml(h.celda)}</td>
    </tr>
  `).join("");
}

function resetFilters(shouldRender = true) {
  Object.assign(state, { estado: "", anio: "", mes: "", excludePtbo: true, excludeCotizaciones: true, contratista: "", search: "" });
  state.statusExcluded.clear();
  state.statusUserExcluded.clear();
  state.codifExcluded.clear();
  ["stateFilter", "yearFilter", "monthFilter", "contractorFilter"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("excludePtbo").checked = true;
  document.getElementById("excludeCotizaciones").checked = true;
  document.getElementById("searchInput").value = "";
  if (shouldRender) render();
}


function exportAvisosExcel() {
  const rows = filteredAvisos();
  if (!window.XLSX) {
    alert("No se pudo cargar la libreria para exportar a Excel.");
    return;
  }
  const exported = rows.map(a => ({
    Aviso: a.aviso || "",
    Estado: a.estado || "",
    "Status sistema": a.statusSistema || "",
    "Status usuario": a.statusUsuario || "",
    "Tiene EJ": hasEj(a.statusUsuario) ? "Si" : "No",
    "Codif.": a.codif || "",
    Descripcion: a.descripcion || a.denominacion || "",
    Fecha: a.fecha || "",
    Anio: a.anio || getYear(a.fecha),
    Mes: a.mes || getMonth(a.fecha),
    Grupo: a.grupo || "",
    Emplazamiento: a.emplazamiento || "",
    Contratista: a.contratista || "",
    Cotizaciones: a.veces || 0,
    Hallazgos: a.hallazgos || 0,
    Archivos: a.archivos || "",
    Tipos: a.tipos || ""
  }));
  const worksheet = XLSX.utils.json_to_sheet(exported);
  worksheet["!cols"] = [
    { wch: 12 }, { wch: 13 }, { wch: 18 }, { wch: 22 }, { wch: 9 },
    { wch: 28 }, { wch: 46 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
    { wch: 10 }, { wch: 14 }, { wch: 22 }, { wch: 12 }, { wch: 10 },
    { wch: 42 }, { wch: 18 }
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Avisos filtrados");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `detalle_avisos_filtrados_${stamp}.xlsx`);
}
function exportCurrent() {
  const rows = filteredAvisos();
  const headers = ["aviso", "estado", "statusSistema", "statusUsuario", "codif", "ptbo", "fecha", "anio", "mes", "grupo", "emplazamiento", "contratista", "veces", "hallazgos", "archivos"];
  const csv = [headers.join(";")].concat(rows.map(row => headers.map(h => `"${String(row[h] ?? "").replaceAll('"', '""')}"`).join(";"))).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "avisos_filtrados.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Sin dato";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}
function topEntries(obj, limit) { return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit); }
function uniqueSorted(values) { return [...new Set(values.filter(Boolean))].sort(); }
function setText(id, value) { document.getElementById(id).textContent = value; }
function normalizeAviso(value) { return String(value ?? "").trim().replace(/\.0$/, "").replace(/\D+/g, ""); }
function normalizeHeader(value) { return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function cleanValue(value) { return String(value ?? "").trim(); }
function getYear(dateText) { return String(dateText || "").slice(0, 4); }
function getMonth(dateText) { return String(dateText || "").slice(5, 7); }
function formatExcelDate(value) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  return cleanValue(value);
}
function hasEj(value) { return /(^|\s)EJ(\s|$)/i.test(String(value || "")); }
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
}

init();


















