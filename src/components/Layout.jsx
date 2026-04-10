import { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore, ROLE_LABELS, ROLE_COLORS } from '../store/authStore';
import {
  LayoutDashboard, Users, ClipboardCheck, BookOpen, IndianRupee,
  GraduationCap, Calendar, Bell, Menu, X, LogOut, Trophy,
  FileBarChart2, ShoppingCart, Clock, Wifi, WifiOff, Scan,
  Shield, UserCog
} from 'lucide-react';

/*
  MAIN APPLICATION LAYOUT — v2.0
  Role-aware navigation: shows/hides menu items based on permissions.
  Shows logged-in user with role badge and logout button.
*/

const NAV_ITEMS = [
  { to: '/',                 icon: LayoutDashboard, label: 'Dashboard',      perm: 'dashboard.view',    section: 'main' },
  { to: '/face-attendance',  icon: Scan,            label: 'Face Attendance',perm: 'face_attendance.use',section: 'main' },
  { to: '/students',         icon: Users,           label: 'Students',       perm: 'students.view',     section: 'main' },
  { to: '/attendance',       icon: ClipboardCheck,  label: 'Attendance',     perm: 'attendance.view',   section: 'main' },
  { to: '/results',          icon: Trophy,          label: 'Results',        perm: 'results.view',      section: 'main' },
  { to: '/fees',             icon: IndianRupee,     label: 'Fee Ledger',     perm: 'fees.view',         section: 'finance' },
  { to: '/salaries',         icon: Clock,           label: 'Salaries',       perm: 'salaries.view',     section: 'finance' },
  { to: '/procurement',      icon: ShoppingCart,    label: 'Procurement',    perm: 'procurement.view',  section: 'finance' },
  { to: '/teachers',         icon: GraduationCap,   label: 'Teachers',       perm: 'teachers.view',     section: 'people' },
  { to: '/timetable',        icon: Calendar,        label: 'Timetable',      perm: 'timetable.view',    section: 'academic' },
  { to: '/events',           icon: BookOpen,        label: 'Events',         perm: 'events.view',       section: 'academic' },
  { to: '/notices',          icon: Bell,            label: 'Notice Board',   perm: 'notices.view',      section: 'academic' },
  { to: '/reports',          icon: FileBarChart2,   label: 'Reports',        perm: 'reports.view',      section: 'system' },
  { to: '/admin/users',      icon: UserCog,         label: 'User Accounts',  perm: 'staff.view',        section: 'system', roleOnly: 'super_admin' },
];

const SECTIONS = {
  main: 'Core',
  finance: 'Finance',
  people: 'People',
  academic: 'Academic',
  system: 'System',
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const location = useLocation();
  const navigate = useNavigate();

  const { user, can, logout, getRoleLabel, getRoleColor } = useAuthStore();
  const roleColor = getRoleColor();

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  // Filter nav items by permission
  const visibleItems = NAV_ITEMS.filter(item => {
    if (item.roleOnly && user?.role !== item.roleOnly) return false;
    return can(item.perm);
  });

  const sections = {};
  visibleItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  const renderSidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '20px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'Lexend, sans-serif', fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>
              SAVM Portal
            </div>
            <div style={{ fontSize: '0.68rem', color: 'rgba(199,210,254,0.5)', marginTop: '1px' }}>
              Shri Agrasen Vidya Mandir
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(199,210,254,0.5)', cursor: 'pointer' }} className="mobile-close">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {Object.entries(sections).map(([sectionKey, items]) => (
          <div key={sectionKey}>
            <div className="sidebar-section-label">{SECTIONS[sectionKey]}</div>
            {items.map(item => {
              const Icon = item.icon;
              const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  style={{ marginBottom: '1px' }}
                >
                  <Icon size={17} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer: User + Logout */}
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* User info block */}
        {user && (
          <div style={{ padding: '10px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: roleColor.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Shield size={15} color={roleColor.text} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, background: roleColor.bg, color: roleColor.text, borderRadius: '4px', padding: '1px 6px', display: 'inline-block', marginTop: '2px' }}>
                {ROLE_LABELS[user.role] || user.role}
              </div>
            </div>
          </div>
        )}

        {/* Online status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: isOnline ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
          {isOnline ? <Wifi size={13} color="#10b981" /> : <WifiOff size={13} color="#ef4444" />}
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isOnline ? '#10b981' : '#ef4444' }}>
            {isOnline ? 'Online (LAN)' : 'Offline'}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(199,210,254,0.7)', cursor: 'pointer',
            padding: '8px 10px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = '#fca5a5'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(199,210,254,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        >
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>
      {/* Desktop Sidebar */}
      <aside style={{ width: '220px', background: 'var(--sidebar-bg)', flexShrink: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="sidebar-desktop">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Backdrop */}
      <div className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Mobile Sidebar */}
      <aside className={`sidebar-mobile ${sidebarOpen ? 'open' : ''}`}>
        {renderSidebarContent()}
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top bar */}
        <header style={{ height: '56px', background: 'white', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0 }}>
          <button onClick={() => setSidebarOpen(true)} className="mobile-menu-btn" style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '6px', borderRadius: '8px', display: 'none' }}>
            <Menu size={22} />
          </button>
          <div style={{ flex: 1 }} />
          {/* Role badge in top bar (desktop) */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                Welcome, <strong>{user.name}</strong>
              </span>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 10px', borderRadius: '999px', background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}` }}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>
          )}
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <div className="page-wrapper">
            <Outlet />
          </div>
        </main>
      </div>

      <style>{`
        .sidebar-backdrop {
          position: fixed; inset: 0;
          background: rgba(15,23,42,0.4);
          backdrop-filter: blur(4px);
          z-index: 40; opacity: 0; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .sidebar-backdrop.visible { opacity: 1; pointer-events: auto; }
        .sidebar-mobile {
          position: fixed; top: 0; left: 0; bottom: 0; width: 280px;
          background: var(--sidebar-bg); z-index: 50;
          transform: translateX(-100%);
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          display: none; flex-direction: column;
        }
        .sidebar-mobile.open { transform: translateX(0); }
        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .sidebar-mobile { display: flex; }
          .mobile-menu-btn { display: block !important; }
          .mobile-close { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-close { display: none !important; }
        }
      `}</style>
    </div>
  );
}
