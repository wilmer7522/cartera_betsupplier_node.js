import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import usuariosRouter from "./routes/usuarios.js";
import excelRouter from "./routes/excel.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ mensaje: "Servidor Express funcionando 🚀" });
});

// Rutas
app.use("/usuarios", usuariosRouter);
app.use("/excel", excelRouter);

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`✅ Servidor escuchando en puerto ${PORT}`));
