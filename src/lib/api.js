/**
 * src/lib/api.js
 * 
 * Centralized API Client for the SAVM ERP.
 * 
 * All network requests go through this module.
 * - Automatically attaches the JWT token to every request
 * - Handles 401/403 errors (expired session)
 * - Detects the backend URL automatically (same LAN IP)
 */

// In production: backend serves frontend and API on the same origin
// In development: Vite proxies /api to backend:3002 (see vite.config.js)
// So we always use a relative URL — no hardcoded IP needed!
const getBaseUrl = () => '';


/**
 * Core fetch wrapper with auth headers
 */
const apiFetch = async (path, options = {}) => {
  const token = sessionStorage.getItem('savm_token');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${getBaseUrl()}${path}`, {
    ...options,
    headers,
  });

  // Handle auth errors — clear session and reload to login
  if (response.status === 401 || response.status === 403) {
    sessionStorage.removeItem('savm_token');
    sessionStorage.removeItem('savm_user');
    // Redirect to login if not already there
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
    throw new Error('Session expired. Please log in again.');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
};

// ── AUTH ─────────────────────────────────────────────────────────────────────
export const api = {
  auth: {
    login: (loginId, password) => 
      apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ loginId, password }) }),
    changePassword: (currentPassword, newPassword) =>
      apiFetch('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  // ── USERS ──────────────────────────────────────────────────────────────────
  users: {
    list: () => apiFetch('/api/users'),
    create: (data) => apiFetch('/api/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    disable: (id) => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
  },

  // ── STUDENTS ────────────────────────────────────────────────────────────────
  students: {
    list: () => apiFetch('/api/students'),
    create: (data) => apiFetch('/api/students', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/students/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    activate: (id) => apiFetch(`/api/students/${id}/activate`, { method: 'POST' }),
    promote: (fromGrade, toGrade) => apiFetch('/api/students/promote', { method: 'POST', body: JSON.stringify({ fromGrade, toGrade }) }),
  },

  // ── TEACHERS ────────────────────────────────────────────────────────────────
  teachers: {
    list: () => apiFetch('/api/teachers'),
    create: (data) => apiFetch('/api/teachers', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/teachers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    enrollFace: (id, descriptor) => apiFetch(`/api/teachers/${id}/face-enroll`, { method: 'POST', body: JSON.stringify({ descriptor }) }),
    getFaceDescriptors: () => apiFetch('/api/teachers/face-descriptors'),
  },

  // ── TEACHER ATTENDANCE ──────────────────────────────────────────────────────
  teacherAttendance: {
    list: (params = {}) => apiFetch(`/api/teacher-attendance?${new URLSearchParams(params)}`),
    log: (data) => apiFetch('/api/teacher-attendance', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── STUDENT ATTENDANCE ──────────────────────────────────────────────────────
  attendance: {
    list: (params = {}) => apiFetch(`/api/attendance?${new URLSearchParams(params)}`),
    bulkSave: (records) => apiFetch('/api/attendance/bulk', { method: 'POST', body: JSON.stringify({ records }) }),
    getLocks: () => apiFetch('/api/attendance-locks'),
    lock: (grade, date) => apiFetch('/api/attendance-locks', { method: 'POST', body: JSON.stringify({ grade, date }) }),
  },

  // ── FEES ─────────────────────────────────────────────────────────────────────
  fees: {
    getStructure: () => apiFetch('/api/fee-structure'),
    updateStructure: (grade, data) => apiFetch(`/api/fee-structure/${grade}`, { method: 'PUT', body: JSON.stringify(data) }),
    getPayments: (studentId) => apiFetch(`/api/fee-payments${studentId ? `?studentId=${studentId}` : ''}`),
    addPayment: (data) => apiFetch('/api/fee-payments', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── SALARIES ─────────────────────────────────────────────────────────────────
  salaries: {
    list: (params = {}) => apiFetch(`/api/salaries?${new URLSearchParams(params)}`),
    save: (data) => apiFetch('/api/salaries', { method: 'POST', body: JSON.stringify(data) }),
    markPaid: (id) => apiFetch(`/api/salaries/${id}/mark-paid`, { method: 'PATCH' }),
  },

  // ── RESULTS ──────────────────────────────────────────────────────────────────
  results: {
    list: (params = {}) => apiFetch(`/api/results?${new URLSearchParams(params)}`),
    save: (data) => apiFetch('/api/results', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── NOTICES ───────────────────────────────────────────────────────────────────
  notices: {
    list: () => apiFetch('/api/notices'),
    create: (data) => apiFetch('/api/notices', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/api/notices/${id}`, { method: 'DELETE' }),
  },

  // ── EVENTS ────────────────────────────────────────────────────────────────────
  events: {
    list: () => apiFetch('/api/events'),
    create: (data) => apiFetch('/api/events', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id) => apiFetch(`/api/events/${id}`, { method: 'DELETE' }),
  },

  // ── TIMETABLE ─────────────────────────────────────────────────────────────────
  timetable: {
    list: (grade) => apiFetch(`/api/timetable${grade ? `?grade=${grade}` : ''}`),
    save: (data) => apiFetch('/api/timetable', { method: 'POST', body: JSON.stringify(data) }),
  },

  // ── PROCUREMENTS ──────────────────────────────────────────────────────────────
  procurements: {
    list: () => apiFetch('/api/procurements'),
    create: (data) => apiFetch('/api/procurements', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => apiFetch(`/api/procurements/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── REPORTS ───────────────────────────────────────────────────────────────────
  reports: {
    summary: () => apiFetch('/api/reports/summary'),
  },

  // ── HEALTH CHECK ──────────────────────────────────────────────────────────────
  health: () => apiFetch('/api/health'),
};

export default api;
