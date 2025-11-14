import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import db from "../database.js";

dotenv.config();

const SECRET_KEY = process.env.SECRET_KEY || "clave_super_secreta";
const usuariosCollection = db.collection("usuarios");

// ✅ Middleware: verificar token y obtener usuario actual
export async function obtenerUsuarioActual(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Token no proporcionado o inválido" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = jwt.verify(token, SECRET_KEY);
    if (!payload.correo) {
      return res.status(401).json({ detail: "Token sin correo válido" });
    }

    const usuario = await usuariosCollection.findOne({ correo: payload.correo });
    if (!usuario) {
      return res.status(401).json({ detail: "Usuario no encontrado" });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    console.error("❌ Error verificando token:", error.message);
    return res.status(401).json({ detail: "Token inválido o expirado" });
  }
}

// ✅ Middleware: restringir acceso solo a administradores
export function soloAdmin(req, res, next) {
  if (!req.usuario || req.usuario.rol !== "admin") {
    return res
      .status(403)
      .json({ detail: "Solo el administrador puede realizar esta acción" });
  }
  next();
}
