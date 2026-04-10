/**
 * backend/db/schema-run.js
 * 
 * Utility to apply schema.sql to the PostgreSQL database.
 * Usage: node backend/db/schema-run.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'savm_erp',
  user: process.env.DB_USER || 'savm_user',
  password: process.env.DB_PASSWORD,
});

async function runSchema() {
  const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  const client = await pool.connect();
  try {
    console.log('\n📦 Applying database schema...');
    await client.query(schemaSQL);
    console.log('✅ Schema applied successfully!\n');
  } catch (err) {
    console.error('❌ Schema error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runSchema();
