import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { IndianRupee, Calculator, CheckCircle, Clock } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Salaries() {
  const { can } = useAuthStore();
  const canCalc = can('salaries.calculate');
  const canPay  = can('salaries.pay');

  const currentMonth = new Date().getMonth();
  const currentYear  = new Date().getFullYear();

  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedYear,  setSelectedYear]  = useState(currentYear);
  const [workingDays,   setWorkingDays]   = useState(26);
  const [generating,    setGenerating]    = useState(false);

  const teachers = useLiveQuery(() => db.teachers.where({ status: 'Active' }).toArray()) || [];
  const salaries  = useLiveQuery(() =>
    db.salaries.where({ month: selectedMonth, year: selectedYear }).toArray(),
    [selectedMonth, selectedYear]
  ) || [];

  const teacherAttendance = useLiveQuery(() => {
    // Get all attendance for selected month/year
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const start = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
    const end   = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    return db.teacherAttendance.where('date').between(start, end, true, true).toArray();
  }, [selectedMonth, selectedYear]) || [];

  // Count present days per teacher
  const presentPerTeacher = {};
  teacherAttendance.forEach(a => {
    if (a.status === 'Present') {
      presentPerTeacher[a.teacherId] = (presentPerTeacher[a.teacherId] || 0) + 1;
    }
  });

  // Merge salary records with teachers
  const salaryRows = teachers.map(t => {
    const existing = salaries.find(s => s.teacherId === t.id);
    const daysPresent = presentPerTeacher[t.id] || 0;
    const basePay = t.basePay || 0;
    const calculated = workingDays > 0 ? Math.round((basePay * daysPresent) / workingDays) : 0;
    return { teacher: t, salary: existing, daysPresent, calculated };
  });

  const handleGenerateSalaries = async () => {
    setGenerating(true);
    try {
      for (const row of salaryRows) {
        const { teacher, salary, daysPresent, calculated } = row;
        if (!salary) {
          await db.salaries.add({
            teacherId: teacher.id,
            month: selectedMonth,
            year: selectedYear,
            daysWorked: daysPresent,
            workingDays,
            amount: calculated,
            paid: false,
            generatedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (salaryId) => {
    await db.salaries.update(salaryId, { paid: true, paidAt: new Date().toISOString() });
  };

  const totalPayroll = salaryRows.reduce((s, r) => s + (r.salary?.amount ?? r.calculated), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary Manager</h1>
          <p className="page-subtitle">Automated monthly salary calculation from attendance logs</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Month:</label>
          <select className="form-select" style={{ width: 'auto' }} value={selectedMonth} onChange={e => setSelectedMonth(parseInt(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Year:</label>
          <select className="form-select" style={{ width: 'auto' }} value={selectedYear} onChange={e => setSelectedYear(parseInt(e.target.value))}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Working Days:</label>
          <input type="number" className="form-input" style={{ width: '80px' }} value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value) || 26)} min="1" max="31" />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Payroll</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>₹{totalPayroll.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Generate button */}
      {canCalc && salaries.length === 0 && teachers.length > 0 && (
        <div className="alert alert-info">
          <Calculator size={16} />
          <div style={{ flex: 1 }}>Salaries for {MONTHS[selectedMonth]} {selectedYear} not yet generated.</div>
          <button className="btn btn-primary btn-sm" onClick={handleGenerateSalaries} disabled={generating}>
            <Calculator size={14} /> {generating ? 'Generating...' : 'Generate Salaries'}
          </button>
        </div>
      )}

      {/* Salary Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Teacher</th>
              <th>Employee ID</th>
              <th>Days Present / Working</th>
              <th>Base Pay</th>
              <th>Salary Due</th>
              <th>Status</th>
              {canPay && <th style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {salaryRows.length === 0 ? (
              <tr>
                <td colSpan={canPay ? 7 : 6}>
                  <div className="empty-state">
                    <div className="empty-state-title">No active teachers found</div>
                    <div className="empty-state-desc">Enroll teachers in the Teachers section first.</div>
                  </div>
                </td>
              </tr>
            ) : salaryRows.map(({ teacher, salary, daysPresent, calculated }) => {
              const amount = salary?.amount ?? calculated;
              const paid   = salary?.paid || false;
              return (
                <tr key={teacher.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{teacher.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{teacher.employeeId || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#4f46e5' }}>{daysPresent}</span>
                    <span style={{ color: '#94a3b8' }}> / {workingDays} days</span>
                  </td>
                  <td style={{ color: '#64748b' }}>₹{(teacher.basePay || 0).toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: '#059669', fontSize: '1rem' }}>₹{amount.toLocaleString('en-IN')}</td>
                  <td>
                    {paid
                      ? <span className="badge badge-active"><CheckCircle size={11} /> Paid</span>
                      : <span className="badge badge-pending"><Clock size={11} /> Pending</span>}
                  </td>
                  {canPay && (
                    <td style={{ textAlign: 'right' }}>
                      {!paid && salary && (
                        <button className="btn btn-success btn-sm" onClick={() => handleMarkPaid(salary.id)}>
                          <CheckCircle size={13} /> Mark Paid
                        </button>
                      )}
                      {!salary && (
                        <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>Generate first</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
