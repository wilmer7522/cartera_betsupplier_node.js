import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import db from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";

const router = express.Router();
const upload = multer();

// Colecciones
const baseConocimiento = db.collection("base_conocimiento");
const cupoCartera = db.collection("cupo_cartera");
const usuariosCollection = db.collection("usuarios");

// Helper: formato YYYY-MM-DD desde Date o string ISO
function formatDateOnly(value) {
  if (!value && value !== 0) return value;
  const pad = (n) => String(n).padStart(2, "0");
  let d = null;
  if (value instanceof Date) d = value;
  else if (typeof value === "string") {
    const parsed = new Date(value);
    if (!isNaN(parsed)) d = parsed;
    else return value;
  } else return value;

  // usar UTC para evitar desplazamientos de zona horaria
  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// === Subir Excel (solo admin) ===
router.post(
  "/subir",
  obtenerUsuarioActual,
  soloAdmin,
  upload.single("archivo"),
  async (req, res) => {
    try {
      const buffer = req.file.buffer;
      const workbook = xlsx.read(buffer, { type: "buffer", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      // raw:true para distinguir números vs strings; cellDates:true para obtener Date cuando Excel marca fecha
      const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        defval: null,
        raw: true,
      });

      if (!rows.length)
        return res.status(400).json({ detail: "El archivo Excel está vacío" });

      const excelSerialToDate = (n) => {
        const num = Number(n);
        if (isNaN(num)) return null;
        // rango razonable de seriales (1980-2050)
        if (num < 25000 || num > 60000) return null;
        const jsDate = new Date(Math.round((num - 25569) * 86400 * 1000));
        // normalizar a medianoche UTC (00:00:00Z) para evitar offsets de zona
        return new Date(
          Date.UTC(jsDate.getFullYear(), jsDate.getMonth(), jsDate.getDate())
        );
      };

      const isDateKey = (key) => {
        if (!key) return false;
        const k = String(key).toLowerCase().replace(/\s+/g, "");
        // Sólo convertir explícitamente F_Expedic y F_Vencim (acepta variantes de mayúsculas/espacios)
        return (
          k === "f_expedic" ||
          k === "f_expedici" ||
          k === "f_expedido" ||
          k === "f_expediciòn" ||
          k === "f_exp" ||
          k === "f_vencim" ||
          k === "f_vencimiento" ||
          k === "f_venc"
        );
      };

      const data = rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          const orig = v;
          let val = v;
          if (typeof val === "string") val = val.trim();

          if (isDateKey(k)) {
            let converted = val;
            if (val instanceof Date) {
              // normalizar Date existente a medianoche UTC
              converted = new Date(
                Date.UTC(val.getFullYear(), val.getMonth(), val.getDate())
              );
            } else if (typeof val === "number") {
              const d = excelSerialToDate(val);
              converted = d || val;
            } else if (typeof val === "string") {
              // numeric string (serial)
              if (/^\d+(?:\.\d+)?$/.test(val)) {
                const d = excelSerialToDate(val);
                converted = d || val;
              } else {
                // date format dd/mm/yyyy or dd-mm-yyyy
                const m = val.match(
                  /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/
                );
                if (m) {
                  let year = parseInt(m[3], 10);
                  if (year < 100) year += year < 70 ? 2000 : 1900;
                  const month = parseInt(m[2], 10) - 1;
                  const day = parseInt(m[1], 10);
                  // crear como medianoche UTC
                  const d = new Date(Date.UTC(year, month, day));
                  if (!isNaN(d)) converted = d;
                }
              }
            }
            out[k] = converted;
            continue;
          }

          out[k] = val;
        }
        return out;
      });
      await baseConocimiento.deleteMany({});
      await baseConocimiento.insertMany(data);

      res.json({
        mensaje: `Archivo ${req.file.originalname} procesado correctamente`,
        total_registros: data.length,
      });
    } catch (error) {
      res
        .status(500)
        .json({ detail: `Error al procesar el archivo: ${error.message}` });
    }
  }
);

// === Ver datos del dashboard ===
router.get("/ver_dashboard", obtenerUsuarioActual, async (req, res) => {
  try {
    const usuario = req.usuario;
    let registros = [];

    if (usuario.rol === "admin") {
      registros = await baseConocimiento.find({}).toArray();
    } else {
      const vendedoresAsociados = usuario.vendedores_asociados || [];
      if (!vendedoresAsociados.length) return res.json({ total: 0, datos: [] });

      const todosVendedores = await usuariosCollection
        .find({ rol: "vendedor" })
        .project({ correo: 1, nombre: 1 })
        .toArray();
      const correoNombre = Object.fromEntries(
        todosVendedores.map((v) => [v.correo, v.nombre])
      );
      const nombresFiltrados = vendedoresAsociados.map((c) =>
        (correoNombre[c] || c).toUpperCase()
      );

      const filtro = {
        $or: nombresFiltrados.map((nombre) => ({
          Nombre_Vendedor: { $regex: nombre, $options: "i" },
        })),
      };

      registros = await baseConocimiento.find(filtro).toArray();
    }

    // Formatear fechas para la respuesta (solo F_Expedic y F_Vencim)
    const registrosFormateados = registros.map((r) => {
      const copy = { ...r };
      // normalizar keys posibles
      for (const key of Object.keys(copy)) {
        const kn = key.toLowerCase().replace(/\s+/g, "");
        if (
          kn === "f_expedic" ||
          kn.startsWith("f_exped") ||
          kn.includes("fexped") ||
          kn === "f_vencim" ||
          kn.includes("fvenc")
        ) {
          copy[key] = formatDateOnly(copy[key]);
        }
      }
      return copy;
    });

    res.json({
      total: registrosFormateados.length,
      datos: registrosFormateados,
    });
  } catch (err) {
    res.status(500).json({ detail: "Error al obtener dashboard" });
  }
});

// === Subir Excel de Cupo Cartera (solo admin) ===
router.post(
  "/subir_cupo_cartera",
  obtenerUsuarioActual,
  soloAdmin,
  upload.single("archivo"),
  async (req, res) => {
    try {
      const buffer = req.file.buffer;
      const workbook = xlsx.read(buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
        range: 4, // Los encabezados empiezan en la fila 5
      });

      if (!data.length)
        return res.status(400).json({ detail: "El archivo Excel está vacío" });

      await cupoCartera.deleteMany({});
      await cupoCartera.insertMany(data);

      res.json({
        mensaje: `Archivo ${req.file.originalname} procesado correctamente`,
        total_registros: data.length,
      });
    } catch (error) {
      res
        .status(500)
        .json({
          detail: `Error al procesar el archivo de cupo cartera: ${error.message}`,
        });
    }
  }
);

// === Ver datos de Cupo Cartera ===
router.get("/ver_cupo_cartera", obtenerUsuarioActual, async (req, res) => {
  try {
    const registros = await cupoCartera.find({}).toArray();
    res.json({ total: registros.length, datos: registros });
  } catch (error) {
    res
      .status(500)
      .json({ detail: `Error al cargar cupo cartera: ${error.message}` });
  }
});

// === Descargar Excel filtrado ===
router.post("/descargar_filtrado", obtenerUsuarioActual, async (req, res) => {
  try {
    const filtros = req.body;
    const usuario = req.usuario;
    const query = {};

    // --- ADMIN ---
    if (usuario.rol === "admin") {
      const vendedores = filtros.vendedoresSeleccionados || [];
      if (vendedores.length) {
        query.$or = vendedores.map((v) => ({
          Nombre_Vendedor: { $regex: v, $options: "i" },
        }));
      }
    }
    // --- VENDEDOR ---
    else if (usuario.rol === "vendedor") {
      const vendedoresAsociados = usuario.vendedores_asociados || [];
      const todosVendedores = await usuariosCollection
        .find({ rol: "vendedor" })
        .project({ correo: 1, nombre: 1 })
        .toArray();
      const correoNombre = Object.fromEntries(
        todosVendedores.map((v) => [v.correo, v.nombre])
      );
      const nombresAutorizados = vendedoresAsociados.map(
        (c) => correoNombre[c] || c
      );

      const filtrados = filtros.vendedoresSeleccionados || [];
      const validos = filtrados.filter((v) =>
        nombresAutorizados.some((x) => x.toLowerCase() === v.toLowerCase())
      );

      query.$or = (validos.length ? validos : nombresAutorizados).map((v) => ({
        Nombre_Vendedor: { $regex: v, $options: "i" },
      }));
    }

    // --- CLIENTE / NOTAS / COLUMNA ---
    if (filtros.busqueda)
      query.Cliente = { $regex: filtros.busqueda, $options: "i" };
    if (filtros.mostrarNotasCredito)
      query.T_Dcto = { $regex: "^NC$", $options: "i" };
    if (filtros.columnaSeleccionada)
      query[filtros.columnaSeleccionada] = { $ne: 0 };

    const registros = await baseConocimiento.find(query).toArray();
    if (!registros.length)
      return res
        .status(404)
        .json({
          detail: "No hay datos para exportar con los filtros actuales",
        });

    // Formatear fechas en registros antes de exportar
    const registrosExport = registros.map((r) => {
      const copy = { ...r };
      for (const key of Object.keys(copy)) {
        const kn = key.toLowerCase().replace(/\s+/g, "");
        if (
          kn === "f_expedic" ||
          kn.startsWith("f_exped") ||
          kn.includes("fexped") ||
          kn === "f_vencim" ||
          kn.includes("fvenc")
        ) {
          copy[key] = formatDateOnly(copy[key]);
        }
      }
      return copy;
    });

    const hoja = xlsx.utils.json_to_sheet(registrosExport);
    const libro = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(libro, hoja, "Base_Conocimiento");

    const buffer = xlsx.write(libro, { bookType: "xlsx", type: "buffer" });

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=base_conocimiento_filtrado.xlsx"
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    res
      .status(500)
      .json({ detail: `Error al generar Excel filtrado: ${error.message}` });
  }
});

export default router;
