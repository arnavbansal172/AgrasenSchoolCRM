import { create } from 'zustand';
import { db } from '../db/db';

/*
  AUTH STORE (Zustand)
  This script manages the logged-in session, user profile, and 
  Role-Based Access Control (RBAC). 
  
  Permission checks (can('module.action')) are defined here.
*/

export const ROLE_LABELS = {
  admin: 'Master Admin',
  principal: 'Principal',
  accounts: 'Accountant',
  teacher: 'Teacher',
};

export const ROLE_COLORS = {
  admin: { bg: '#efe6ff', text: '#5b21b6', border: '#ddd6fe' },
  principal: { bg: '#eef2ff', text: '#3730a3', border: '#c7d2fe' },
  accounts: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  teacher: { bg: '#fff7ed', text: '#9a3412', border: '#ffedd5' },
};

// Define permissions matrix
const PERMISSIONS = {
  // Master Admin has full control
  admin: ['*'],
  
  // Principal governs academic and staff oversight
  principal: [
    'dashboard.view', 'students.view', 'attendance.view', 'teachers.view', 
    'salaries.view', 'results.view', 'timetable.view', 'notices.view'
  ],

  // Accountant governs finances and procurement
  accounts: [
    'dashboard.view', 'fees.*', 'salaries.*', 'procurement.*', 'reports.view'
  ],

  // Teacher governs their specific class and students
  teacher: [
    'dashboard.view', 'students.view', 'attendance.*', 'results.*', 'timetable.view', 'notices.view'
  ]
};

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,

  // Load user from session storage on browser refresh
  hydrate: () => {
    const data = sessionStorage.getItem('savm-session');
    if (data) {
      set({ user: JSON.parse(data), isAuthenticated: true });
    }
  },

  // Perform secure login check against local staffUsers table
  login: async (loginId, password) => {
    const u = await db.staffUsers.where('loginId').equals(loginId.toLowerCase().trim()).first();
    
    if (u && u.password === password) {
      const { password: _, ...profile } = u; // Don't keep password in memory
      set({ user: profile, isAuthenticated: true });
      sessionStorage.setItem('savm-session', JSON.stringify(profile));
      return true;
    }
    return false;
  },

  logout: () => {
    set({ user: null, isAuthenticated: false });
    sessionStorage.removeItem('savm-session');
  },

  /*
    RBAC CHECK: can('module.permission')
    Used throughout the UI to hide buttons and restrict access.
    Support wildcards like 'fees.*' or '*' for full admin.
  */
  can: (perm) => {
    const user = get().user;
    if (!user) return false;
    
    const userPerms = PERMISSIONS[user.role] || [];
    if (userPerms.includes('*')) return true; // Global admin
    
    // Check for exact permission or module wildcard (e.g., 'fees.add' matches 'fees.*')
    const [module] = perm.split('.');
    return userPerms.includes(perm) || userPerms.includes(`${module}.*`);
  },

  getRoleLabel: () => {
    const user = get().user;
    return ROLE_LABELS[user?.role] || 'Staff Member';
  },

  getRoleColor: () => {
    const user = get().user;
    return ROLE_COLORS[user?.role] || { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' };
  }
}));
