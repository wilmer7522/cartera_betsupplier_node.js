import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";
import { Resend } from 'resend';
import crypto from 'crypto';



// Configuración de Resend usando la variable de entorno
const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "clave_super_secreta";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://portal.betsupplier.co";

// Lazy loading de la colección para esperar a la conexión
const getUsuariosCollection = () => getDb().collection("usuarios");

// === FUNCIÓN DE APOYO PARA BUSCAR NOMBRE REAL DEL CLIENTE ===
async function buscarNombreCliente(nit) {
  const db = getDb();
  const registro = await db.collection("base_conocimiento").findOne({ Cliente: nit.toString().trim() });
  return registro ? registro.Nombre_Cliente : nit;
}

// === SOLICITAR RECUPERACIÓN DE CONTRASEÑA ===
router.post("/solicitar-recuperacion", async (req, res) => {
  try {
    const { correo } = req.body;
    if (!correo) return res.status(400).json({ detail: "El correo es requerido" });

    const correoLower = correo.trim().toLowerCase();
    const usuario = await getUsuariosCollection().findOne({ correo: correoLower });

    // Mensaje genérico por seguridad
    if (!usuario) {
      return res.json({ mensaje: "Si el correo existe, se ha enviado un enlace de recuperación." });
    }

    const token = crypto.randomBytes(20).toString('hex');
    const expiracion = new Date(Date.now() + 3600000); // 1 hora de validez

    await getUsuariosCollection().updateOne(
      { correo: correoLower },
      { 
        $set: { 
          resetPasswordToken: token,
          resetPasswordExpires: expiracion
        } 
      }
    );

    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;

    const { error } = await resend.emails.send({
      from: 'Soporte <onboarding@resend.dev>',
      to: [correoLower],
      subject: 'Recuperación de Contraseña - Cartera Betsupplier',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px; border-radius: 10px;">
          <h2 style="color: #00bcd4; text-align: center;">Recuperación de Contraseña</h2>
          <p>Hola <strong>${usuario.nombre || 'Usuario'}</strong>,</p>
          <p>Has solicitado restablecer tu contraseña para el Portal de Cartera. Haz clic en el botón de abajo para continuar:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #00bcd4; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
          </div>
          <p style="font-size: 12px; color: #777;">Si el botón no funciona, copia y pega este enlace: <br>${resetUrl}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">Este enlace expirará en 1 hora. Si no solicitaste esto, puedes ignorar este correo.</p>
        </div>
      `
    });

    if (error) {
      console.error("Error enviando correo Resend:", error);
      return res.status(500).json({ detail: "Error al enviar el correo." });
    }

    res.json({ mensaje: "Si el correo existe, se ha enviado un enlace de recuperación." });

  } catch (err) {
    console.error("Error en solicitar-recuperacion:", err);
    res.status(500).json({ detail: `Error: ${err.message}` });
  }
});

// === RESTABLECER CONTRASEÑA ===
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ detail: "La nueva contraseña es requerida" });

    const usuario = await getUsuariosCollection().findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!usuario) {
      return res.status(400).json({ detail: "El enlace es inválido o ha expirado." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await getUsuariosCollection().updateOne(
      { _id: usuario._id },
      {
        $set: { password: hashed },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" }
      }
    );

    res.json({ mensaje: "✅ Contraseña actualizada correctamente." });

  } catch (err) {
    res.status(500).json({ detail: `Error: ${err.message}` });
  }
});

// === REGISTRO ===
router.post("/registro", async (req, res) => {
  try {
    const { correo, password, nombre, rol } = req.body;
    const correoLower = correo.trim().toLowerCase();
    const existente = await getUsuariosCollection().findOne({ correo: correoLower });
    if (existente) return res.status(400).json({ detail: "❌ El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: [],
    };

    await getUsuariosCollection().insertOne(nuevo);
    res.json({ mensaje: "✅ Usuario creado exitosamente." });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === LOGIN ===
router.post("/login", async (req, res) => {
  try {
    const { correo, password } = req.body;
    const correoLower = correo.trim().toLowerCase();
    const user = await getUsuariosCollection().findOne({ correo: correoLower });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ detail: "❌ Credenciales inválidas" });
    }

    await getUsuariosCollection().updateOne({ correo: correoLower }, { $set: { ultimo_login: new Date() } });
    const expira = Math.floor(Date.now() / 1000) + 30 * 60; 
    const token = jwt.sign({ correo: user.correo, rol: user.rol, exp: expira }, SECRET_KEY);
    res.json({ token, nombre: user.nombre, rol: user.rol });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === PERFIL ===
router.get("/perfil", obtenerUsuarioActual, (req, res) => {
  res.json({
    mensaje: `Bienvenido ${req.usuario.nombre}`,
    vendedores_asociados: req.usuario.vendedores_asociados || [],
  });
});

// === LISTAR USUARIOS ===
router.get("/todos", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  const usuarios = await getUsuariosCollection().find({}, { projection: { password: 0 } }).toArray();
  res.json({ usuarios });
});

// === CREAR USUARIO (ADMIN) ===
router.post("/crear", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const { correo, password, nombre, rol, vendedores_asociados = [], clientes_asociados = [] } = req.body;
    const correoLower = correo.trim().toLowerCase();
    if (await getUsuariosCollection().findOne({ correo: correoLower })) {
      return res.status(400).json({ detail: "❌ El correo ya existe" });
    }

    const clientesNormalizados = await Promise.all(clientes_asociados.map(async (c) => {
      const nit = (typeof c === "object" ? c.nit : c).toString().trim();
      const nombreReal = await buscarNombreCliente(nit);
      return { nit, nombre: nombreReal };
    }));

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: vendedores_asociados.map(v => v.trim().toLowerCase()),
      clientes_asociados: clientesNormalizados,
    };

    await getUsuariosCollection().insertOne(nuevo);
    res.json({ mensaje: `✅ Usuario '${nombre.toUpperCase()}' creado` });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === ACTUALIZAR USUARIO ===
router.put("/actualizar/:correo", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const correo = req.params.correo.trim().toLowerCase();
    const { nombre, rol, password, vendedores_asociados, clientes_asociados } = req.body;
    const updateDoc = {};

    if (nombre) updateDoc.nombre = nombre.trim().toUpperCase();
    if (rol) updateDoc.rol = rol.trim();
    if (password) updateDoc.password = await bcrypt.hash(password, 10);
    if (vendedores_asociados) updateDoc.vendedores_asociados = vendedores_asociados.map(v => v.trim().toLowerCase());
    
    if (clientes_asociados) {
      updateDoc.clientes_asociados = await Promise.all(clientes_asociados.map(async (c) => {
        const nit = (typeof c === "object" ? c.nit : c).toString().trim();
        const nombreReal = await buscarNombreCliente(nit);
        return { nit, nombre: nombreReal };
      }));
    }

    await getUsuariosCollection().updateOne({ correo }, { $set: updateDoc });
    res.json({ mensaje: "✅ Usuario actualizado" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === ACTUALIZAR CLIENTES ASOCIADOS ===
router.put("/:correo/clientes_asociados", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const correo = req.params.correo.trim().toLowerCase();
    const { clientes_asociados } = req.body;
    const clientesNormalizados = await Promise.all(clientes_asociados.map(async (c) => {
      const nit = (typeof c === "object" ? c.nit : c).toString().trim();
      const nombreReal = await buscarNombreCliente(nit);
      return { nit, nombre: nombreReal };
    }));

    await getUsuariosCollection().updateOne({ correo }, { $set: { clientes_asociados: clientesNormalizados } });
    res.json({ mensaje: "✅ Clientes actualizados" });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === ELIMINAR USUARIO ===
router.delete("/eliminar/:correo", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  const correo = req.params.correo.trim().toLowerCase();
  await getUsuariosCollection().deleteOne({ correo });
  res.json({ mensaje: "🗑️ Usuario eliminado" });
});

export default router;