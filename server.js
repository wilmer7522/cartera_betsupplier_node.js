import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usuariosRouter from "./routes/usuarios.js";
import excelRouter from "./routes/excel.js";
import wompiRouter from "./routes/wompi.js";
import pagosRouter from "./routes/pagos.js";
import { connectDB } from "./database.js";

dotenv.config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin origen (como Postman)
      if (!origin) return callback(null, true);

      // Permitir explícitamente localhost
      if (allowedOrigins.indexOf(origin) !== -1) {
        return callback(null, true);
      }
      
      // 🔥 Permitir cualquier subdominio de ngrok dinámicamente
      if (origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io')) {
        return callback(null, true);
      }

      console.warn("Bloqueado por CORS:", origin);
      callback(new Error("No permitido por CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Ruta de verificación
app.get("/", (req, res) => {
  res.json({
    mensaje: "Servidor Express funcionando 🚀",
    entorno: process.env.NODE_ENV || "DESARROLLO LOCAL",
    timestamp: new Date().toISOString(),
  });
});

// Rutas de la API
app.use("/usuarios", usuariosRouter);
app.use("/excel", excelRouter);
app.use("/wompi", wompiRouter);
app.use("/pagos", pagosRouter);
app.use("/", pagosRouter); // Para exponer la ruta /events del webhook en la raíz


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


// ... (Configuración de puerto y arranque)


const PORT = process.env.PORT || 8000;

// Iniciar servidor solo después de conectar a BD
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ Servidor Express funcionando en puerto ${PORT}`);
    console.log(`✅ MODO: ${process.env.NODE_ENV || "DESARROLLO LOCAL"}`);
    console.log(`✅ CORS configurado para desarrollo local`);
  });
});
