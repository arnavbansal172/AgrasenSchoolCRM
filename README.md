# Shri Agrasen Vidya Mandir - School Management System (SMS)

A comprehensive, offline-first School Management System designed specifically for Shri Agrasen Vidya Mandir. This portal manages student registrations, tracks daily attendance, handles teacher enrollments, maintains fee ledgers, and generates real-time reports.

Built with **React**, **Vite**, and **Node.js**, prioritizing portability, local network access, and physical file generation (CSV/Markdown) without relying on cloud databases.

## 🚀 Features

*   **Student Management:** Register new students, assign GR numbers, and manage class assignments.
*   **Attendance Tracking:** Daily, class-wise attendance marking with clear visual status indicators.
*   **Teacher Enrollment:** Manage staff records, tracking their PER SOFTECH IDs and assigned subjects.
*   **Fee Ledger:** Automatically calculate expected fees based on class, record payments (Cash/Cheque/Online), and track pending dues.
*   **Local File Syncing:** Automatically generates and updates physical `students.csv`, `attendance.csv`, and `fees.csv` files on the host computer.
*   **Student History:** Generates an individual `.md` text file for every student, aggregating all their life-cycle events (registration, attendance, fee payments) in one scannable document.
*   **Local Network Broadcasting:** Access the portal seamlessly from any smartphone, tablet, or secondary computer connected to the same WiFi network.
*   **PWA Ready:** Acts as a Progressive Web App capable of offline viewing and caching.

## 📁 Architecture

The system operates in two layers that run concurrently:

1.  **Frontend (React + Vite + Dexie.js):** A completely offline-capable React application. It uses Dexie.js (IndexedDB) as a local fast-cache so the UI is instantaneous.
2.  **Backend (Node.js + Express):** A lightweight local server that listens to the frontend and immediately writes data to the `backend/data/` folder on your laptop’s hard drive, generating the `.csv` and `.md` files.

---

## 💻 Installation & Setup

You only need **Node.js** installed on your computer to run this entire system.

### 1. Prerequisite
Ensure you have Node.js installed on your laptop. You can download it from [nodejs.org](https://nodejs.org/).

### 2. Clone the Repository
Open your terminal and clone this repository to your computer:
```bash
git clone https://github.com/arnavbansal172/AgrasenSchoolCRM.git
cd AgrasenSchoolCRM
```

### 3. Install Dependencies
Install all required Node modules for both the frontend and the local backend server.
First, install the frontend dependencies in the root folder:
```bash
npm install
```
Next, navigate to the backend folder and install its dependencies:
```bash
cd backend
npm install
cd ..
```

---

## 🏃‍♂️ Running the Application

To launch the portal and the local file server simultaneously, run:

```bash
npm run start:local
```

### Accessing the Portal

**From the Host Laptop:**
*   Open your internet browser and visit: `http://localhost:5173`

**From a Smartphone / Tablet (on the same WiFi):**
1.  Look at the terminal output after running the command above. You will see a `Network` address (e.g., `http://192.168.1.5:5173`).
2.  Alternatively, find your laptop's local IP address.
3.  Open a browser on your phone and enter that exact IP address and port.
4.  The application will automatically switch to a mobile-friendly layout and sidebar!

---

## 📊 Where is my Data Saved?

All data entered into the system is saved inside the `backend/data/` directory.

*   `backend/data/students.csv` - Open with Excel
*   `backend/data/attendance.csv` - Open with Excel
*   `backend/data/fees.csv` - Open with Excel
*   `backend/data/students/*.md` - Open with Word, Notes, Pages, etc.

*Note: You can safely backup or copy the `backend/data/` folder to a USB drive at any time.*
