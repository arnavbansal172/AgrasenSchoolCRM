/**
 * backend/db/seed.js
 * 
 * Database Seeder — Run ONCE after schema.sql to populate initial data.
 * This creates the super admin account, GR counters, and default fee structure.
 * 
 * Usage: node backend/db/seed.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'savm_erp',
  user: process.env.DB_USER || 'savm_user',
  password: process.env.DB_PASSWORD,
});

const GRADES = ['KG1', 'KG2', 'Balvatica', '1', '2', '3', '4', '5', '6', '7', '8'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('\n🌱 SAVM ERP — Database Seeder');
    console.log('══════════════════════════════');

    await client.query('BEGIN');

    // ── 1. GR Number Counters ────────────────────────────────────────────────
    // KG series starts at 100 (so first student is S101)
    // Std series starts at 0 (so first student is 1)
    const counterCheck = await client.query('SELECT COUNT(*) FROM gr_no_counters');
    if (parseInt(counterCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO gr_no_counters (id, counter) VALUES
          ('kg', 100),
          ('std', 0)
        ON CONFLICT (id) DO NOTHING
      `);
      console.log('✓ GR counters initialized (KG: starts at S101, Std: starts at 1)');
    } else {
      console.log('→ GR counters already exist, skipping.');
    }

    // ── 2. Default Fee Structure ─────────────────────────────────────────────
    const feeCheck = await client.query('SELECT COUNT(*) FROM fee_structure');
    if (parseInt(feeCheck.rows[0].count) === 0) {
      for (const grade of GRADES) {
        const isKg = grade === 'KG1' || grade === 'KG2';
        await client.query(`
          INSERT INTO fee_structure (grade, admission_fee, monthly_fee, exam_fee)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (grade) DO NOTHING
        `, [grade, 500, isKg ? 300 : 400, 150]);
      }
      console.log('✓ Default fee structure seeded for all 11 grades');
    } else {
      console.log('→ Fee structure already exists, skipping.');
    }

    // ── 3. Super Admin Account ───────────────────────────────────────────────
    const SUPER_ADMIN_LOGIN = 'superadmin';
    const SUPER_ADMIN_PASSWORD = 'Admin@2026';  // ⚠️ Change this after first login!
    
    const adminCheck = await client.query(
      'SELECT COUNT(*) FROM staff_users WHERE role = $1', ['super_admin']
    );
    if (parseInt(adminCheck.rows[0].count) === 0) {
      const hash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 12);
      await client.query(`
        INSERT INTO staff_users (login_id, password_hash, name, role)
        VALUES ($1, $2, $3, $4)
      `, [SUPER_ADMIN_LOGIN, hash, 'Master Administrator', 'super_admin']);
      
      console.log('✓ Super Admin account created:');
      console.log(`    Login ID : ${SUPER_ADMIN_LOGIN}`);
      console.log(`    Password : ${SUPER_ADMIN_PASSWORD}`);
      console.log('    ⚠️  CHANGE THIS PASSWORD AFTER FIRST LOGIN!');
    } else {
      console.log('→ Super Admin already exists, skipping.');
    }

    // ── 4. Default Admin Account ─────────────────────────────────────────────
    const ADMIN_LOGIN = 'admin';
    const ADMIN_PASSWORD = 'Admin123';
    const adminAccCheck = await client.query(
      'SELECT COUNT(*) FROM staff_users WHERE login_id = $1', ['admin']
    );
    if (parseInt(adminAccCheck.rows[0].count) === 0) {
      const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
      await client.query(`
        INSERT INTO staff_users (login_id, password_hash, name, role)
        VALUES ($1, $2, $3, $4)
      `, [ADMIN_LOGIN, hash, 'School Admin', 'admin']);
      console.log(`✓ Admin account created (login: ${ADMIN_LOGIN} / pass: ${ADMIN_PASSWORD})`);
    }

    await client.query('COMMIT');

    console.log('\n✅ Seeding complete! You can now log in.');
    console.log('══════════════════════════════\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
