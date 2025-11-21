/*import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usuariosRouter from "./routes/usuarios.js";
import excelRouter from "./routes/excel.js";

dotenv.config();

const app = express();

// Configuración CORS para producción
app.use(cors({
  origin: [
    "http://portal.betsupplier.co",
    "http://72.61.8.153", 
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ruta de verificación
app.get("/", (req, res) => {
  res.json({ 
    mensaje: "Servidor Express funcionando 🚀",
    entorno: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString()
  });
});

// Rutas de la API
app.use("/usuarios", usuariosRouter);
app.use("/excel", excelRouter);

// Manejo de rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({ 
    error: "Ruta no encontrada",
    path: req.originalUrl 
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("Error del servidor:", err);
  res.status(500).json({ 
    error: "Error interno del servidor",
    detalle: process.env.NODE_ENV === "production" ? null : err.message
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`✅ Servidor Express funcionando en puerto ${PORT}`);
  console.log(`✅ Entorno: ${process.env.NODE_ENV || "development"}`);
  console.log(`✅ CORS configurado para producción`);
  console.log(`✅ MongoDB: ${process.env.MONGO_URI ? "Conectado" : "Configurar URI"}`);
});*/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usuariosRouter from "./routes/usuarios.js";
import excelRouter from "./routes/excel.js";

dotenv.config();

const app = express();

// ==============================
// 🚀 CONFIGURACIÓN PARA PRODUCCIÓN (ACTUAL)
// ==============================
/*
app.use(cors({
  origin: [
    "http://portal.betsupplier.co",
    "http://72.61.8.153", 
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));*/

// ==============================
// 💻 CONFIGURACIÓN PARA DESARROLLO LOCAL (COMENTADA)
// ==============================

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ruta de verificación
app.get("/", (req, res) => {
  res.json({
    mensaje: "Servidor Express funcionando 🚀",
    entorno: "PRODUCCIÓN", // Cambiar a "DESARROLLO" cuando trabajes local
    timestamp: new Date().toISOString(),
  });
});

// Rutas de la API
app.use("/usuarios", usuariosRouter);
app.use("/excel", excelRouter);

// Manejo de rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Ruta no encontrada",
    path: req.originalUrl,
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error("Error del servidor:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    detalle: process.env.NODE_ENV === "production" ? null : err.message,
  });
});

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`✅ Servidor Express funcionando en puerto ${PORT}`);
  console.log(`✅ MODO: PRODUCCIÓN`); // Cambiar a "DESARROLLO" cuando trabajes local
  console.log(`✅ CORS configurado para producción`);
  console.log(
    `✅ MongoDB: ${process.env.MONGO_URI ? "Conectado" : "Configurar URI"}`
  );
});
