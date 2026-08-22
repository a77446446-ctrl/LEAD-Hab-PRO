const { Client } = require('pg');
require('dotenv').config();

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to DB via Pooler (6543)...');
    await client.connect();
    console.log('Connected to DB');
    
    await client.query('ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "sourceChat" TEXT');
    console.log('Column sourceChat added to Lead table');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
