import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { IndianRupee, Calculator, CheckCircle, Clock } from 'lucide-react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function Salaries() {
  const { can } = useAuthStore();
  const canCalc = can('salaries.calculate');
  const canPay  = can('salaries.pay');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear,  setSelectedYear]  = useState(now.getFullYear());
  const [workingDays,   setWorkingDays]   = useState(26);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.salaries.list(selectedMonth, selectedYear);
      setRows(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.salaries.generate(selectedMonth, selectedYear, workingDays);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleMarkPaid = async (salaryId) => {
    try {
      await api.salaries.markPaid(salaryId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const totalPayroll = rows.reduce((s, r) => s + (r.amount || 0), 0);
  const notGenerated = rows.length === 0 && !loading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Salary Manager</h1>
          <p className="page-subtitle">Monthly salary calculation from attendance logs</p>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '0.875rem' }}>⚠️ {error}</div>}

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
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Working Days:</label>
          <input type="number" className="form-input" style={{ width: '80px' }} value={workingDays}
            onChange={e => setWorkingDays(parseInt(e.target.value) || 26)} min="1" max="31" />
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monthly Payroll</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>₹{totalPayroll.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {canCalc && notGenerated && (
        <div className="alert alert-info">
          <Calculator size={16} />
          <div style={{ flex: 1 }}>Salaries for {MONTHS[selectedMonth]} {selectedYear} not yet generated.</div>
          <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={generating}>
            <Calculator size={14} /> {generating ? 'Generating...' : 'Generate Salaries'}
          </button>
        </div>
      )}

      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Teacher</th><th>Employee ID</th><th>Days Present / Working</th>
              <th>Base Pay</th><th>Salary Due</th><th>Status</th>
              {canPay && <th style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-title">No salary records for this month</div><div className="empty-state-desc">Use "Generate Salaries" to calculate from attendance data.</div></div></td></tr>
            ) : rows.map(row => (
              <tr key={row.id}>
                <td style={{ fontWeight: 600 }}>{row.teacher_name}</td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.82rem', color: '#64748b' }}>{row.employee_id || '—'}</td>
                <td>
                  <span style={{ fontWeight: 700, color: '#4f46e5' }}>{row.days_present}</span>
                  <span style={{ color: '#94a3b8' }}> / {row.working_days} days</span>
                </td>
                <td style={{ color: '#64748b' }}>₹{(row.base_pay || 0).toLocaleString('en-IN')}</td>
                <td style={{ fontWeight: 700, color: '#059669', fontSize: '1rem' }}>₹{(row.amount || 0).toLocaleString('en-IN')}</td>
                <td>
                  {row.paid
                    ? <span className="badge badge-active"><CheckCircle size={11} /> Paid</span>
                    : <span className="badge badge-pending"><Clock size={11} /> Pending</span>}
                </td>
                {canPay && (
                  <td style={{ textAlign: 'right' }}>
                    {!row.paid && (
                      <button className="btn btn-success btn-sm" onClick={() => handleMarkPaid(row.id)}>
                        <CheckCircle size={13} /> Mark Paid
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
