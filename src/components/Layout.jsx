import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuthStore } from '../store/authStore';
import {
  LayoutDashboard, Users, ClipboardCheck, BookOpen, IndianRupee,
  GraduationCap, Calendar, Bell, Menu, X, LogOut, Trophy,
  FileBarChart2, ShoppingCart, Clock, Wifi, WifiOff, ChevronDown, ShieldCheck
} from 'lucide-react';

/* 
  MAIN APPLICATION LAYOUT
  This component provides the shell of the application, including:
  1. Responsive Sidebar Navigation with Role-Based filtering.
  2. Top Bar with User Identity and Online/Offline status indicator.
  3. Mobile-friendly Sidebar (with overlay).
  4. Real-time Notice count.
*/

// NAVIGATION LINKS CONFIGURATION
const NAV_ITEMS = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',      perm: null,                    section: 'main' },
  { to: '/students',  icon: Users,           label: 'Students',        perm: 'students.view',         section: 'main' },
  { to: '/attendance',icon: ClipboardCheck,  label: 'Attendance',      perm: 'attendance.student.view', section: 'main' },
  { to: '/results',   icon: Trophy,          label: 'Results',         perm: 'results.view',          section: 'main' },
  { to: '/fees',      icon: IndianRupee,     label: 'Fee Ledger',      perm: 'fees.view',             section: 'finance' },
  { to: '/salaries',  icon: Clock,           label: 'Salaries',        perm: 'salaries.view',         section: 'finance' },
  { to: '/procurement',icon: ShoppingCart,   label: 'Procurement',     perm: 'procurement.view',      section: 'finance' },
  { to: '/teachers',  icon: GraduationCap,   label: 'Teachers',        perm: 'teachers.view',         section: 'people' },
  { to: '/timetable', icon: Calendar,        label: 'Timetable',       perm: 'timetable.view',        section: 'academic' },
  { to: '/events',    icon: BookOpen,        label: 'Events',          perm: 'events.view',           section: 'academic' },
  { to: '/notices',   icon: Bell,            label: 'Notice Board',    perm: 'notices.view',          section: 'academic' },
  { to: '/reports',   icon: FileBarChart2,   label: 'Reports',         perm: 'reports.view',          section: 'system' },
  { to: '/staff',     icon: ShieldCheck,     label: 'Staff Access',    perm: 'staff.manage',          section: 'system' },
];

const SECTIONS = {
  main: 'Core',
  finance: 'Finance',
  people: 'People',
  academic: 'Academic',
  system: 'System',
};

export default function Layout() {
  // ── UI STATE ─────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false);              // Controls mobile sidebar overlay
  const [isOnline, setIsOnline] = useState(navigator.onLine);          // Tracks browser network status
  const location = useLocation();                                      // Tracks current URL for active highlights

  // ── AUTH & IDENTITIES ────────────────────────────────────────────────────
  const { user, logout, can, getRoleLabel, getRoleColor } = useAuthStore();

  // ── REAL-TIME DATA ────────────────────────────────────────────────────────
  // Live count of notices to show a red badge in the sidebar.
  const unreadNotices = useLiveQuery(() => db.notices.count()) || 0;

  // ── EFFECTS: NETWORK TRACKING ─────────────────────────────────────────────
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { 
      window.removeEventListener('online', on); 
      window.removeEventListener('offline', off); 
    };
  }, []);

  // ── EFFECTS: NAVIGATION ──────────────────────────────────────────────────
  // Automatically close mobile sidebar when the user clicks a link.
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // ── LOGIC: ROLE-BASED NAVIGATION ─────────────────────────────────────────
  // Filter the NAV_ITEMS based on the current user's permissions.
  const visibleItems = NAV_ITEMS.filter(item => !item.perm || can(item.perm));

  // Group filtered items into their logical sections (Core, Finance, etc.)
  const sections = {};
  visibleItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  const roleColor = getRoleColor();

  // ── RENDER CONTENT: SIDEBAR ──────────────────────────────────────────────
  const renderSidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand Logo Header */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>SAVM Portal</div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(199,210,254,0.55)', marginTop: '1px' }}>Shri Agrasen Vidya Mandir</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(199,210,254,0.6)', cursor: 'pointer', padding: '4px' }} className="mobile-close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Navigation List */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Object.entries(sections).map(([sectionKey, items]) => (
          <div key={sectionKey}>
            {/* Section Header (e.g. Finance) */}
            <div className="sidebar-section-label">{SECTIONS[sectionKey]}</div>
            {items.map(item => {
              const Icon = item.icon;
              // Check if currently active or at a sub-path
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  style={{ marginBottom: '1px', position: 'relative' }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                  {/* Notice Badge */}
                  {item.to === '/notices' && unreadNotices > 0 && (
                    <span style={{ marginLeft: 'auto', background: '#f59e0b', color: 'white', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', minWidth: '18px', textAlign: 'center' }}>
                      {unreadNotices}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sidebar Footer with Status & User Identity */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Connection Status Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '8px', background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', marginBottom: '8px' }}>
          {isOnline ? <Wifi size={13} color="#10b981" /> : <WifiOff size={13} color="#ef4444" />}
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isOnline ? '#10b981' : '#ef4444' }}>
            {isOnline ? 'Online (LAN)' : 'Offline Mode'}
          </span>
        </div>

        {/* User Account Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)' }}>
          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: roleColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0, border: `2px solid ${roleColor.border}` }}>
            {user?.role === 'admin' ? '👑' : user?.role === 'accounts' ? '💼' : user?.role === 'principal' ? '🎓' : '📚'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'white', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{user?.name}</div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(199,210,254,0.55)', fontWeight: 600 }}>{getRoleLabel()}</div>
          </div>
          {/* Logout Button */}
          <button
            onClick={logout}
            title="Logout"
            style={{ background: 'transparent', border: 'none', color: 'rgba(199,210,254,0.5)', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── MAIN RENDER ────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Sidebar — Persistent on Desktop */}
      <aside style={{ width: '220px', background: 'var(--sidebar-bg)', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="sidebar-desktop">
        {renderSidebarContent()}
      </aside>

      {/* Main Surface */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar with Mobile Menu trigger */}
        <header style={{ height: '58px', background: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0, zIndex: 10 }}>
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'none' }}>
            <Menu size={22} />
          </button>
          <div style={{ flex: 1 }} />
          {/* Active User Identity Info */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: roleColor.bg, border: `1px solid ${roleColor.border}`, fontSize: '0.75rem', fontWeight: 700, color: roleColor.text }}>
            {user?.name} <span style={{ opacity: 0.6 }}>·</span> {getRoleLabel()}
          </div>
        </header>

        {/* Dynamic Route Content (Page Outlet) */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div className="page-wrapper">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Dynamic CSS for Mobile Responsiveness */}
      <style>{`
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex !important; transform: ${sidebarOpen ? 'translateX(0)' : 'translateX(-100%)'}; }
          .mobile-menu-btn { display: block !important; }
        }
      `}</style>
    </div>
  );
}
