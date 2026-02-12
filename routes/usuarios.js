import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { getDb } from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";
import { Resend } from 'resend';
import crypto from 'crypto';

dotenv.config();

// Configurar Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY || "clave_super_secreta";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://portal.betsupplier.co"; // Fallback a producción si no está definido

// Lazy loading de la colección para esperar a la conexión
const getUsuariosCollection = () => getDb().collection("usuarios");

// === FUNCIÓN DE APOYO PARA BUSCAR NOMBRE REAL DEL CLIENTE ===
async function buscarNombreCliente(nit) {
  const db = getDb();
  // Busca en la base de conocimiento por el campo Cliente (NIT)
  const registro = await db.collection("base_conocimiento").findOne({ Cliente: nit.toString().trim() });
  return registro ? registro.Nombre_Cliente : nit; // Si lo encuentra devuelve el nombre, si no, el NIT
}

// === SOLICITAR RECUPERACIÓN DE CONTRASEÑA ===
router.post("/solicitar-recuperacion", async (req, res) => {
  try {
    const { correo } = req.body;
    const correoLower = correo.trim().toLowerCase();

    const usuario = await getUsuariosCollection().findOne({ correo: correoLower });
    if (!usuario) {
      // Por seguridad, no indicamos explícitamente si el correo no existe, 
      // o podemos devolver éxito falso simulado.
      // Pero para UX interna, a veces se prefiere avisar.
      // El usuario pidió: "si un correo no existe, puedes devolver un mensaje genérico por seguridad"
      return res.json({ 
        mensaje: "Si el correo existe, se ha enviado un enlace de recuperación." 
      });
    }

    // Generar token
    const token = crypto.randomBytes(20).toString('hex');
    const expiracion = new Date(Date.now() + 3600000); // 1 hora

    // Guardar en DB
    await getUsuariosCollection().updateOne(
      { correo: correoLower },
      { 
        $set: { 
          resetPasswordToken: token,
          resetPasswordExpires: expiracion
        } 
      }
    );

    // Enviar correo
    const resetUrl = `${FRONTEND_URL}/reset-password/${token}`;

    const { data, error } = await resend.emails.send({
      from: 'Soporte <onboarding@resend.dev>', // O el dominio verificado del usuario si tiene uno
      to: [correoLower],
      subject: 'Recuperación de Contraseña - Cartera Betsupplier',
      html: `
        <div style="font-family: Arial, sans-serif; color: #333;">
          <h2>Recuperación de Contraseña</h2>
          <p>Hola ${usuario.nombre || 'Usuario'},</p>
          <p>Has solicitado restablecer tu contraseña. Haz clic en el siguiente enlace para continuar:</p>
          <p>
            <a href="${resetUrl}" style="background-color: #00bcd4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Restablecer Contraseña</a>
          </p>
          <p>O copia y pega este enlace en tu navegador:</p>
          <p>${resetUrl}</p>
          <p>Este enlace expirará en 1 hora.</p>
          <p>Si no solicitaste esto, ignora este correo.</p>
        </div>
      `
    });

    if (error) {
      console.error("Error enviando correo Resend:", error);
      return res.status(500).json({ detail: "Error al enviar el correo de recuperación." });
    }

    res.json({ mensaje: "Si el correo existe, se ha enviado un enlace de recuperación." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ detail: `Error: ${err.message}` });
  }
});

// === RESTABLECER CONTRASEÑA ===
router.post("/reset-password/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const usuario = await getUsuariosCollection().findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!usuario) {
      return res.status(400).json({ detail: "El enlace es inválido o ha expirado." });
    }

    // Hashear nueva contraseña
    const hashed = await bcrypt.hash(password, 10);

    // Actualizar usuario y limpiar campos de reset
    await getUsuariosCollection().updateOne(
      { _id: usuario._id },
      {
        $set: { password: hashed },
        $unset: { resetPasswordToken: "", resetPasswordExpires: "" }
      }
    );

    res.json({ mensaje: "✅ Contraseña actualizada correctamente. Ahora puedes iniciar sesión." });

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
    if (existente)
      return res
        .status(400)
        .json({ detail: "❌ El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);

    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: [],
    };

    await getUsuariosCollection().insertOne(nuevo);
    res.json({
      mensaje:
        "✅ Usuario creado exitosamente (pendiente asignar permisos por el administrador)",
    });
  } catch (err) {
    res.status(500).json({ detail: `Error: ${err.message}` });
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

    const fechaLogin = new Date();
    await getUsuariosCollection().updateOne(
      { correo: correoLower },
      {
        $set: {
          ultimo_login: fechaLogin,
        },
      },
    );

    const expira = Math.floor(Date.now() / 1000) + 30 * 60; 
    const token = jwt.sign(
      { correo: user.correo, rol: user.rol, exp: expira },
      SECRET_KEY,
    );

    res.json({
      token,
      nombre: user.nombre,
      rol: user.rol,
    });
  } catch (err) {
    res.status(500).json({ detail: `Error: ${err.message}` });
  }
});

// === PERFIL ===
router.get("/perfil", obtenerUsuarioActual, (req, res) => {
  const usuario = req.usuario;
  res.json({
    mensaje: `Bienvenido ${usuario.nombre}, este es tu perfil`,
    vendedores_asociados: usuario.vendedores_asociados || [],
  });
});

// === LISTAR USUARIOS ===
router.get("/todos", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  const usuarios = await getUsuariosCollection()
    .find({}, { projection: { password: 0 } })
    .toArray();
  res.json({ usuarios });
});

// === CREAR USUARIO (ADMIN) ===
router.post("/crear", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const {
      correo,
      password,
      nombre,
      rol,
      vendedores_asociados = [],
      clientes_asociados = [],
    } = req.body;

    const correoLower = correo.trim().toLowerCase();

    if (await getUsuariosCollection().findOne({ correo: correoLower })) {
      return res
        .status(400)
        .json({ detail: "❌ El correo ya está registrado" });
    }

    // Lógica mejorada: busca el nombre real en base_conocimiento
    const clientesNormalizados = await Promise.all(clientes_asociados.map(async (c) => {
      const nit = (typeof c === "object" ? c.nit : c).toString().trim();
      const nombreReal = await buscarNombreCliente(nit);
      return {
        nit: nit,
        nombre: nombreReal
      };
    }));

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: vendedores_asociados.map((v) =>
        v.trim().toLowerCase(),
      ),
      clientes_asociados: clientesNormalizados,
    };

    await getUsuariosCollection().insertOne(nuevo);
    res.json({
      mensaje: `✅ Usuario '${nombre.trim().toUpperCase()}' creado correctamente`,
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// === ACTUALIZAR USUARIO ===
router.put(
  "/actualizar/:correo",
  obtenerUsuarioActual,
  soloAdmin,
  async (req, res) => {
    try {
      const correo = req.params.correo.trim().toLowerCase();
      const existente = await getUsuariosCollection().findOne({ correo });

      if (!existente)
        return res
          .status(404)
          .json({ detail: `❌ Usuario con correo '${correo}' no encontrado` });

      const {
        nombre,
        rol,
        password,
        vendedores_asociados,
        clientes_asociados,
      } = req.body;
      const updateDoc = {};

      if (nombre) updateDoc.nombre = nombre.trim().toUpperCase();
      if (rol) updateDoc.rol = rol.trim();
      if (password) updateDoc.password = await bcrypt.hash(password, 10);
      if (vendedores_asociados)
        updateDoc.vendedores_asociados = vendedores_asociados.map((v) =>
          v.trim().toLowerCase(),
        );
      
      if (clientes_asociados) {
        // Lógica mejorada: busca el nombre real en base_conocimiento
        updateDoc.clientes_asociados = await Promise.all(clientes_asociados.map(async (c) => {
          const nit = (typeof c === "object" ? c.nit : c).toString().trim();
          const nombreReal = await buscarNombreCliente(nit);
          return {
            nit: nit,
            nombre: nombreReal
          };
        }));
      }

      await getUsuariosCollection().updateOne({ correo }, { $set: updateDoc });

      const actualizado = await getUsuariosCollection().findOne(
        { correo },
        { projection: { password: 0 } },
      );

      res.json({
        mensaje: `✅ Usuario '${correo}' actualizado correctamente`,
        usuario: actualizado,
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  },
);

// === ACTUALIZAR CLIENTES ASOCIADOS ===
router.put(
  "/:correo/clientes_asociados",
  obtenerUsuarioActual,
  soloAdmin,
  async (req, res) => {
    try {
      const correo = req.params.correo.trim().toLowerCase();
      const { clientes_asociados } = req.body;

      if (!Array.isArray(clientes_asociados)) {
        return res
          .status(400)
          .json({ detail: "clientes_asociados debe ser un array" });
      }

      // Lógica mejorada: busca el nombre real en base_conocimiento
      const clientesNormalizados = await Promise.all(clientes_asociados.map(async (c) => {
        const nit = (typeof c === "object" ? c.nit : c).toString().trim();
        const nombreReal = await buscarNombreCliente(nit);
        return {
          nit: nit,
          nombre: nombreReal
        };
      }));

      const updateDoc = {
        clientes_asociados: clientesNormalizados,
      };

      await getUsuariosCollection().updateOne({ correo }, { $set: updateDoc });

      res.json({
        mensaje: `✅ Clientes asociados actualizados para '${correo}'`,
        clientes_asociados: updateDoc.clientes_asociados,
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  },
);

// === ELIMINAR USUARIO ===
router.delete(
  "/eliminar/:correo",
  obtenerUsuarioActual,
  soloAdmin,
  async (req, res) => {
    const correo = req.params.correo.trim().toLowerCase();
    const result = await getUsuariosCollection().deleteOne({ correo });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ detail: `❌ Usuario con correo '${correo}' no encontrado` });
    }

    res.json({
      mensaje: `🗑️ Usuario con correo '${correo}' eliminado correctamente`,
    });
  },
);

export default router;