import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { syncDownstream, initSyncHooks } from './lib/syncEngine';
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

/* 
  AUTHENTICATION GUARD
  This higher-order component protects secure routes.
  If the user is not authenticated, it redirects them to the login page.
*/
function AuthGuard({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

/* 
  ROOT APPLICATION COMPONENT
  This file handles:
  1. Bootstrapping the session (Hydrate).
  2. Initializing the Database Synchronization Engine.
  3. Global Routing table (React Router).
*/
export default function App() {
  const hydrate = useAuthStore(s => s.hydrate);

  // ON MOUNT: Run system initialization
  useEffect(() => { 
    hydrate();        // 1. Check if user was already logged in (sessionStorage)
    initSyncHooks();  // 2. Attach data listeners to the Local Database
    syncDownstream(); // 3. Pull latest school data from the host PC
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes (Wrapped in AuthGuard & Layout) */}
        <Route path="/" element={<AuthGuard><Layout /></AuthGuard>}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="fees" element={<Fees />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="salaries" element={<Salaries />} />
          <Route path="results" element={<Results />} />
          <Route path="timetable" element={<Timetable />} />
          <Route path="events" element={<Events />} />
          <Route path="notices" element={<Notices />} />
          <Route path="procurement" element={<Procurement />} />
          <Route path="reports" element={<Reports />} />
          <Route path="staff" element={<Staff />} />
        </Route>

        {/* Catch-all: Redirect to dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
