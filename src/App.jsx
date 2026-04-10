import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';

// Layout & Pages
import Layout from './components/Layout';
import Login from './pages/Login/Login';
import Dashboard from './pages/Dashboard/Dashboard';
import Students from './pages/Students/Students';
import Attendance from './pages/Attendance/Attendance';
import Fees from './pages/Fees/Fees';
import Teachers from './pages/Teachers/Teachers';
import Salaries from './pages/Salaries/Salaries';
import Results from './pages/Results/Results';
import Timetable from './pages/Timetable/Timetable';
import Events from './pages/Events/Events';
import Notices from './pages/Notices/Notices';
import Reports from './pages/Reports/Reports';
import Procurement from './pages/Procurement/Procurement';
import Staff from './pages/Staff/Staff';
import UserManagement from './pages/Admin/UserManagement';
import TeacherFaceAttendance from './pages/Attendance/TeacherFaceAttendance';

/*
  AUTH GUARD
  Wraps protected routes. Redirects to /login if not authenticated.
  The hydrate() call in App ensures the session is restored from
  sessionStorage before this check runs.
*/
function AuthGuard({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/*
  PERMISSION GUARD
  Wraps pages that require specific permissions.
  Shows a "403 No Access" message if the user lacks permission.
*/
function PermGuard({ perm, children }) {
  const can = useAuthStore(s => s.can);
  if (!can(perm)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', height: '50vh', gap: '12px',
        color: '#94a3b8', textAlign: 'center'
      }}>
        <div style={{ fontSize: '3rem' }}>🔒</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>Access Denied</div>
        <div style={{ fontSize: '0.875rem' }}>
          You don't have permission to view this page.
          <br />Contact the Super Admin to request access.
        </div>
      </div>
    );
  }
  return children;
}

export default function App() {
  const hydrate = useAuthStore(s => s.hydrate);

  // ON MOUNT: Restore session from sessionStorage
  useEffect(() => {
    hydrate();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Route */}
        <Route path="/login" element={<Login />} />

        {/* All Protected Routes inside the Layout shell */}
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<PermGuard perm="dashboard.view"><Dashboard /></PermGuard>} />
          
          {/* Face Scan Attendance */}
          <Route path="face-attendance" element={<PermGuard perm="face_attendance.use"><TeacherFaceAttendance /></PermGuard>} />
          
          {/* Core */}
          <Route path="students"    element={<PermGuard perm="students.view"><Students /></PermGuard>} />
          <Route path="attendance"  element={<PermGuard perm="attendance.view"><Attendance /></PermGuard>} />
          <Route path="results"     element={<PermGuard perm="results.view"><Results /></PermGuard>} />
          
          {/* Finance */}
          <Route path="fees"        element={<PermGuard perm="fees.view"><Fees /></PermGuard>} />
          <Route path="salaries"    element={<PermGuard perm="salaries.view"><Salaries /></PermGuard>} />
          <Route path="procurement" element={<PermGuard perm="procurement.view"><Procurement /></PermGuard>} />
          
          {/* People */}
          <Route path="teachers"    element={<PermGuard perm="teachers.view"><Teachers /></PermGuard>} />
          <Route path="staff"       element={<PermGuard perm="staff.view"><Staff /></PermGuard>} />
          
          {/* Admin: User Management (super_admin only) */}
          <Route path="admin/users" element={<PermGuard perm="staff.view"><UserManagement /></PermGuard>} />
          
          {/* Academic */}
          <Route path="timetable"   element={<PermGuard perm="timetable.view"><Timetable /></PermGuard>} />
          <Route path="events"      element={<PermGuard perm="events.view"><Events /></PermGuard>} />
          <Route path="notices"     element={<PermGuard perm="notices.view"><Notices /></PermGuard>} />
          
          {/* System */}
          <Route path="reports"     element={<PermGuard perm="reports.view"><Reports /></PermGuard>} />
        </Route>

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
