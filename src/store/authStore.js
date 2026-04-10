import { create } from 'zustand';
import api from '../lib/api';

/*
  AUTH STORE (Zustand) — v2.0 REAL AUTHENTICATION
  
  This module manages:
  1. Real JWT-based login/logout
  2. 4-role RBAC: super_admin, admin, teacher, viewer
  3. Session persistence via sessionStorage
  4. Fine-grained permission checks (can('module.action'))
*/

// ── ROLE LABELS (Display Names) ──────────────────────────────────────────────
export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  teacher: 'Teacher',
  viewer: 'Viewer',
};

// ── ROLE COLORS ───────────────────────────────────────────────────────────────
export const ROLE_COLORS = {
  super_admin: { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },  // Amber — highest
  admin:       { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },  // Purple
  teacher:     { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },  // Green
  viewer:      { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },  // Slate
};

// ── PERMISSIONS MATRIX ────────────────────────────────────────────────────────
/*
  Format: role -> array of permissions
  '*' means all permissions (super_admin only)
  'module.*' means all actions in a module
  'module.action' means a specific action
*/
const PERMISSIONS = {
  // Super Admin — unrestricted access to everything
  super_admin: ['*'],

  // Admin — manages school operations, fees, staff attendance
  // Can view students but not add teachers as freely
  admin: [
    'dashboard.view',
    'students.view', 'students.add', 'students.edit', 'students.activate', 'students.issueLC', 'students.promote',
    'attendance.view', 'attendance.mark',
    'teachers.view', 'teachers.add', 'teachers.edit', 'teachers.faceEnroll',
    'face_attendance.use', 'face_attendance.override',
    'fees.*',
    'salaries.*',
    'procurement.*',
    'reports.*',
    'notices.*',
    'events.*',
    'timetable.view', 'timetable.edit',
    'results.view',
    'staff.view',
  ],

  // Teacher — manages their class, marks attendance and results
  teacher: [
    'dashboard.view',
    'students.view',
    'attendance.view', 'attendance.mark',
    'results.view', 'results.add', 'results.edit',
    'timetable.view',
    'notices.view',
    'events.view',
    'face_attendance.use',
  ],

  // Viewer — read-only access to everything
  viewer: [
    'dashboard.view',
    'students.view',
    'attendance.view',
    'fees.view',
    'teachers.view',
    'results.view',
    'timetable.view',
    'events.view',
    'notices.view',
    'salaries.view',
    'procurement.view',
    'reports.view',
  ],
};

// ── PERMISSION CHECKER ────────────────────────────────────────────────────────
const checkPermission = (role, perm) => {
  const perms = PERMISSIONS[role] || [];
  if (perms.includes('*')) return true; // Super admin
  if (perms.includes(perm)) return true;
  
  // Check wildcard: 'fees.*' allows 'fees.view', 'fees.add', etc.
  const [module] = perm.split('.');
  if (perms.includes(`${module}.*`)) return true;
  
  return false;
};

// ── STORE ─────────────────────────────────────────────────────────────────────
export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  // ── Hydrate session from storage (called on app mount) ────────────────────
  hydrate: () => {
    try {
      const token = sessionStorage.getItem('savm_token');
      const userStr = sessionStorage.getItem('savm_user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, token, isAuthenticated: true });
      }
    } catch {
      set({ user: null, token: null, isAuthenticated: false });
    }
  },

  // ── Real Login ────────────────────────────────────────────────────────────
  login: async (loginId, password) => {
    const response = await api.auth.login(loginId, password);
    // response = { token, user: { id, name, role, loginId, teacherId } }
    const { token, user } = response;
    sessionStorage.setItem('savm_token', token);
    sessionStorage.setItem('savm_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
    return true;
  },

  // ── Logout ────────────────────────────────────────────────────────────────
  logout: () => {
    sessionStorage.removeItem('savm_token');
    sessionStorage.removeItem('savm_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  // ── Permission Check ──────────────────────────────────────────────────────
  can: (perm) => {
    const { user } = get();
    if (!user) return false;
    return checkPermission(user.role, perm);
  },

  // ── Role Helpers ──────────────────────────────────────────────────────────
  getRoleLabel: () => {
    const { user } = get();
    if (!user) return 'Unknown';
    return ROLE_LABELS[user.role] || user.role;
  },

  getRoleColor: () => {
    const { user } = get();
    if (!user) return ROLE_COLORS.viewer;
    return ROLE_COLORS[user.role] || ROLE_COLORS.viewer;
  },
}));
