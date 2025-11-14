// database.js
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
const client = new MongoClient(MONGO_URI);

await client.connect();

const db = client.db("cartera_db"); // usa el nombre de tu base
console.log("✅ Conexión exitosa con MongoDB");

export default db;

