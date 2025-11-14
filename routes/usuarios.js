import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../database.js";
import { obtenerUsuarioActual, soloAdmin } from "../utils/auth_utils.js";

dotenv.config();

const router = express.Router();
const SECRET_KEY = process.env.SECRET_KEY;
const usuariosCollection = db.collection("usuarios");

// === REGISTRO ===
router.post("/registro", async (req, res) => {
  try {
    const { correo, password, nombre, rol } = req.body;
    const correoLower = correo.trim().toLowerCase();

    const existente = await usuariosCollection.findOne({ correo: correoLower });
    if (existente)
      return res.status(400).json({ detail: "❌ El correo ya está registrado" });

    const hashed = await bcrypt.hash(password, 10);

    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: [],
    };

    await usuariosCollection.insertOne(nuevo);
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

    const user = await usuariosCollection.findOne({ correo: correoLower });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ detail: "❌ Credenciales inválidas" });
    }

    const expira = Math.floor(Date.now() / 1000) + 6 * 60 * 60; // 6 horas
    const token = jwt.sign(
      { correo: user.correo, rol: user.rol, exp: expira },
      SECRET_KEY
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
  const usuarios = await usuariosCollection
    .find({}, { projection: { password: 0 } })
    .toArray();
  res.json({ usuarios });
});

// === CREAR USUARIO (ADMIN) ===
router.post("/crear", obtenerUsuarioActual, soloAdmin, async (req, res) => {
  try {
    const { correo, password, nombre, rol, vendedores_asociados = [] } =
      req.body;

    const correoLower = correo.trim().toLowerCase();

    if (await usuariosCollection.findOne({ correo: correoLower })) {
      return res.status(400).json({ detail: "❌ El correo ya está registrado" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const nuevo = {
      correo: correoLower,
      password: hashed,
      nombre: nombre.trim().toUpperCase(),
      rol: rol?.trim() || "vendedor",
      vendedores_asociados: vendedores_asociados.map((v) =>
        v.trim().toLowerCase()
      ),
    };

    await usuariosCollection.insertOne(nuevo);
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
      const existente = await usuariosCollection.findOne({ correo });

      if (!existente)
        return res
          .status(404)
          .json({ detail: `❌ Usuario con correo '${correo}' no encontrado` });

      const { nombre, rol, password, vendedores_asociados } = req.body;
      const updateDoc = {};

      if (nombre) updateDoc.nombre = nombre.trim().toUpperCase();
      if (rol) updateDoc.rol = rol.trim();
      if (password) updateDoc.password = await bcrypt.hash(password, 10);
      if (vendedores_asociados)
        updateDoc.vendedores_asociados = vendedores_asociados.map((v) =>
          v.trim().toLowerCase()
        );

      await usuariosCollection.updateOne({ correo }, { $set: updateDoc });

      const actualizado = await usuariosCollection.findOne(
        { correo },
        { projection: { password: 0 } }
      );

      res.json({
        mensaje: `✅ Usuario '${correo}' actualizado correctamente`,
        usuario: actualizado,
      });
    } catch (err) {
      res.status(500).json({ detail: err.message });
    }
  }
);

// === ELIMINAR USUARIO ===
router.delete(
  "/eliminar/:correo",
  obtenerUsuarioActual,
  soloAdmin,
  async (req, res) => {
    const correo = req.params.correo.trim().toLowerCase();
    const result = await usuariosCollection.deleteOne({ correo });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ detail: `❌ Usuario con correo '${correo}' no encontrado` });
    }

    res.json({
      mensaje: `🗑️ Usuario con correo '${correo}' eliminado correctamente`,
    });
  }
);

export default router;
