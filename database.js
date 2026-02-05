// database.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URL || process.env.MONGO_URI;
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
export default db; // Deprecated: Use getDb() instead



