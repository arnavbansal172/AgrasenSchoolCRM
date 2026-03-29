import Dexie from 'dexie';

/*
  DATABASE ENGINE (Dexie.js)
  This file defines the offline database schema used by the browser.
  Data is persisted to the device's hard drive (IndexedDB) and synchronized 
  to the Host Server via syncEngine.js.

  Key Strategy: 
  Every record has a primary key (usually '++id' auto-increment).
  The sync engine uses these keys to merge data from multiple users (18+).
*/

// Initialize the database with a versioned name.
// Renaming the DB forces a clean slate and triggers the initial seeding.
export const db = new Dexie('SAVM_ERP_V1');

// Define the tables and their searchable indexes
db.version(4).stores({
  // ── Core & Auth ──────────────────────────────────
  grNoCounters: 'id',                         // Stores the next available GR Number (KG/Std)
  staffUsers: '++id, loginId, name, role',     // Staff credentials and access roles

  // ── Student Management ────────────────────────────
  students: '++id, grNo, name, grade, admissionStatus, createdAt',

  // ── Attendance ───────────────────────────────────
  attendance: '++id, studentId, grade, date, status',
  attendanceLocks: '[grade+date]',             // Composite index to lock attendance days

  // ── Fees & Accounting ────────────────────────────
  feePayments: '++id, studentId, feeType, amount, method, date, receiptNo',
  feeStructure: 'grade',                       // Maps grades to their annual fee amounts

  // ── Staff & HR ───────────────────────────────────
  teachers: '++id, employeeId, name, subject, assignedGrade, basePay, status',
  teacherAttendance: '++id, teacherId, date, status',
  salaries: '++id, teacherId, month, year, daysWorked, workingDays, amount, paid',

  // ── Academic Results ──────────────────────────────
  results: '++id, studentId, grade, term, subjects, total, date',

  // ── Communication & Logistics ─────────────────────
  timetable: '++id, grade, day, period',
  events: '++id, date, title, description',
  notices: '++id, title, body, postedBy, postedAt, pinned',
  procurements: '++id, requestedBy, item, estimatedCost, status, approvedBy, date',
});

// ── INITIAL SEEDING ──────────────────────────────────────────────────────────
// This hook runs the very first time the database is opened by a user.
// It ensures there is an "admin" account so you can log in for the first time.
db.on('ready', async () => {
  
  // 1. Create the Master Administrator (User ID: admin / Password: 123)
  const adminCount = await db.staffUsers.count();
  if (adminCount === 0) {
    await db.staffUsers.add({
      loginId: 'admin',
      password: '123',
      name: 'Master Admin',
      role: 'admin'
    });
  }

  // 2. Setup the GR Number counters for automatic student ID generation.
  // KG series starts at 100, standard (Std) series starts at 0.
  const countersCount = await db.grNoCounters.count();
  if (countersCount === 0) {
    await db.grNoCounters.bulkAdd([
      { id: 'kg',  counter: 100 },
      { id: 'std', counter: 0   },
    ]);
  }

  // 3. Populate the default Fee Structure for all school grades (KG1 to 8).
  const feeCount = await db.feeStructure.count();
  if (feeCount === 0) {
    const grades = ['KG1','KG2','Balvatica','1','2','3','4','5','6','7','8'];
    const feeData = grades.map(g => ({
      grade: g,
      admissionFee: 500,
      monthlyFee: g === 'KG1' || g === 'KG2' ? 300 : 400,
      examFee: 150,
    }));
    await db.feeStructure.bulkAdd(feeData);
  }
});
