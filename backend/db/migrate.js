/**
 * backend/db/migrate.js
 * 
 * One-time migration from old JSON master_db.json → PostgreSQL.
 * Run this ONLY if you have existing data in master_db.json.
 * 
 * Usage: node backend/db/migrate.js
 */

require('dotenv').config({ path: __dirname + '/../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'savm_erp',
  user: process.env.DB_USER || 'savm_user',
  password: process.env.DB_PASSWORD,
});

const OLD_DB_FILE = path.join(__dirname, '../data/master_db.json');

async function migrate() {
  if (!fs.existsSync(OLD_DB_FILE)) {
    console.log('ℹ️  No master_db.json found. Nothing to migrate. Run seed.js instead.');
    await pool.end();
    return;
  }

  let oldData;
  try {
    oldData = JSON.parse(fs.readFileSync(OLD_DB_FILE, 'utf-8'));
  } catch (err) {
    console.error('❌ Failed to read master_db.json:', err.message);
    process.exit(1);
  }

  console.log('\n🔄 SAVM ERP — JSON → PostgreSQL Migration');
  console.log('══════════════════════════════════════════');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Migrate GR Counters ───────────────────────────────────────────────
    if (oldData.grNoCounters) {
      const counters = Object.values(oldData.grNoCounters);
      for (const c of counters) {
        if (c.id && c.counter !== undefined) {
          await client.query(`
            INSERT INTO gr_no_counters (id, counter) VALUES ($1, $2)
            ON CONFLICT (id) DO UPDATE SET counter = GREATEST(gr_no_counters.counter, $2)
          `, [c.id, c.counter]);
        }
      }
      console.log(`✓ GR counters migrated`);
    }

    // ── Migrate Teachers ──────────────────────────────────────────────────
    const teacherIdMap = {}; // old Dexie id -> new pg id
    if (oldData.teachers) {
      const teachers = Object.values(oldData.teachers);
      for (const t of teachers) {
        const result = await client.query(`
          INSERT INTO teachers (employee_id, name, subject, assigned_grade, phone, base_pay, status, face_enrolled, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT DO NOTHING
          RETURNING id
        `, [
          t.employeeId || null,
          t.name || 'Unknown Teacher',
          t.subject || null,
          t.assignedGrade || null,
          t.phone || null,
          parseInt(t.basePay) || 0,
          t.status || 'Active',
          t.faceEnrolled || false,
          t.createdAt || new Date().toISOString()
        ]);
        if (result.rows[0]) {
          teacherIdMap[t.id] = result.rows[0].id;
        }
      }
      console.log(`✓ ${teachers.length} teachers migrated`);
    }

    // ── Migrate Students ──────────────────────────────────────────────────
    const studentIdMap = {}; // old Dexie id -> new pg id
    if (oldData.students) {
      const students = Object.values(oldData.students);
      for (const s of students) {
        const result = await client.query(`
          INSERT INTO students (gr_no, name, grade, parent_name, phone, dob, admission_status, created_at, activated_at, lc_date, lc_reason)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (gr_no) DO NOTHING
          RETURNING id
        `, [
          s.grNo || null,
          s.name || 'Unknown Student',
          s.grade || 'KG1',
          s.parentName || null,
          s.phone || null,
          s.dob || null,
          s.admissionStatus || 'New Admission',
          s.createdAt || new Date().toISOString(),
          s.activatedAt || null,
          s.lcDate || null,
          s.lcReason || null
        ]);
        if (result.rows[0]) {
          studentIdMap[s.id] = result.rows[0].id;
        } else {
          // Student already exists (duplicate gr_no), find by gr_no
          if (s.grNo) {
            const existing = await client.query('SELECT id FROM students WHERE gr_no = $1', [s.grNo]);
            if (existing.rows[0]) studentIdMap[s.id] = existing.rows[0].id;
          }
        }
      }
      console.log(`✓ ${students.length} students migrated`);
    }

    // ── Migrate Fee Structure ─────────────────────────────────────────────
    if (oldData.feeStructure) {
      const fees = Object.values(oldData.feeStructure);
      for (const f of fees) {
        if (f.grade) {
          await client.query(`
            INSERT INTO fee_structure (grade, admission_fee, monthly_fee, exam_fee)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (grade) DO UPDATE
              SET admission_fee = $2, monthly_fee = $3, exam_fee = $4
          `, [f.grade, f.admissionFee || 500, f.monthlyFee || 400, f.examFee || 150]);
        }
      }
      console.log(`✓ Fee structure migrated`);
    }

    // ── Migrate Fee Payments ──────────────────────────────────────────────
    if (oldData.feePayments) {
      const payments = Object.values(oldData.feePayments);
      let migrated = 0;
      for (const fp of payments) {
        const newStudentId = studentIdMap[fp.studentId];
        if (!newStudentId) continue;
        await client.query(`
          INSERT INTO fee_payments (student_id, fee_type, amount, method, date, receipt_no, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT DO NOTHING
        `, [
          newStudentId,
          fp.feeType || 'Monthly',
          parseInt(fp.amount) || 0,
          fp.method || 'Cash',
          fp.date || new Date().toISOString().split('T')[0],
          fp.receiptNo || null,
          fp.createdAt || new Date().toISOString()
        ]);
        migrated++;
      }
      console.log(`✓ ${migrated} fee payments migrated`);
    }

    // ── Migrate Teacher Attendance ────────────────────────────────────────
    if (oldData.teacherAttendance) {
      const records = Object.values(oldData.teacherAttendance);
      let migrated = 0;
      for (const r of records) {
        const newTeacherId = teacherIdMap[r.teacherId];
        if (!newTeacherId) continue;
        await client.query(`
          INSERT INTO teacher_attendance (teacher_id, date, status, method, timestamp)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (teacher_id, date) DO NOTHING
        `, [
          newTeacherId,
          r.date || new Date().toISOString().split('T')[0],
          r.status || 'Present',
          r.method || 'Manual',
          r.timestamp || new Date().toISOString()
        ]);
        migrated++;
      }
      console.log(`✓ ${migrated} teacher attendance records migrated`);
    }

    // ── Migrate Student Attendance ────────────────────────────────────────
    if (oldData.attendance) {
      const records = Object.values(oldData.attendance);
      let migrated = 0;
      for (const r of records) {
        const newStudentId = studentIdMap[r.studentId];
        if (!newStudentId) continue;
        try {
          await client.query(`
            INSERT INTO attendance (student_id, grade, date, status, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (student_id, date) DO NOTHING
          `, [
            newStudentId,
            r.grade || 'KG1',
            r.date || new Date().toISOString().split('T')[0],
            r.status || 'Present',
            r.createdAt || new Date().toISOString()
          ]);
          migrated++;
        } catch { /* skip conflicts */ }
      }
      console.log(`✓ ${migrated} student attendance records migrated`);
    }

    // ── Migrate Notices ───────────────────────────────────────────────────
    if (oldData.notices) {
      const records = Object.values(oldData.notices);
      for (const r of records) {
        await client.query(`
          INSERT INTO notices (title, body, posted_by, posted_at, pinned)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          r.title || 'Notice',
          r.body || '',
          r.postedBy || 'Admin',
          r.postedAt || new Date().toISOString(),
          r.pinned || false
        ]);
      }
      console.log(`✓ ${records.length} notices migrated`);
    }

    // ── Migrate Events ────────────────────────────────────────────────────
    if (oldData.events) {
      const records = Object.values(oldData.events);
      for (const r of records) {
        await client.query(`
          INSERT INTO events (date, title, description)
          VALUES ($1, $2, $3)
        `, [r.date, r.title || 'Event', r.description || null]);
      }
      console.log(`✓ ${records.length} events migrated`);
    }

    // ── Migrate Results ───────────────────────────────────────────────────
    if (oldData.results) {
      const records = Object.values(oldData.results);
      let migrated = 0;
      for (const r of records) {
        const newStudentId = studentIdMap[r.studentId];
        if (!newStudentId) continue;
        await client.query(`
          INSERT INTO results (student_id, grade, term, subjects, total, date)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (student_id, term, grade) DO NOTHING
        `, [
          newStudentId,
          r.grade || 'KG1',
          r.term || 'Term 1',
          JSON.stringify(r.subjects || []),
          r.total || 0,
          r.date || new Date().toISOString().split('T')[0]
        ]);
        migrated++;
      }
      console.log(`✓ ${migrated} result records migrated`);
    }

    await client.query('COMMIT');
    console.log('\n✅ Migration complete! All data is now in PostgreSQL.');
    console.log('   Run seed.js next to create admin accounts.\n');
    console.log('══════════════════════════════════════════\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
