import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import fs from "fs";
import { getDb } from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";
import { processExcelRow } from "../utils/excel_utils.js";

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// === Helpers de Base de Datos ===
const getBaseConocimiento = () => getDb().collection("base_conocimiento");
const getCupoCartera = () => getDb().collection("cupo_cartera");
const getUsuarios = () => getDb().collection("usuarios"); // <-- SOLUCIÓN AL ERROR

// === Helper: Formato de fecha para Excel ===
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

  const day = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

// === 1. Subir Excel (Optimizado) ===
router.post(
  "/subir",
  obtenerUsuarioActual,
  soloAdmin,
  upload.single("archivo"),
  async (req, res) => {
    try {
      if (!req.file || !req.file.buffer) {
        return res.status(400).json({ detail: "No se subió archivo" });
      }

      // Leer Excel desde buffer (xls / xlsx)
      const workbook = xlsx.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
      });

      const sheetName = workbook.SheetNames[0];
      const rows = xlsx.utils.sheet_to_json(
        workbook.Sheets[sheetName],
        {
          defval: null,
          raw: true,
        }
      );

      if (!rows.length) {
        return res
          .status(400)
          .json({ detail: "El archivo Excel está vacío" });
      }

      // 🔹 Excluir siempre las últimas 2 filas (totales)
      const rowsValidas =
        rows.length > 2 ? rows.slice(0, -2) : rows;

      // --------------------------------------------------
      // Utilidades mínimas para fechas
      // --------------------------------------------------

      const excelSerialToDate = (n) => {
        const num = Number(n);
        if (isNaN(num)) return null;
        if (num < 25000 || num > 60000) return null;

        const d = new Date(Math.round((num - 25569) * 86400 * 1000));
        return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      };

      const isDateKey = (key) => {
        if (!key) return false;
        const k = String(key).toLowerCase().replace(/\s+/g, "");
        return k === "f_expedic" || k === "f_vencim";
      };

      // --------------------------------------------------
      // Normalización mínima
      // --------------------------------------------------

      const data = rowsValidas.map((row) => {
        const out = {};

        for (const [k, v] of Object.entries(row)) {
          let val = v;

          if (typeof val === "string") {
            val = val.trim();
          }

          if (isDateKey(k)) {
            if (val instanceof Date) {
              val = new Date(
                Date.UTC(val.getFullYear(), val.getMonth(), val.getDate())
              );
            } else if (typeof val === "number") {
              val = excelSerialToDate(val) || val;
            } else if (
              typeof val === "string" &&
              /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.test(val)
            ) {
              const [, d, m, y] = val.match(
                /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/
              );
              let year = parseInt(y, 10);
              if (year < 100) year += year < 70 ? 2000 : 1900;

              val = new Date(
                Date.UTC(year, parseInt(m, 10) - 1, parseInt(d, 10))
              );
            }
          }

          out[k] = val;
        }

        return out;
      });

      // --------------------------------------------------
      // Persistencia
      // --------------------------------------------------

      await baseConocimiento.deleteMany({});
      await baseConocimiento.insertMany(data);

      res.json({
        mensaje: `Archivo ${req.file.originalname} procesado correctamente`,
        total_registros: data.length,
      });
    } catch (error) {
      res.status(500).json({
        detail: `Error al procesar el archivo: ${error.message}`,
      });
    }
  }
);


// === 2. Ver Dashboard ===
router.get("/ver_dashboard", obtenerUsuarioActual, async (req, res) => {
  try {
    const usuario = req.usuario;
    const baseConocimiento = getBaseConocimiento();

    if (usuario.rol === "cliente") {
      const nitsPermitidos = (usuario.clientes_asociados || []).map((c) =>
        (typeof c === "object" ? c.nit : c).toString().trim(),
      );
      if (nitsPermitidos.length === 0) return res.json({ total: 0, datos: [] });

      const query = { Cliente: { $in: nitsPermitidos } };
      const registros = await baseConocimiento.find(query).toArray();
      return res.json({
        total: registros.length,
        datos: registros.map((r) => processExcelRow(r)),
      });
    } else if (usuario.rol === "vendedor") {
      const vends = usuario.vendedores_asociados || [];
      const query = {
        Nombre_Vendedor: { $in: vends.map((v) => new RegExp(v, "i")) },
      };
      const registros = await baseConocimiento.find(query).toArray();
      return res.json({
        total: registros.length,
        datos: registros.map((r) => processExcelRow(r)),
      });
    }

    
    const registrosAdmin = await baseConocimiento.find({}).toArray();

    return res.json({
      total: registrosAdmin.length,
      datos: registrosAdmin.map((r) => processExcelRow(r)),
    });
  } catch (err) {
    res.status(500).json({ detail: "Error en la consulta" });
  }
});

// === 2.1. Clientes Únicos (para AdminPanel) ===
router.get("/clientes_unicos", obtenerUsuarioActual, async (req, res) => {
  try {
    const usuario = req.usuario;
    const baseConocimiento = getBaseConocimiento();

    // Si es cliente, solo puede ver sus clientes asociados
    if (usuario.rol === "cliente") {
      const nitsPermitidos = (usuario.clientes_asociados || []).map((c) =>
        (typeof c === "object" ? c.nit : c).toString().trim(),
      );
      if (nitsPermitidos.length === 0) return res.json({ total: 0, clientes: [] });

      const query = { Cliente: { $in: nitsPermitidos } };
      const registros = await baseConocimiento.find(query).toArray();
      const clientesMap = new Map();
      registros.forEach((r) => {
        const nit = r.Cliente?.toString().trim();
        const nombre = r.Nombre_Cliente || r.Nombre || nit;
        if (nit && !clientesMap.has(nit)) {
          clientesMap.set(nit, { nit, nombre });
        }
      });
      return res.json({ total: clientesMap.size, clientes: Array.from(clientesMap.values()) });
    }

    // Si es vendedor, solo puede ver clientes de sus vendedores asociados
    if (usuario.rol === "vendedor") {
      const vends = usuario.vendedores_asociados || [];
      const query = {
        Nombre_Vendedor: { $in: vends.map((v) => new RegExp(v, "i")) },
      };
      const registros = await baseConocimiento.find(query).toArray();
      const clientesMap = new Map();
      registros.forEach((r) => {
        const nit = r.Cliente?.toString().trim();
        const nombre = r.Nombre_Cliente || r.Nombre || nit;
        if (nit && !clientesMap.has(nit)) {
          clientesMap.set(nit, { nit, nombre });
        }
      });
      return res.json({ total: clientesMap.size, clientes: Array.from(clientesMap.values()) });
    }

    // Admin: todos los clientes
    const registros = await baseConocimiento.find({}).toArray();
    const clientesMap = new Map();
    registros.forEach((r) => {
      const nit = r.Cliente?.toString().trim();
      const nombre = r.Nombre_Cliente || r.Nombre || nit;
      if (nit && !clientesMap.has(nit)) {
        clientesMap.set(nit, { nit, nombre });
      }
    });
    return res.json({ total: clientesMap.size, clientes: Array.from(clientesMap.values()) });
  } catch (err) {
    res.status(500).json({ detail: "Error en la consulta de clientes únicos" });
  }
});

// === 2.2. Clientes Paginados (para useDashboard) ===
router.get("/clientes_paginados", obtenerUsuarioActual, async (req, res) => {
  try {
    const usuario = req.usuario;
    const baseConocimiento = getBaseConocimiento();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    // Construir consulta según rol
    let query = {};
    if (usuario.rol === "cliente") {
      const nitsPermitidos = (usuario.clientes_asociados || []).map((c) =>
        (typeof c === "object" ? c.nit : c).toString().trim(),
      );
      if (nitsPermitidos.length === 0) return res.json({ clientes: [], total: 0, currentPage: page, hasNextPage: false, hasPrevPage: false });
      query = { Cliente: { $in: nitsPermitidos } };
    } else if (usuario.rol === "vendedor") {
      const vends = usuario.vendedores_asociados || [];
      query = { Nombre_Vendedor: { $in: vends.map((v) => new RegExp(v, "i")) } };
    }

    const total = await baseConocimiento.countDocuments(query);
    const registros = await baseConocimiento.find(query).skip(skip).limit(limit).toArray();

    const clientesMap = new Map();
    registros.forEach((r) => {
      const nit = r.Cliente?.toString().trim();
      const nombre = r.Nombre_Cliente || r.Nombre || nit;
      if (nit && !clientesMap.has(nit)) {
        clientesMap.set(nit, { nit, nombre });
      }
    });

    const clientes = Array.from(clientesMap.values());
    const hasNextPage = skip + limit < total;
    const hasPrevPage = page > 1;

    return res.json({
      clientes,
      total,
      currentPage: page,
      hasNextPage,
      hasPrevPage,
    });
  } catch (err) {
    res.status(500).json({ detail: "Error en la consulta paginada de clientes" });
  }
});

// === 3. Descargar Excel Filtrado (CORREGIDO) ===
router.post("/descargar_filtrado", obtenerUsuarioActual, async (req, res) => {
  try {
    const filtros = req.body;
    const usuario = req.usuario;
    const query = {};

    if (usuario.rol === "admin") {
      const vendedores = filtros.vendedoresSeleccionados || [];
      if (vendedores.length) {
        query.$or = vendedores.map((v) => ({
          Nombre_Vendedor: { $regex: v, $options: "i" },
        }));
      }
    } else if (usuario.rol === "vendedor") {
      const vendedoresAsociados = usuario.vendedores_asociados || [];
      // Usamos el helper getUsuarios() en lugar de la variable no definida
      const todosVendedores = await getUsuarios()
        .find({ rol: "vendedor" })
        .project({ correo: 1, nombre: 1 })
        .toArray();
      const correoNombre = Object.fromEntries(
        todosVendedores.map((v) => [v.correo, v.nombre]),
      );
      const nombresAutorizados = vendedoresAsociados.map(
        (c) => correoNombre[c] || c,
      );

      const filtrados = filtros.vendedoresSeleccionados || [];
      const validos = filtrados.filter((v) =>
        nombresAutorizados.some((x) => x.toLowerCase() === v.toLowerCase()),
      );

      query.$or = (validos.length ? validos : nombresAutorizados).map((v) => ({
        Nombre_Vendedor: { $regex: v, $options: "i" },
      }));
    } else if (usuario.rol === "cliente") {
      const nits = (usuario.clientes_asociados || []).map((c) =>
        (typeof c === "object" ? c.nit : c).toString().trim(),
      );
      if (!nits.length)
        return res.status(403).json({ detail: "No autorizado" });
      query.Cliente = { $in: nits };
    }

    if (filtros.busqueda)
      query.Cliente = { $regex: filtros.busqueda, $options: "i" };
    if (filtros.mostrarNotasCredito)
      query.T_Dcto = { $regex: "^NC$", $options: "i" };
    if (filtros.columnaSeleccionada)
      query[filtros.columnaSeleccionada] = { $ne: 0 };

    const registros = await getBaseConocimiento().find(query).toArray();
    if (!registros.length) return res.status(404).json({ detail: "Sin datos" });

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
      "attachment; filename=cartera_filtrada.xlsx",
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

// === Rutas de Cupo Cartera y otros (Simplificadas) ===
router.get("/ver_cupo_cartera", obtenerUsuarioActual, async (req, res) => {
  try {
    const usuario = req.usuario;
    let query = {};
    if (usuario.rol === "cliente") {
      const nits = (usuario.clientes_asociados || []).map((c) =>
        (typeof c === "object" ? c.nit : c).toString().trim(),
      );
      query = {
        Mt_Cliente_Proveedor: { $in: nits.map((n) => new RegExp(n, "i")) },
      };
    }
    const registros = await getCupoCartera().find(query).limit(1000).toArray();
    res.json({ total: registros.length, datos: registros });
  } catch (error) {
    res.status(500).json({ detail: error.message });
  }
});

router.post(
  "/subir_cupo_cartera",
  obtenerUsuarioActual,
  soloAdmin,
  upload.single("archivo"),
  async (req, res) => {
    const filePath = req.file?.path;
    try {
      await getCupoCartera().deleteMany({});
      const workbook = xlsx.readFile(filePath, { type: "file" });
      const rows = xlsx.utils.sheet_to_json(
        workbook.Sheets[workbook.SheetNames[0]],
        { range: 4, defval: null },
      );
      if (rows.length > 0) await getCupoCartera().insertMany(rows);
      fs.unlink(filePath, () => {});
      res.json({ mensaje: "Cupos actualizados", total_registros: rows.length });
    } catch (error) {
      res.status(500).json({ detail: error.message });
    }
  },
);

export default router;
