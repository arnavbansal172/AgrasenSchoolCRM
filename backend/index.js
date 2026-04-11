/**
 * backend/index.js
 * 
 * SAVM ERP — Main API Server (v2.0 — PostgreSQL Edition)
 * Shri Agrasen Vidya Mandir
 * 
 * Architecture:
 * - All data lives in PostgreSQL (not JSON files)
 * - JWT-based authentication with 4 roles
 * - Full REST API for all school modules
 * - Face descriptor storage/retrieval for biometric attendance
 */

require('dotenv').config({ path: __dirname + '/.env' });

const express  = require('express');
const cors     = require('cors');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const { Pool } = require('pg');
const path     = require('path');
const fs       = require('fs');
const http     = require('http');
const https    = require('https');

const app        = express();
const PORT       = parseInt(process.env.PORT) || 3002;
const PORT_HTTPS = parseInt(process.env.PORT_HTTPS) || 3443;
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_dev_secret_change_in_production';

// ── DATABASE CONNECTION ─────────────────────────────────────────────────────
const pool = new Pool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'savm_erp',
  user:     process.env.DB_USER || 'savm_user',
  password: process.env.DB_PASSWORD,
  max: 20,           // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

// ── MIDDLEWARE ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' })); // Allow face descriptors (JSON arrays)
app.use(express.urlencoded({ extended: true }));

// Serve built frontend in production (dist folder)
app.use(express.static(path.join(__dirname, '../dist')));

// ── JWT AUTH MIDDLEWARE ─────────────────────────────────────────────────────
const authenticate = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer <token>"

  if (!token) return res.status(401).json({ error: 'Access denied. No token.' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'Invalid or expired session. Please log in again.' });
  }
};

// Role-based middlewares
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role === 'super_admin') return next(); // Super admin bypasses all
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: `Access denied. Requires role: ${roles.join(' or ')}` });
  }
  next();
};

// ── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { loginId, password } = req.body;
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Login ID and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT id, login_id, password_hash, name, role, teacher_id, is_active FROM staff_users WHERE login_id = $1',
      [loginId.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid Login ID or Password.' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account disabled. Contact the administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid Login ID or Password.' });
    }

    // Update last login
    await pool.query('UPDATE staff_users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, loginId: user.login_id, name: user.name, role: user.role, teacherId: user.teacher_id },
      JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, role: user.role, loginId: user.login_id, teacherId: user.teacher_id }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login system error.' });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', authenticate, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters.' });
  }
  try {
    const result = await pool.query('SELECT password_hash FROM staff_users WHERE id = $1', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!match) return res.status(401).json({ error: 'Current password incorrect.' });
    const hash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE staff_users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STAFF USER MANAGEMENT (super_admin only)
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/users — list all staff users
app.get('/api/users', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT su.id, su.login_id, su.name, su.role, su.is_active, su.created_at, su.last_login,
             t.name AS teacher_name
      FROM staff_users su
      LEFT JOIN teachers t ON su.teacher_id = t.id
      ORDER BY su.role, su.name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — create new staff account
app.post('/api/users', authenticate, requireRole('super_admin'), async (req, res) => {
  const { loginId, password, name, role, teacherId } = req.body;
  if (!loginId || !password || !name || !role) {
    return res.status(400).json({ error: 'loginId, password, name, and role are required.' });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const result = await pool.query(`
      INSERT INTO staff_users (login_id, password_hash, name, role, teacher_id)
      VALUES ($1, $2, $3, $4, $5) RETURNING id, login_id, name, role
    `, [loginId.toLowerCase(), hash, name, role, teacherId || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Login ID already exists.' });
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id — update user (role, active status, reset password)
app.patch('/api/users/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  const { name, role, isActive, newPassword, teacherId } = req.body;
  try {
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      await pool.query('UPDATE staff_users SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
    }
    await pool.query(`
      UPDATE staff_users SET name = COALESCE($1, name), role = COALESCE($2, role),
        is_active = COALESCE($3, is_active), teacher_id = $4
      WHERE id = $5
    `, [name, role, isActive, teacherId || null, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', authenticate, requireRole('super_admin'), async (req, res) => {
  try {
    await pool.query('UPDATE staff_users SET is_active = FALSE WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// STUDENTS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/students', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/students', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { name, grade, parentName, phone, dob } = req.body;
  if (!name || !grade) return res.status(400).json({ error: 'name and grade are required.' });
  try {
    const result = await pool.query(`
      INSERT INTO students (name, grade, parent_name, phone, dob, admission_status)
      VALUES ($1, $2, $3, $4, $5, 'New Admission') RETURNING *
    `, [name.trim(), grade, parentName || null, phone || null, dob || null]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Activate student — generates GR number atomically
app.post('/api/students/:id/activate', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const student = await client.query('SELECT * FROM students WHERE id = $1 FOR UPDATE', [req.params.id]);
    if (student.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student not found.' }); }
    if (student.rows[0].gr_no) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Student already activated.', grNo: student.rows[0].gr_no }); }

    const grade = student.rows[0].grade;
    const isKg = grade === 'KG1' || grade === 'KG2';
    const series = isKg ? 'kg' : 'std';

    const grResult = await client.query('SELECT next_gr_number($1) AS gr_no', [series]);
    const grNo = grResult.rows[0].gr_no;

    const updated = await client.query(`
      UPDATE students SET gr_no = $1, admission_status = 'Active', activated_at = NOW()
      WHERE id = $2 RETURNING *
    `, [grNo, req.params.id]);

    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.patch('/api/students/:id', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { name, grade, parentName, phone, dob, admissionStatus, lcDate, lcReason } = req.body;
  try {
    const result = await pool.query(`
      UPDATE students SET
        name = COALESCE($1, name), grade = COALESCE($2, grade),
        parent_name = COALESCE($3, parent_name), phone = COALESCE($4, phone),
        dob = COALESCE($5, dob), admission_status = COALESCE($6, admission_status),
        lc_date = COALESCE($7, lc_date), lc_reason = COALESCE($8, lc_reason)
      WHERE id = $9 RETURNING *
    `, [name, grade, parentName, phone, dob, admissionStatus, lcDate, lcReason, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk promote students
app.post('/api/students/promote', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { fromGrade, toGrade } = req.body;
  if (!fromGrade || !toGrade) return res.status(400).json({ error: 'fromGrade and toGrade required.' });
  try {
    const result = await pool.query(`
      UPDATE students SET grade = $1
      WHERE grade = $2 AND admission_status = 'Active'
      RETURNING id
    `, [toGrade, fromGrade]);
    res.json({ promoted: result.rowCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEACHERS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/teachers', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers ORDER BY name');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/teachers', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { employeeId, name, subject, assignedGrade, phone, basePay, status } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required.' });
  try {
    const result = await pool.query(`
      INSERT INTO teachers (employee_id, name, subject, assigned_grade, phone, base_pay, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [employeeId || null, name.trim(), subject || null, assignedGrade || null, phone || null, parseInt(basePay) || 0, status || 'Active']);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/teachers/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { employeeId, name, subject, assignedGrade, phone, basePay, status } = req.body;
  try {
    const result = await pool.query(`
      UPDATE teachers SET
        employee_id = COALESCE($1, employee_id), name = COALESCE($2, name),
        subject = COALESCE($3, subject), assigned_grade = COALESCE($4, assigned_grade),
        phone = COALESCE($5, phone), base_pay = COALESCE($6, base_pay),
        status = COALESCE($7, status)
      WHERE id = $8 RETURNING *
    `, [employeeId, name, subject, assignedGrade, phone, parseInt(basePay) || null, status, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── FACE DESCRIPTOR ENDPOINTS ────────────────────────────────────────────
// POST /api/teachers/:id/face-enroll — Save face descriptor to DB
app.post('/api/teachers/:id/face-enroll', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { descriptor } = req.body; // Array of 128 floats from face-api.js
  if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
    return res.status(400).json({ error: 'Invalid face descriptor. Must be array of 128 floats.' });
  }
  try {
    const result = await pool.query(`
      UPDATE teachers SET face_descriptor = $1, face_enrolled = TRUE
      WHERE id = $2 RETURNING id, name, face_enrolled
    `, [JSON.stringify(descriptor), req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Teacher not found.' });
    res.json({ ok: true, teacher: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/teachers/face-descriptors — Get all enrolled descriptors for matching
app.get('/api/teachers/face-descriptors', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, employee_id, face_descriptor
      FROM teachers
      WHERE face_enrolled = TRUE AND status = 'Active' AND face_descriptor IS NOT NULL
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEACHER ATTENDANCE (Face-Scan)
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/teacher-attendance', authenticate, async (req, res) => {
  const { date, month, year } = req.query;
  try {
    let query = `
      SELECT ta.*, t.name AS teacher_name, t.employee_id, t.subject
      FROM teacher_attendance ta
      JOIN teachers t ON ta.teacher_id = t.id
    `;
    const params = [];
    if (date) { query += ` WHERE ta.date = $1`; params.push(date); }
    else if (month && year) { query += ` WHERE EXTRACT(MONTH FROM ta.date) = $1 AND EXTRACT(YEAR FROM ta.date) = $2`; params.push(month, year); }
    query += ` ORDER BY ta.timestamp DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/teacher-attendance — Log face-scan attendance
app.post('/api/teacher-attendance', authenticate, async (req, res) => {
  const { teacherId, date, status, method, matchScore } = req.body;
  if (!teacherId) return res.status(400).json({ error: 'teacherId required.' });
  const today = date || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      INSERT INTO teacher_attendance (teacher_id, date, status, method, match_score, marked_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (teacher_id, date) DO UPDATE
        SET status = EXCLUDED.status, method = EXCLUDED.method,
            match_score = EXCLUDED.match_score, timestamp = NOW()
      RETURNING *
    `, [teacherId, today, status || 'Present', method || 'Face Recognition', matchScore || null, req.user.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT ATTENDANCE
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/attendance', authenticate, async (req, res) => {
  const { date, grade } = req.query;
  try {
    let query = `SELECT a.*, s.name AS student_name, s.gr_no FROM attendance a JOIN students s ON a.student_id = s.id WHERE 1=1`;
    const params = [];
    if (date) { params.push(date); query += ` AND a.date = $${params.length}`; }
    if (grade) { params.push(grade); query += ` AND a.grade = $${params.length}`; }
    query += ' ORDER BY s.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance/bulk', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { records } = req.body; // [{studentId, grade, date, status}]
  if (!Array.isArray(records)) return res.status(400).json({ error: 'records array required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    let saved = 0;
    for (const r of records) {
      await client.query(`
        INSERT INTO attendance (student_id, grade, date, status, marked_by)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (student_id, date) DO UPDATE SET status = EXCLUDED.status
      `, [r.studentId, r.grade, r.date, r.status || 'Present', req.user.id]);
      saved++;
    }
    await client.query('COMMIT');
    res.json({ saved });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

app.get('/api/attendance-locks', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attendance_locks');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/attendance-locks', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { grade, date } = req.body;
  try {
    await pool.query(`
      INSERT INTO attendance_locks (grade, date, locked_by) VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [grade, date, req.user.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// FEES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/fee-structure', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM fee_structure ORDER BY grade');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/fee-structure/:grade', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { admissionFee, monthlyFee, examFee } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO fee_structure (grade, admission_fee, monthly_fee, exam_fee)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (grade) DO UPDATE SET admission_fee=$2, monthly_fee=$3, exam_fee=$4
      RETURNING *
    `, [req.params.grade, admissionFee || 0, monthlyFee || 0, examFee || 0]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/fee-payments', authenticate, async (req, res) => {
  const { studentId } = req.query;
  try {
    let query = 'SELECT fp.*, s.name AS student_name, s.gr_no FROM fee_payments fp JOIN students s ON fp.student_id = s.id';
    const params = [];
    if (studentId) { params.push(studentId); query += ' WHERE fp.student_id = $1'; }
    query += ' ORDER BY fp.date DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/fee-payments', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { studentId, feeType, amount, method, date, receiptNo, notes } = req.body;
  if (!studentId || !amount) return res.status(400).json({ error: 'studentId and amount required.' });
  try {
    const result = await pool.query(`
      INSERT INTO fee_payments (student_id, fee_type, amount, method, date, receipt_no, notes, recorded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *
    `, [studentId, feeType || 'Monthly', parseInt(amount), method || 'Cash',
        date || new Date().toISOString().split('T')[0], receiptNo || null, notes || null, req.user.id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SALARIES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/salaries', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { month, year } = req.query;
  try {
    let query = `SELECT s.*, t.name AS teacher_name, t.base_pay FROM salaries s JOIN teachers t ON s.teacher_id = t.id WHERE 1=1`;
    const params = [];
    if (month) { params.push(month); query += ` AND s.month = $${params.length}`; }
    if (year) { params.push(year); query += ` AND s.year = $${params.length}`; }
    query += ' ORDER BY t.name';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salaries', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { teacherId, month, year, daysWorked, workingDays, amount } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO salaries (teacher_id, month, year, days_worked, working_days, amount)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (teacher_id, month, year) DO UPDATE
        SET days_worked=$4, working_days=$5, amount=$6
      RETURNING *
    `, [teacherId, month, year, daysWorked || 0, workingDays || 26, parseInt(amount) || 0]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Bulk-generate salaries for all active teachers from attendance data
app.post('/api/salaries/generate', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { month, year, workingDays } = req.body;
  try {
    // Get all active teachers
    const teachersRes = await pool.query("SELECT id, name, base_pay, employee_id FROM teachers WHERE status = 'Active'");
    const teachers = teachersRes.rows;

    // Build date range for the month
    const monthNum  = parseInt(month) + 1; // JS month is 0-indexed
    const pad       = n => String(n).padStart(2, '0');
    const startDate = `${year}-${pad(monthNum)}-01`;
    const lastDay   = new Date(year, monthNum, 0).getDate();
    const endDate   = `${year}-${pad(monthNum)}-${pad(lastDay)}`;

    const results = [];
    for (const teacher of teachers) {
      // Count present days for this teacher in the month
      const attendRes = await pool.query(
        `SELECT COUNT(*) as cnt FROM teacher_attendance WHERE teacher_id=$1 AND date BETWEEN $2 AND $3 AND status='Present'`,
        [teacher.id, startDate, endDate]
      );
      const daysPresent = parseInt(attendRes.rows[0].cnt) || 0;
      const salary      = workingDays > 0 ? Math.round((teacher.base_pay || 0) * daysPresent / workingDays) : 0;

      const row = await pool.query(`
        INSERT INTO salaries (teacher_id, month, year, days_worked, working_days, amount)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (teacher_id, month, year) DO NOTHING
        RETURNING *
      `, [teacher.id, parseInt(month), parseInt(year), daysPresent, workingDays || 26, salary]);
      results.push({ teacherName: teacher.name, daysPresent, salary, inserted: row.rowCount > 0 });
    }
    res.json({ ok: true, results });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.patch('/api/salaries/:id/mark-paid', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  try {
    await pool.query('UPDATE salaries SET paid = TRUE, paid_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/results', authenticate, async (req, res) => {
  const { studentId, grade, term } = req.query;
  try {
    let query = `SELECT r.*, s.name AS student_name, s.gr_no FROM results r JOIN students s ON r.student_id = s.id WHERE 1=1`;
    const params = [];
    if (studentId) { params.push(studentId); query += ` AND r.student_id = $${params.length}`; }
    if (grade) { params.push(grade); query += ` AND r.grade = $${params.length}`; }
    if (term) { params.push(term); query += ` AND r.term = $${params.length}`; }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/results', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { studentId, grade, term, subjects, total, date } = req.body;
  try {
    const result = await pool.query(`
      INSERT INTO results (student_id, grade, term, subjects, total, date)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, term, grade) DO UPDATE
        SET subjects=$4, total=$5, date=$6
      RETURNING *
    `, [studentId, grade, term, JSON.stringify(subjects || []), total || 0, date || new Date().toISOString().split('T')[0]]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// NOTICES, EVENTS, TIMETABLE, PROCUREMENT
// ═══════════════════════════════════════════════════════════════════════════

// Notices
app.get('/api/notices', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM notices ORDER BY pinned DESC, posted_at DESC');
  res.json(result.rows);
});
app.post('/api/notices', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { title, body, pinned } = req.body;
  const result = await pool.query(
    'INSERT INTO notices (title, body, posted_by, posted_by_id, pinned) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [title, body, req.user.name, req.user.id, pinned || false]
  );
  res.status(201).json(result.rows[0]);
});
app.delete('/api/notices/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  await pool.query('DELETE FROM notices WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Events
app.get('/api/events', authenticate, async (req, res) => {
  const result = await pool.query('SELECT * FROM events ORDER BY date');
  res.json(result.rows);
});
app.post('/api/events', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { date, title, description } = req.body;
  const result = await pool.query(
    'INSERT INTO events (date, title, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
    [date, title, description || null, req.user.id]
  );
  res.status(201).json(result.rows[0]);
});
app.delete('/api/events/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// Timetable
app.get('/api/timetable', authenticate, async (req, res) => {
  const { grade } = req.query;
  let q = 'SELECT tt.*, t.name AS teacher_name FROM timetable tt LEFT JOIN teachers t ON tt.teacher_id = t.id';
  const params = [];
  if (grade) { params.push(grade); q += ' WHERE tt.grade = $1'; }
  q += ' ORDER BY tt.day, tt.period';
  const result = await pool.query(q, params);
  res.json(result.rows);
});
app.post('/api/timetable', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { grade, day, period, subject, teacherName } = req.body;
  // Look up teacher_id by name (optional — null is valid for free periods)
  let teacherId = null;
  if (teacherName) {
    const t = await pool.query('SELECT id FROM teachers WHERE name=$1 LIMIT 1', [teacherName]);
    if (t.rows.length) teacherId = t.rows[0].id;
  }
  const result = await pool.query(`
    INSERT INTO timetable (grade, day, period, subject, teacher_id) VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (grade, day, period) DO UPDATE SET subject=$4, teacher_id=$5
    RETURNING *
  `, [grade, day, period, subject || null, teacherId]);
  res.json(result.rows[0]);
});

app.post('/api/timetable/clear', authenticate, requireRole('super_admin', 'admin', 'teacher'), async (req, res) => {
  const { grade, day, period } = req.body;
  await pool.query('DELETE FROM timetable WHERE grade=$1 AND day=$2 AND period=$3', [grade, day, period]);
  res.json({ ok: true });
});

// Procurements
app.get('/api/procurements', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const result = await pool.query('SELECT * FROM procurements ORDER BY created_at DESC');
  res.json(result.rows);
});
app.post('/api/procurements', authenticate, async (req, res) => {
  const { item, estimatedCost, notes, category } = req.body;
  const result = await pool.query(
    'INSERT INTO procurements (requested_by, requested_by_id, item, estimated_cost, notes, category) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [req.user.name, req.user.id, item, parseInt(estimatedCost) || 0, notes || null, category || 'Other']
  );
  res.status(201).json(result.rows[0]);
});
app.patch('/api/procurements/:id', authenticate, requireRole('super_admin', 'admin'), async (req, res) => {
  const { status, approvedBy } = req.body;
  await pool.query('UPDATE procurements SET status=$1, approved_by=$2 WHERE id=$3', [status, approvedBy || req.user.name, req.params.id]);
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// REPORTS / DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/reports/summary', authenticate, async (req, res) => {
  try {
    const [students, teachers, fees, attendance, resultsCount] = await Promise.all([
      pool.query("SELECT admission_status, COUNT(*) FROM students GROUP BY admission_status"),
      pool.query("SELECT status, COUNT(*) FROM teachers GROUP BY status"),
      pool.query("SELECT SUM(amount) as total FROM fee_payments WHERE EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM NOW())"),
      pool.query("SELECT COUNT(*) as present FROM teacher_attendance WHERE date = CURRENT_DATE AND status = 'Present'"),
      pool.query("SELECT COUNT(*) AS cnt FROM results"),
    ]);
    res.json({
      students:             students.rows,
      teachers:             teachers.rows,
      feesThisYear:         fees.rows[0]?.total || 0,
      teachersPresentToday: attendance.rows[0]?.present || 0,
      resultsCount:         parseInt(resultsCount.rows[0]?.cnt) || 0,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// CATCH-ALL: Serve React App (for production)
// ═══════════════════════════════════════════════════════════════════════════
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found.' });
  }
});

// ── SERVER START ─────────────────────────────────────────────────────────────
const SSL_KEY  = path.join(__dirname, 'ssl', 'server.key');
const SSL_CERT = path.join(__dirname, 'ssl', 'server.crt');

async function testDB() {
  try {
    await pool.query('SELECT 1');
    console.log('   Database     : \u2705 PostgreSQL connected');
  } catch (err) {
    console.error('   Database     : \u274C FAILED \u2014', err.message);
    console.error('   \u2192 Check .env file and ensure PostgreSQL is running!');
  }
}

// Always start plain HTTP (used by same-machine access / reverse proxy)
http.createServer(app).listen(PORT, '0.0.0.0', async () => {
  console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
  console.log('\u2551   SAVM ERP \u2014 API Server (PostgreSQL)     \u2551');
  console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D');
  console.log(`   HTTP (API)   : http://localhost:${PORT}`);
  await testDB();
  console.log('');
});

// Start HTTPS if SSL cert exists (needed for phone camera via LAN)
if (fs.existsSync(SSL_KEY) && fs.existsSync(SSL_CERT)) {
  const sslOptions = {
    key:  fs.readFileSync(SSL_KEY),
    cert: fs.readFileSync(SSL_CERT),
  };
  https.createServer(sslOptions, app).listen(PORT_HTTPS, '0.0.0.0', () => {
    console.log(`   HTTPS (LAN)  : https://0.0.0.0:${PORT_HTTPS}`);
    console.log(`   Phone URL    : https://<PC-IP>:${PORT_HTTPS}`);
    console.log('   \u26A0\uFE0F  Phones: Accept the "Not Secure" warning once, then camera works.');
    console.log('');
  });
} else {
  console.log(`   HTTPS        : Not configured (ssl/server.key + ssl/server.crt missing)`);
  console.log(`   Run windows/gen-ssl.bat to enable HTTPS for phone camera access.`);
  console.log('');
}
