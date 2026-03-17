import Dexie from 'dexie';

export const db = new Dexie('AgrasenSchoolCRMDB');

// Define the schema for the database
db.version(1).stores({
    students: '++id, grNo, name, grade, status',
    attendance: '++id, studentId, date, status',
    results: '++id, studentId, term',
    teachers: '++id, enrollmentPerSoftech, name, subject',
    salaries: '++id, teacherId, month, year, status',
    fees: '++id, studentId, dueDate, status', // Consider status for tracking paid vs pending easily
    receipts: '++id, studentId, feeId, date'
});

// Optionally populate initial data if needed, or leave empty for offline-first usage.
// db.on('populate', () => {
//    // Populate mock data if necessary
// });
