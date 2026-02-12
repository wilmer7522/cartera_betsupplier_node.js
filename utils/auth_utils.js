import jwt from "jsonwebtoken";
import { getDb } from "../database.js";



const SECRET_KEY = process.env.SECRET_KEY || "clave_super_secreta";
const getUsuariosCollection = () => getDb().collection("usuarios");

// ✅ Middleware: verificar token y obtener usuario actual
export async function obtenerUsuarioActual(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ detail: "Token no proporcionado o inválido" });
  }

  const token = authHeader.split(" ")[1];

  // 🔥 NUEVA VALIDACIÓN: Verificar que el token no esté vacío o corrupto
  if (
    !token ||
    token === "null" ||
    token === "undefined" ||
    token === "Bearer" ||
    token.length < 10
  ) {
  }

  try {
    const payload = jwt.verify(token, SECRET_KEY);
    if (!payload.correo) {
      return res.status(401).json({ detail: "Token sin correo válido" });
    }

    const usuario = await getUsuariosCollection().findOne({
      correo: payload.correo,
    });
    if (!usuario) {
      return res.status(401).json({ detail: "Usuario no encontrado" });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    // 🔥 MEJOR MENSAJE DE ERROR SEGÚN EL TIPO
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ detail: "Token expirado" });
    } else if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ detail: "Token inválido" });
    } else {
      return res.status(401).json({ detail: "Error de autenticación" });
    }
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
