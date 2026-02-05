import xlsx from "xlsx";

// ============================================
// HELPERS DE FORMATO
// ============================================

export function formatDateOnly(value) {
  if (!value && value !== 0) return value;
  const pad = (n) => String(n).padStart(2, "0");
  let d = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed)) d = parsed;
    else return value;
  } else return value;

  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

export function excelSerialToDate(n) {
  const num = Number(n);
  if (isNaN(num)) return null;
  if (num < 25000 || num > 75000) return null;
  const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
  return new Date(
    Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate()),
  );
}

// ============================================
// HELPERS DE NORMALIZACIÓN
// ============================================

function slugify(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function normalizeKey(key) {
  if (!key) return key;
  const k = slugify(key).replace(/[\s_]+/g, "");

  // Mapeo exacto según las columnas del Excel
  const MAPEOS = {
    // Campos de identificación
    cliente: "Cliente",
    nombrecliente: "Nombre_Cliente",
    centrocostos: "Centro_Costos",
    nombrezona: "Nombre_Zona",
    nombreciudad: "Nombre_Ciudad",
    nombrevendedor: "Nombre_Vendedor",
    t_dcto: "T_Dcto",
    documento: "Documento",
    fexpedic: "F_Expedic",
    fvencim: "F_Vencim",
    diasvc: "DiasVc",

    // Campos monetarios
    deuda: "Deuda",
    pagado: "Pagado",
    venc91: "Venc_91",
    venc6190: "Venc_61_90",
    venc3160: "Venc_31_60",
    venc030: "Venc_0_30",
    porvenc: "Por_Venc",
    saldo: "Saldo",
    nota: "Nota",
    direccioncliente: "Direccion_Cliente",
    cupocredito: "CUPO_CREDITO",
  };

  return MAPEOS[k] || key;
}

// ============================================
// HELPERS DE TIPO
// ============================================

export function isNumericKey(key) {
  if (!key) return false;
  return (
    key === "Deuda" ||
    key === "Pagado" ||
    key === "Saldo" ||
    key === "Por_Venc" ||
    key === "Venc_0_30" ||
    key === "Venc_31_60" ||
    key === "Venc_61_90" ||
    key === "Venc_91" ||
    key === "CUPO_CREDITO" ||
    key === "DiasVc"
  );
}

export function isDateKey(key) {
  return key === "F_Expedic" || key === "F_Vencim";
}

// ============================================
// HELPERS DE CONVERSIÓN
// ============================================

export function cleanNumber(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return val;

  let s = String(val).trim();

  // Formato español: 1.000,50
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  // Solo comas
  else if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length > 2) {
      s = s.replace(/,/g, "");
    } else if (parts[1].length <= 2) {
      s = s.replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  }
  // Solo puntos
  else if (s.includes(".")) {
    const parts = s.split(".");
    if (parts.length > 2 || parts[1].length > 2) {
      s = s.replace(/\./g, "");
    }
  }

  const n = parseFloat(s.replace(/[^\d\.-]/g, ""));
  return isNaN(n) ? 0 : n;
}

// ============================================
// PROCESAMIENTO PRINCIPAL
// ============================================

export function processExcelRow(row) {
  const out = {};

  for (const [rawK, v] of Object.entries(row)) {
    const k = normalizeKey(rawK);
    let val = v;
    if (typeof val === "string") val = val.trim();

    // 1. Procesar Fechas
    if (isDateKey(k)) {
      let converted = val;

      if (val instanceof Date) {
        converted = new Date(
          Date.UTC(val.getFullYear(), val.getMonth(), val.getDate()),
        );
      } else if (typeof val === "number") {
        const d = excelSerialToDate(val);
        converted = d || val;
      } else if (typeof val === "string" && /^\d+(?:\.\d+)?$/.test(val)) {
        const d = excelSerialToDate(val);
        converted = d || val;
      } else if (typeof val === "string") {
        const m = val.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
        if (m) {
          let year = parseInt(m[3], 10);
          if (year < 100) year += year < 70 ? 2000 : 1900;
          const month = parseInt(m[2], 10) - 1;
          const day = parseInt(m[1], 10);
          const d = new Date(Date.UTC(year, month, day));
          if (!isNaN(d)) converted = d;
        }
      }

      out[k] = converted;
      continue;
    }

    // 2. Procesar Números
    if (isNumericKey(k)) {
      out[k] = cleanNumber(val);
      continue;
    }

    // 3. Otros campos (strings)
    out[k] = val;

    // 4. Optimización para búsqueda por NIT
    if (k === "Cliente") {
      const nitLimpio = String(val || "").replace(/\D/g, "");
      out["Cliente_Busqueda"] = nitLimpio;
      out["Cliente_Core"] = nitLimpio.substring(0, 9);
    }
  }

  return out;
}
