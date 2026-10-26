const pool = require("./config/db");

const query = `
  SELECT current_database() AS database_name, NOW() AS server_time;
`;

async function testDatabaseConnection() {
  try {
    const { rows } = await pool.query(query);
    console.log(
      `PostgreSQL connection successful. Database: ${rows[0].database_name}`,
    );
  } catch (error) {
    console.error(`PostgreSQL connection failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

testDatabaseConnection();
