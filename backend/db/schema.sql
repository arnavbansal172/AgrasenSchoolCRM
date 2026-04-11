-- ============================================================
-- SAVM ERP — PostgreSQL Schema
-- Shri Agrasen Vidya Mandir
-- Version: 2.0 (PostgreSQL)
-- ============================================================
-- This file is the single source of truth for the database.
-- Application code NEVER alters structure — only this file does.
-- To apply changes: psql -U savm_user -d savm_erp -f schema.sql
-- ============================================================

-- ── EXTENSIONS ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- For gen_random_uuid()

-- ── DROP EXISTING TABLES (Safe re-run) ──────────────────────
-- Order matters: dependent tables dropped first
DROP TABLE IF EXISTS procurements CASCADE;
DROP TABLE IF EXISTS notices CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS timetable CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS salaries CASCADE;
DROP TABLE IF EXISTS teacher_attendance CASCADE;
DROP TABLE IF EXISTS attendance_locks CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS fee_payments CASCADE;
DROP TABLE IF EXISTS fee_structure CASCADE;
DROP TABLE IF EXISTS staff_users CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS gr_no_counters CASCADE;

-- ── TABLE: gr_no_counters ────────────────────────────────────
-- Atomic GR number counters. Two series: 'kg' and 'std'.
-- Never delete or reset these — GR numbers are permanent.
CREATE TABLE gr_no_counters (
  id      VARCHAR(10) PRIMARY KEY, -- 'kg' or 'std'
  counter INTEGER NOT NULL DEFAULT 0
);

-- ── FUNCTION: next_gr_number ─────────────────────────────────
-- Atomically generates the next GR number in a transaction.
-- KG series  -> S101, S102, S103 ...
-- Std series -> 1, 2, 3, 4 ...
CREATE OR REPLACE FUNCTION next_gr_number(series VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE gr_no_counters
    SET counter = counter + 1
    WHERE id = series
    RETURNING counter INTO next_val;

  IF next_val IS NULL THEN
    RAISE EXCEPTION 'GR counter not found for series: %', series;
  END IF;

  IF series = 'kg' THEN
    RETURN 'S' || next_val::VARCHAR;
  ELSE
    RETURN next_val::VARCHAR;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ── TABLE: students ──────────────────────────────────────────
CREATE TABLE students (
  id               SERIAL PRIMARY KEY,
  gr_no            VARCHAR(20) UNIQUE,           -- Assigned on activation
  name             VARCHAR(150) NOT NULL,
  grade            VARCHAR(20) NOT NULL,
  parent_name      VARCHAR(150),
  phone            VARCHAR(20),
  dob              DATE,
  admission_status VARCHAR(30) NOT NULL DEFAULT 'New Admission'
                     CHECK (admission_status IN ('New Admission','Active','Inactive','Left')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at     TIMESTAMPTZ,
  lc_date          DATE,
  lc_reason        TEXT
);

CREATE INDEX idx_students_grade ON students(grade);
CREATE INDEX idx_students_status ON students(admission_status);
CREATE INDEX idx_students_gr_no ON students(gr_no);

-- ── TABLE: teachers ──────────────────────────────────────────
CREATE TABLE teachers (
  id               SERIAL PRIMARY KEY,
  employee_id      VARCHAR(30),
  name             VARCHAR(150) NOT NULL,
  subject          VARCHAR(100),
  assigned_grade   VARCHAR(20),
  phone            VARCHAR(20),
  base_pay         INTEGER NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'Active'
                     CHECK (status IN ('Active','Inactive')),
  -- face_descriptor stores the 128-float array from face-api.js
  -- Stored as JSONB array: [0.123, -0.456, ...]
  face_descriptor  JSONB,
  face_enrolled    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teachers_status ON teachers(status);

-- ── TABLE: staff_users ───────────────────────────────────────
-- Login accounts for all 18 staff members + super admin.
-- Passwords stored as bcrypt hashes — never plain text.
CREATE TABLE staff_users (
  id          SERIAL PRIMARY KEY,
  login_id    VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name        VARCHAR(150) NOT NULL,
  role        VARCHAR(20) NOT NULL DEFAULT 'viewer'
                CHECK (role IN ('super_admin','admin','teacher','viewer')),
  -- Optional: Link teacher account to teacher record for class-specific access
  teacher_id  INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login  TIMESTAMPTZ
);

CREATE INDEX idx_staff_users_login ON staff_users(login_id);
CREATE INDEX idx_staff_users_role ON staff_users(role);

-- ── TABLE: attendance ────────────────────────────────────────
CREATE TABLE attendance (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  grade       VARCHAR(20) NOT NULL,
  date        DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'Present'
                CHECK (status IN ('Present','Absent','Late','Holiday')),
  marked_by   INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, date) -- One attendance entry per student per day
);

CREATE INDEX idx_attendance_date ON attendance(date);
CREATE INDEX idx_attendance_grade_date ON attendance(grade, date);

-- ── TABLE: attendance_locks ──────────────────────────────────
-- Prevents double-marking. Once a grade+date is locked, no changes.
CREATE TABLE attendance_locks (
  grade  VARCHAR(20) NOT NULL,
  date   DATE NOT NULL,
  locked_by INTEGER REFERENCES staff_users(id),
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (grade, date)
);

-- ── TABLE: teacher_attendance ────────────────────────────────
CREATE TABLE teacher_attendance (
  id          SERIAL PRIMARY KEY,
  teacher_id  INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      VARCHAR(20) NOT NULL DEFAULT 'Present'
                CHECK (status IN ('Present','Absent','Late','Half Day')),
  method      VARCHAR(30) NOT NULL DEFAULT 'Face Recognition'
                CHECK (method IN ('Face Recognition','Manual','Override')),
  match_score NUMERIC(5,2), -- Store the confidence score from face-api.js (0.00 to 1.00)
  marked_by   INTEGER REFERENCES staff_users(id),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, date) -- One attendance per teacher per day
);

CREATE INDEX idx_teacher_att_date ON teacher_attendance(date);

-- ── TABLE: fee_structure ─────────────────────────────────────
CREATE TABLE fee_structure (
  grade         VARCHAR(20) PRIMARY KEY,
  admission_fee INTEGER NOT NULL DEFAULT 0,
  monthly_fee   INTEGER NOT NULL DEFAULT 0,
  exam_fee      INTEGER NOT NULL DEFAULT 0
);

-- ── TABLE: fee_payments ──────────────────────────────────────
CREATE TABLE fee_payments (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  fee_type    VARCHAR(50) NOT NULL, -- 'Monthly', 'Admission', 'Exam', etc.
  amount      INTEGER NOT NULL DEFAULT 0,
  method      VARCHAR(30) NOT NULL DEFAULT 'Cash'
                CHECK (method IN ('Cash','Online','Cheque','DD')),
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_no  VARCHAR(30) UNIQUE,
  notes       TEXT,
  recorded_by INTEGER REFERENCES staff_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fee_payments_student ON fee_payments(student_id);
CREATE INDEX idx_fee_payments_date ON fee_payments(date);

-- ── TABLE: salaries ──────────────────────────────────────────
CREATE TABLE salaries (
  id           SERIAL PRIMARY KEY,
  teacher_id   INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  month        INTEGER NOT NULL CHECK (month BETWEEN 0 AND 11), -- JS 0-indexed (0=Jan, 11=Dec)
  year         INTEGER NOT NULL,
  days_worked  INTEGER NOT NULL DEFAULT 0,
  working_days INTEGER NOT NULL DEFAULT 26,
  amount       INTEGER NOT NULL DEFAULT 0,
  paid         BOOLEAN NOT NULL DEFAULT FALSE,
  paid_at      TIMESTAMPTZ,
  UNIQUE (teacher_id, month, year)
);

CREATE INDEX idx_salaries_period ON salaries(year, month);

-- ── TABLE: results ───────────────────────────────────────────
CREATE TABLE results (
  id          SERIAL PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  grade       VARCHAR(20) NOT NULL,
  term        VARCHAR(30) NOT NULL, -- 'Term 1', 'Term 2', 'Annual'
  subjects    JSONB NOT NULL DEFAULT '[]', -- [{name, marks, maxMarks}, ...]
  total       INTEGER NOT NULL DEFAULT 0,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (student_id, term, grade)
);

-- ── TABLE: timetable ─────────────────────────────────────────
CREATE TABLE timetable (
  id          SERIAL PRIMARY KEY,
  grade       VARCHAR(20) NOT NULL,
  day         VARCHAR(15) NOT NULL
                CHECK (day IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  period      INTEGER NOT NULL CHECK (period BETWEEN 1 AND 10),
  subject     VARCHAR(100),
  teacher_id  INTEGER REFERENCES teachers(id),
  UNIQUE (grade, day, period)
);

-- ── TABLE: events ────────────────────────────────────────────
CREATE TABLE events (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  title       VARCHAR(200) NOT NULL,
  description TEXT,
  created_by  INTEGER REFERENCES staff_users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_date ON events(date);

-- ── TABLE: notices ───────────────────────────────────────────
CREATE TABLE notices (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(250) NOT NULL,
  body        TEXT NOT NULL,
  posted_by   VARCHAR(150), -- Name string for display
  posted_by_id INTEGER REFERENCES staff_users(id),
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pinned      BOOLEAN NOT NULL DEFAULT FALSE
);

-- ── TABLE: procurements ──────────────────────────────────────
CREATE TABLE procurements (
  id              SERIAL PRIMARY KEY,
  requested_by    VARCHAR(150),
  requested_by_id INTEGER REFERENCES staff_users(id),
  item            VARCHAR(250) NOT NULL,
  category        VARCHAR(50) NOT NULL DEFAULT 'Other',
  estimated_cost  INTEGER NOT NULL DEFAULT 0,
  status          VARCHAR(30) NOT NULL DEFAULT 'Wishlist'
                    CHECK (status IN ('Wishlist','Approved','Rejected','Purchased')),
  approved_by     VARCHAR(150),
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── COMMENTS ─────────────────────────────────────────────────
COMMENT ON TABLE students IS 'All student records: admissions, GR numbers, status history';
COMMENT ON TABLE teachers IS 'Teacher profiles with face biometric descriptors for attendance';
COMMENT ON TABLE staff_users IS 'Login accounts for all school staff with role-based access';
COMMENT ON TABLE teacher_attendance IS 'Daily face-scan or manual attendance for 18 teachers';
COMMENT ON TABLE gr_no_counters IS 'Atomic counters for GR number generation. Never reset.';
COMMENT ON FUNCTION next_gr_number IS 'Atomically generates next GR number. Race-condition safe.';
