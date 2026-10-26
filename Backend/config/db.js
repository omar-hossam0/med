const path = require("path");
const dotenv = require("dotenv");
const { Pool } = require("pg");

// Load .env from the Backend directory, or from process.cwd() as fallback
dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  database: process.env.DB_NAME || "medora_db",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
