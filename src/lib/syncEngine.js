/* 
  SYNC ENGINE
  This script manages the bidirectional data flow between the browser (Offline) 
  and the Host Server (Sync). 
  
  Architecture:
  1. Internal Storage (Dexie): Records are saved instantly to the device hard drive.
  2. Upstream (Push): Changes are beamed to the server whenever the device is online.
  3. Downstream (Pull): Every 10 seconds, the device grabs updates other users made.
*/

// NOTE: We use lazy dynamic imports for 'db.js' to prevent circular dependency crashes.
// This ensures the database is fully initialized before the sync engine starts listening.

const getApiUrl = () => `http://${window.location.hostname}:3002`;

// ── UPSTREAM: PUSH LOCAL CHANGES TO SERVER ──────────────────────────────────
// This buffer holds change notifications (Create, Update, Delete) from the local DB.
let mutationQueue = [];
let isPosting = false; // Prevents overlapping network requests

// Called by Dexie database hooks whenever a user types/saves data locally.
export const pushMutation = (table, action, data) => {
  // Add the change to the persistent queue buffer.
  mutationQueue.push({ table, action, data });
  // Schedule a network push to the Host PC.
  scheduleProcess();
};

let processTimer = null;
const scheduleProcess = () => {
  // If a push is already scheduled, don't double-schedule it.
  if (processTimer) return;
  // Wait 50 milliseconds to batch rapid keystrokes into a single batch.
  processTimer = setTimeout(processQueue, 50); 
};

const processQueue = async () => {
  processTimer = null;
  // Don't send if already pushing or if the queue is empty.
  if (isPosting || mutationQueue.length === 0) return;

  isPosting = true;
  // Grab a snapshot of the current changes and clear the queue.
  const batch = [...mutationQueue];
  mutationQueue = [];

  try {
    // Attempt to beam the batch to the Host PC via HTTP.
    await fetch(`${getApiUrl()}/api/sync/mutate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations: batch }),
    });
  } catch {
    // If the server is offline, put the changes back in the front of the queue 
    // to retry periodically later.
    mutationQueue = [...batch, ...mutationQueue];
  } finally {
    isPosting = false;
    // If there's pending data, retry in 5 seconds.
    if (mutationQueue.length > 0) {
      setTimeout(scheduleProcess, 5000);
    }
  }
};

// ── DOWNSTREAM: PULL GLOBAL STATE FROM SERVER ──────────────────────────────
/*
  syncDownstream()
  This function downloads the entire master school record and merges it locally.
*/
export const syncDownstream = async () => {
  try {
    // Fetch the universal JSON school record from the Host machine.
    const res = await fetch(`${getApiUrl()}/api/sync/all`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return;
    const remoteState = await res.json();

    // Lazy load the DB instance to avoid circular dependency startup crashes.
    const { db } = await import('../db/db'); 

    // Loop through every table in the remote state (students, staff, results, etc.)
    for (const tableName of Object.keys(remoteState)) {
      const tbl = db[tableName];
      if (!tbl) continue;
      
      const records = Object.values(remoteState[tableName]);
      if (records.length === 0) continue;
      
      // Merge remote records into local browser storage.
      // bulkPut overwrites existing local records by Primary Key (ID).
      await tbl.bulkPut(records);
    }
  } catch {
    // Silently continue if the network is disconnected. This is the core of Offline-First.
  }
};

// ── REGISTRATION: INITIALIZE DATABASE HOOKS ───────────────────────────────
/*
  initSyncHooks()
  Attaches event listeners to the browser database to detect changes as they happen.
*/
export const initSyncHooks = async () => {
  // Import the database instance on-demand.
  const { db } = await import('../db/db');

  // Ensure the database connection is open before we attach listeners.
  await db.open();

  // We skip system/config tables to prevent synchronization loops on counters.
  const SKIP_TABLES = new Set(['grNoCounters', 'feeStructure']);

  // Loop through every student/staff table in the database and attach listeners.
  db.tables.forEach(table => {
    if (SKIP_TABLES.has(table.name)) return;

    // Trigger: When a new record is saved locally.
    table.hook('creating', function (_primKey, obj) {
      // Once created, push the new data to the server.
      this.onsuccess = (newKey) => pushMutation(table.name, 'put', { ...obj, id: newKey });
    });

    // Trigger: When an existing record is updated.
    table.hook('updating', function (modifications, _pk, obj) {
      // Once updated, push the changed data to the server.
      this.onsuccess = () => pushMutation(table.name, 'put', { ...obj, ...modifications });
    });

    // Trigger: When a record is deleted locally.
    table.hook('deleting', function (primKey) {
      // Notify the server about the deletion via primary ID.
      this.onsuccess = () => pushMutation(table.name, 'delete', primKey);
    });
  });
};

// ── BACKGROUND BACKGROUND RECOVERY ─────────────────────────────────────────
// Periodically check for updates made by other staff members on their devices.
setInterval(() => {
  // Only pull if we aren't currently busy pushing local changes.
  if (!isPosting) syncDownstream();
}, 10000); // Polling every 10 seconds.
