import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard/Dashboard';
import Students from './pages/Students/Students';
import Attendance from './pages/Students/Attendance';
import Teachers from './pages/Teachers/Teachers';
import Fees from './pages/Fees/Fees';
import Reports from './pages/Reports/Reports';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="students" element={<Students />} />
          <Route path="attendance" element={<Attendance />} />
          <Route path="teachers" element={<Teachers />} />
          <Route path="fees" element={<Fees />} />
          <Route path="reports" element={<Reports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
