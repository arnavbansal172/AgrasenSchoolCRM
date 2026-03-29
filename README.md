# 🏫 Shri Agrasen Vidya Mandir (SAVM) ERP

A robust, offline-first School Management System designed for local network synchronization. This system allows a central Host PC to serve as the "Single Source of Truth" while enabling up to 18+ staff members to manage school data from their mobile devices simultaneously.

## 🚀 One-Click Launch
To start the entire ERP ecosystem (Sync Server + Frontend Interface), run the following command in the terminal:

```bash
bash launch_erp.sh
```

- **Frontend Access:** [http://localhost:5173](http://localhost:5173)
- **Network Access:** Replace `localhost` with your PC's IP address (e.g., `http://192.168.1.5:5173`) to access from mobile phones.

---

## 🏗️ Architecture & Technology Stack

### 1. **The Sync Engine (Bidirectional)**
Unlike traditional apps that require a constant internet connection, SAVM ERP uses an **Offline-First** architecture:
- **Local Storage:** All actions (adding students, taking attendance) are saved instantly to the device's hard drive using `Dexie.js` (IndexedDB).
- **Upstream Sync:** The app "beams" local changes to the Host PC whenever the network is available.
- **Downstream Sync:** Every 10 seconds, the app pulls updates from other users to stay in sync.

### 2. **Universal Registry (The Backend)**
The backend (`backend/index.js`) runs on **Port 3002**. It maintains a global `master_db.json` file. 
- **Conflict Resolution:** Uses Primary-Key merging (BulkPut) to ensure data integrity across 18+ concurrent users.
- **CSV Export:** The backend provides dynamic CSV generation for accountants to download fee ledgers and reports.

### 3. **Role-Based Access Control (RBAC)**
The system enforces strict permissions to protect student privacy:
- **Admin**: Full system control.
- **Principal**: Academic oversight (Results, Attendance, Teachers).
- **Accountant**: Financial management (Fees, Salaries, Procurement).
- **Teacher**: Classroom management (Student list, Attendance, Results).

---

## 🔑 Initial Credentials
For first-time setup, use the Master Admin account:
- **Login ID:** `admin`
- **Password:** `123`

---

## 📂 Project Structure
- **/src/db**: Database schema and initial seeding logic.
- **/src/lib**: The core Sync Engine and GR Number generation logic.
- **/src/pages**: Individual modules (Students, Fees, Staff, etc.).
- **/backend**: Node.js server and the `master_db.json` data store.

---

## 🛠️ Maintenance & Backups
All school data is stored in `backend/data/master_db.json`. 
- **To Backup:** Simply copy the `master_db.json` file to a USB drive.
- **To Restore:** Place your backed-up `master_db.json` into the `backend/data/` folder and restart the launcher.

---
**Developed with ❤️ for Shri Agrasen Vidya Mandir.**
