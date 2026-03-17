const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const csvParser = require('csv-parser');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Paths
const DATA_DIR = path.join(__dirname, 'data');
const STUDENTS_DIR = path.join(DATA_DIR, 'students');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(STUDENTS_DIR)) fs.mkdirSync(STUDENTS_DIR, { recursive: true });

// --- Helper Functions ---

// Get CSV Writer for a specific file
const getCsvWriter = (filename, headers) => {
    const filePath = path.join(DATA_DIR, filename);
    const fileExists = fs.existsSync(filePath);
    return createObjectCsvWriter({
        path: filePath,
        header: headers,
        append: fileExists
    });
};

// Write to individual Student Markdown File
const appendToStudentHistory = (grNo, name, entry) => {
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filename = `GR${grNo}_${safeName}.md`;
    const filePath = path.join(STUDENTS_DIR, filename);

    const timestamp = new Date().toLocaleString();
    const logEntry = `\n### [${timestamp}]\n${entry}\n`;

    if (!fs.existsSync(filePath)) {
        const header = `# Student Record: ${name} (GR: ${grNo})\n\nThis document tracks all activity, attendance, and fee history for the student.\n`;
        fs.writeFileSync(filePath, header + logEntry);
    } else {
        fs.appendFileSync(filePath, logEntry);
    }
};

// --- Endpoints ---

// 1. ADD STUDENT
app.post('/api/students', async (req, res) => {
    const { id, grNo, name, grade, status } = req.body;

    try {
        const writer = getCsvWriter('students.csv', [
            { id: 'id', title: 'INTERNAL_ID' },
            { id: 'grNo', title: 'GR_NUMBER' },
            { id: 'name', title: 'FULL_NAME' },
            { id: 'grade', title: 'CLASS_GRADE' },
            { id: 'status', title: 'STATUS' },
            { id: 'date', title: 'REGISTRATION_DATE' }
        ]);

        await writer.writeRecords([{
            id, grNo, name, grade, status,
            date: new Date().toISOString()
        }]);

        // Create individual MD file
        appendToStudentHistory(grNo, name, `**Registered** in Class ${grade}. Status set to ${status}.`);

        res.status(201).json({ success: true, message: 'Student saved to file.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to write student data' });
    }
});

// 2. GET ALL STUDENTS (From CSV)
app.get('/api/students', (req, res) => {
    const results = [];
    const filePath = path.join(DATA_DIR, 'students.csv');

    if (!fs.existsSync(filePath)) return res.json([]);

    fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => res.json(results))
        .on('error', (err) => res.status(500).json({ error: err.message }));
});


// 3. LOG ATTENDANCE
app.post('/api/attendance', async (req, res) => {
    const { studentId, grNo, name, date, status } = req.body;

    try {
        const writer = getCsvWriter('attendance.csv', [
            { id: 'studentId', title: 'INTERNAL_ID' },
            { id: 'grNo', title: 'GR_NUMBER' },
            { id: 'name', title: 'NAME' },
            { id: 'date', title: 'DATE' },
            { id: 'status', title: 'STATUS' }
        ]);

        await writer.writeRecords([{ studentId, grNo, name, date, status }]);

        appendToStudentHistory(grNo, name, `**Attendance:** Marked as *${status}* on ${date}`);

        res.status(201).json({ success: true, message: 'Attendance logged.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write attendance' });
    }
});

// 4. RECORD FEE PAYMENT
app.post('/api/fees', async (req, res) => {
    const { studentId, grNo, name, amount, method, date, receiptNo } = req.body;

    try {
        const writer = getCsvWriter('fees.csv', [
            { id: 'receiptNo', title: 'RECEIPT_NO' },
            { id: 'studentId', title: 'INTERNAL_ID' },
            { id: 'grNo', title: 'GR_NUMBER' },
            { id: 'name', title: 'NAME' },
            { id: 'amount', title: 'AMOUNT_PAID' },
            { id: 'method', title: 'PAYMENT_METHOD' },
            { id: 'date', title: 'DATE' }
        ]);

        await writer.writeRecords([{ receiptNo, studentId, grNo, name, amount, method, date }]);

        appendToStudentHistory(grNo, name, `**Fee Payment:** Collected **₹${amount}** via ${method}. (Receipt: ${receiptNo})`);

        res.status(201).json({ success: true, message: 'Fee recorded.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to write fee record' });
    }
});

// 5. GET STUDENT HISTORY (Read Markdown)
app.get('/api/history/:grNo/:name', (req, res) => {
    const { grNo, name } = req.params;
    const safeName = name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const filePath = path.join(STUDENTS_DIR, `GR${grNo}_${safeName}.md`);

    if (!fs.existsSync(filePath)) {
        return res.json({ content: 'No historical records found for this student.' });
    }

    try {
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (err) {
        res.status(500).json({ error: 'Could not read history file' });
    }
});


app.listen(PORT, () => {
    console.log(`[Local Sync Server] Running on http://localhost:${PORT}`);
    console.log(`[Storage] Reading/Writing to: ${DATA_DIR}`);
});
