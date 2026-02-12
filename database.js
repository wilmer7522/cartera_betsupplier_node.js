// database.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

// Cambiamos localhost por 127.0.0.1 para evitar problemas de resolución de DNS
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/cartera_db";

const client = new MongoClient(MONGO_URI);
let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("cartera_db");
    console.log("✅ Conexión exitosa con MongoDB");
    return db;
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error);
    process.exit(1);
  }
}

function getDb() {
    if (!db) {
        throw new Error("Base de datos no inicializada. Llame a connectDB primero.");
    }
    return db;
}

export { connectDB, getDb, client };



