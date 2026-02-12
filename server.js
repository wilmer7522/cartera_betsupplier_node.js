import dotenv from "dotenv";
dotenv.config(); // PRIMERO: Cargar variables de entorno
import express from "express";
import cors from "cors";
import usuariosRouter from "./routes/usuarios.js";
import excelRouter from "./routes/excel.js";
import wompiRouter from "./routes/wompi.js";
import pagosRouter from "./routes/pagos.js";
import { connectDB } from "./database.js";

dotenv.config();

const app = express();

// Configuración de Orígenes Permitidos
const defaultOrigins = [
  "https://portal.betsupplier.co",
  "http://portal.betsupplier.co",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(",") 
  : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      // Permitir solicitudes sin origen (como Postman o apps móviles)
      if (!origin) return callback(null, true);

      // Verificar si el origen está en nuestra lista blanca
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Permitir subdominios de ngrok solo en desarrollo
      if (process.env.NODE_ENV !== "production") {
        if (origin.endsWith('.ngrok-free.app') || origin.endsWith('.ngrok.io')) {
          return callback(null, true);
        }
      }

      // Si llegamos aquí, el origen no está permitido
      console.error(`❌ CORS Bloqueado para el origen: ${origin}`);
      return callback(new Error("Origen no permitido por CORS"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

app.use(express.json({ limit: "50mb" }));

// Rutas
app.use("/usuarios", usuariosRouter);
app.use("/excel", excelRouter);
app.use("/wompi", wompiRouter);
app.use("/pagos", pagosRouter);

// Conexión a DB y arranque
const PORT = process.env.PORT || 8000;

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`✅ Servidor funcionando en puerto ${PORT}`);
      console.log(`✅ MODO: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error("❌ No se pudo iniciar el servidor:", error);
    process.exit(1);
  }
};

startServer();
