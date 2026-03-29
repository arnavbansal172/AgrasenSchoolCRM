const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');

const app = express();

// ── CONFIGURATION ────────────────────────────────────────────────────────────
// We use Port 3002 to avoid conflicts with common dev processes on 3001.
const PORT = 3002;

// Standard directory for storing school ledger files.
const DATA_DIR = path.join(__dirname, 'data');

// Ensure the data directory exists.
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// The Master Registry file (JSON format) containing all synced school data.
const DB_FILE = path.join(DATA_DIR, 'master_db.json');

// ── SYNC REGISTRY (The In-Memory Master State) ────────────────────────────────
// This object serves as the "Single Source of Truth" for all connected devices.
// Format: { tableName: { record_id: record_data } }
let dbState = {};

// On startup: Load existing school data from disk into memory.
if (fs.existsSync(DB_FILE)) {
  try {
    dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    console.log(`✓ Loaded registry: ${Object.keys(dbState).length} tables found.`);
  } catch (err) {
    console.error('✗ Error loading master_db.json. Starting fresh.', err);
  }
}

// ── DISK PERSISTENCE: THROTTLED SAVING ───────────────────────────────────────
// We wait 1 second after a change before writing to the hard drive. 
// This prevents system slowdown when 18 users are typing simultaneously.
let saveTimeout = null;
const scheduleSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2));
    saveTimeout = null;
  }, 1000); 
};

// ── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors()); // Allow mobile browsers to connect to this machine
app.use(bodyParser.json({ limit: '50mb' })); // Allow large batches of school data

// ── API: UNIVERSAL PULL (Downstream Sync) ────────────────────────────────────
/* 
  GET /api/sync/all
  Used by staff devices to grab the latest copy of the entire school record.
*/
app.get('/api/sync/all', (req, res) => {
  res.json(dbState);
});

// ── API: UNIVERSAL PUSH (Upstream Sync) ──────────────────────────────────────
/*
  POST /api/sync/mutate
  Receives a batch of changes (Create, Update, Delete) from a staff device.
*/
app.post('/api/sync/mutate', (req, res) => {
  const { mutations } = req.body;
  
  // Basic safety check for data array
  if (!Array.isArray(mutations)) return res.status(400).json({ error: 'Expected array of mutations' });

  for (const m of mutations) {
    const { table, action, data } = m;
    
    // Ensure the table exists in our master registry
    if (!dbState[table]) dbState[table] = {};

    if (action === 'put') {
      // Upsert: Create or Update the record by its primary ID
      dbState[table][data.id] = data;
    } else if (action === 'delete') {
      // Delete: Remove the record from the registry
      delete dbState[table][data]; // Here, data is the record's primary ID
    }
  }

  // Trigger throttled save to disk
  scheduleSave();
  res.json({ ok: true, processed: mutations.length });
});

// ── API: DYNAMIC EXPORTS (For Accountant CSV Reports) ───────────────────────
/*
  GET /api/export/:table
  Converts any school table (e.g. 'feePayments') into a downloadable CSV file.
*/
app.get('/api/export/:table', async (req, res) => {
  const tableName = req.params.table;
  const recordsObj = dbState[tableName];
  
  if (!recordsObj || Object.keys(recordsObj).length === 0) {
    return res.status(404).json({ error: 'No data exists for this table' });
  }

  const records = Object.values(recordsObj);
  
  // Dynamically extract CSV headers from the first data record found.
  const headers = Object.keys(records[0]).map(k => ({ id: k, title: k.toUpperCase() }));
  
  const tmpCsvFile = path.join(DATA_DIR, `export_${tableName}_tmp.csv`);
  const writer = createObjectCsvWriter({ path: tmpCsvFile, header: headers });
  
  // Generate the physical CSV file
  await writer.writeRecords(records);

  // Set headers to trigger a download window in the user's browser
  res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export.csv"`);
  res.setHeader('Content-Type', 'text/csv');
  
  // Stream the file directly to the client
  const stream = fs.createReadStream(tmpCsvFile);
  stream.pipe(res);
  
  // Clean up the temporary CSV file after sending
  stream.on('end', () => {
    try { fs.unlinkSync(tmpCsvFile); } catch(e) {} 
  });
});

// ── SERVER BOOTSTRAP ──────────────────────────────────────────────────────────
// Simple health check for network debugging
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Bind the server to all network interfaces so staff on mobile can connect.
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🏫 SAVM ERP - UNIVERSAL SYNC SERVER`);
  console.log(`   Local Access   : http://localhost:${PORT}`);
  console.log(`   Network Access : http://0.0.0.0:${PORT}\n`);
});
