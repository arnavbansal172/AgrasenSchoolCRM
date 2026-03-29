import { db } from '../db/db';

/**
 * GRADE CONSTANTS
 * The official grade list for Shri Agrasen Vidya Mandir.
 */
export const GRADES = ['KG1', 'KG2', 'Balvatica', '1', '2', '3', '4', '5', '6', '7', '8'];

export const KG_GRADES = ['KG1', 'KG2'];

export const GRADE_DISPLAY = {
  KG1: 'KG I',
  KG2: 'KG II',
  Balvatica: 'Balvatica',
  '1': 'Std. 1',
  '2': 'Std. 2',
  '3': 'Std. 3',
  '4': 'Std. 4',
  '5': 'Std. 5',
  '6': 'Std. 6',
  '7': 'Std. 7',
  '8': 'Std. 8',
};

export const formatGrade = (grade) => GRADE_DISPLAY[grade] || grade;

/**
 * isKgGrade — returns true if grade is KG1 or KG2 (S-prefix logic)
 */
export const isKgGrade = (grade) => KG_GRADES.includes(grade);

/**
 * generateGrNumber — atomically increments the correct counter and
 * returns the formatted GR string.
 *
 * KG1 / KG2  →  'S101', 'S102', ...
 * Balvatica–8 →  '1', '2', '3', ...
 *
 * Uses Dexie's readwrite transaction for atomic increment.
 */
export const generateGrNumber = async (grade) => {
  const counterId = isKgGrade(grade) ? 'kg' : 'std';

  let newGrNo;
  await db.transaction('rw', db.grNoCounters, async () => {
    const row = await db.grNoCounters.get(counterId);
    const nextCount = (row?.counter ?? 0) + 1;
    await db.grNoCounters.put({ id: counterId, counter: nextCount });
    newGrNo = isKgGrade(grade) ? `S${nextCount}` : String(nextCount);
  });

  return newGrNo;
};

/**
 * computeRollNumbers — takes an array of students (already filtered to a grade),
 * sorts them alphabetically by name, and returns the same array with a
 * computed `rollNo` field (1-indexed). GR is NOT needed here.
 *
 * This is a PURE computation — no DB write needed.
 */
export const computeRollNumbers = (students) => {
  return [...students]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    .map((s, index) => ({ ...s, rollNo: index + 1 }));
};

/**
 * nextGrade — returns the grade one step above.
 * Returns null if already at Std. 8 (highest grade).
 */
export const nextGrade = (grade) => {
  const idx = GRADES.indexOf(grade);
  if (idx === -1 || idx === GRADES.length - 1) return null;
  return GRADES[idx + 1];
};
