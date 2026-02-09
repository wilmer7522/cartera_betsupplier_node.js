import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import ExcelJS from "exceljs";
import fs from "fs";
import { getDb } from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";
import { processExcelRow } from "../utils/excel_utils.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

// === Helpers de Base de Datos ===
const getBaseConocimiento = () => getDb().collection("base_conocimiento");
const getCupoCartera = () => getDb().collection("cupo_cartera");
const getUsuarios = () => getDb().collection("usuarios");

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
    const buffer = req.file?.buffer;
    const originalname = req.file?.originalname;

    if (!buffer)
      return res.status(400).json({ detail: "No se subió archivo o está vacío" });

    // Validar que sea un archivo .xls
    if (!originalname || !originalname.toLowerCase().endsWith(".xls")) {
      return res.status(400).json({ detail: "Formato de archivo no soportado. Por favor, sube un archivo .xls" });
    }

    try {
      const BATCH_SIZE = 1000;
      let totalInsertados = 0;

      await getBaseConocimiento().deleteMany({});

      const workbook = xlsx.read(buffer, {
        type: "buffer",
        cellDates: true,
        dense: true,
      });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = xlsx.utils
        .sheet_to_json(sheet, { defval: null, raw: true })
        .slice(0, -2); // Se omiten las dos últimas filas

      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const chunk = rows
          .slice(i, i + BATCH_SIZE)
          .map((r) => processExcelRow(r));
        await getBaseConocimiento().insertMany(chunk);
        totalInsertados += chunk.length;
      }

      res.json({ mensaje: "Procesado", total_registros: totalInsertados });
    } catch (error) {
      res.status(500).json({ detail: error.message });
    }
  },
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
    let query = {};

    // 1. Definir filtros según rol
    if (usuario.rol === "cliente") {
      const nits = (usuario.clientes_asociados || []).map(c => 
        (typeof c === "object" ? c.nit : c).toString().trim()
      );
      if (!nits.length) return res.json({ total: 0, clientes: [] });
      query = { Cliente: { $in: nits } };
    } else if (usuario.rol === "vendedor") {
      const vends = usuario.vendedores_asociados || [];
      query = { Nombre_Vendedor: { $in: vends.map(v => new RegExp(v, "i")) } };
    }

    // 2. Obtener todos los registros que coincidan con el filtro
    const registros = await baseConocimiento.find(query).toArray();
    
    // 3. Crear mapa de clientes únicos
    const clientesMap = new Map();
    registros.forEach((r) => {
      const nit = r.Cliente?.toString().trim();
      const nombre = r.Nombre_Cliente || nit;
      if (nit && !clientesMap.has(nit)) {
        clientesMap.set(nit, { nit, nombre });
      }
    });

    const clientes = Array.from(clientesMap.values()).sort((a, b) => 
      a.nombre.localeCompare(b.nombre)
    );

    return res.json({ total: clientes.length, clientes });
  } catch (err) {
    console.error("Error en clientes_unicos:", err);
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
      const nombre = r.Nombre_Cliente || nit; // Usar Nombre_Cliente en lugar de Nombre
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
    const buffer = req.file?.buffer;
    const originalname = req.file?.originalname;

    if (!buffer)
      return res.status(400).json({ detail: "No se subió archivo o está vacío" });
    
    // Validar que sea un archivo .xlsx
    if (!originalname || !originalname.toLowerCase().endsWith(".xlsx")) {
      return res.status(400).json({ detail: "Formato de archivo no soportado para cupo de cartera. Por favor, sube un archivo .xlsx" });
    }

    const tempFilePath = `/tmp/${Date.now()}-${originalname}`; // Ruta temporal
    
    try {
      fs.writeFileSync(tempFilePath, buffer); // Escribir buffer a archivo temporal

      await getCupoCartera().deleteMany({});

      const BATCH_SIZE = 1000;
      let totalInsertados = 0;
      let headers = null;
      let headerRowFound = false;
      let rowsToInsert = [];

      const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(
        tempFilePath,
        { sharedStrings: "cache", worksheets: "emit" },
      );

      for await (const worksheetReader of workbookReader) {
        let rowNum = 0;
        for await (const row of worksheetReader) {
          rowNum++;
          if (rowNum < 5) { // Omitir las primeras 4 filas (range: 4)
            continue;
          }

          if (!headerRowFound) {
            headers = row.values.map(h => typeof h === 'string' ? h.trim() : h); // Obtener encabezados de la primera fila de datos
            headerRowFound = true;
            continue;
          }
          
          const rowData = {};
          if (headers) {
              for (let i = 1; i < headers.length; i++) { // Asumimos headers[0] es vacío por ExcelJS
                  let val = row.values[i];
                  if (val && typeof val === "object") val = val.result || val.text || val;
                  rowData[headers[i]] = val;
              }
          }
          
          if (Object.keys(rowData).length > 0) { // Asegurarse de que no sea una fila completamente vacía
            rowsToInsert.push(rowData);
          }

          if (rowsToInsert.length >= BATCH_SIZE) {
            await getCupoCartera().insertMany(rowsToInsert);
            totalInsertados += rowsToInsert.length;
            rowsToInsert = [];
          }
        }
      }

      if (rowsToInsert.length > 0) { // Insertar cualquier lote restante
        await getCupoCartera().insertMany(rowsToInsert);
        totalInsertados += rowsToInsert.length;
      }
      
      res.json({ mensaje: "Cupos actualizados", total_registros: totalInsertados });
    } catch (error) {
      res.status(500).json({ detail: error.message });
    } finally {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath); // Limpiar archivo temporal
      }
    }
  },
);

export default router;
