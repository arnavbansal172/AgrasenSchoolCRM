import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Plus, X, Receipt, AlertCircle, IndianRupee, Search, ChevronDown, ChevronUp } from 'lucide-react';

const FEE_TYPES = ['Admission Fee', 'Monthly Tuition', 'Exam Fee', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'Online'];
const EMPTY_FORM = { studentId: '', feeType: 'Monthly Tuition', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' };

export default function Fees() {
  const { can } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const canRecord = can('fees.record');

  const load = useCallback(async () => {
    try {
      const [s, p, st] = await Promise.all([api.students.list(), api.fees.getPayments(), api.fees.getStructure()]);
      setStudents(s.filter(x => x.admission_status === 'Active'));
      setPayments(p);
      setStructure(st);
    } catch (err) {
      setError('Failed to load: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const getStruct = (grade) => structure.find(f => f.grade === grade);

  const ledger = students
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return (!searchQuery || s.name.toLowerCase().includes(q) || (s.gr_no || '').toLowerCase().includes(q))
        && (filterGrade === 'All' || s.grade === filterGrade);
    })
    .map(student => {
      const st = getStruct(student.grade);
      const expected = (st?.admission_fee || 0) + (st?.monthly_fee || 0) * 12 + (st?.exam_fee || 0);
      const studentPayments = payments.filter(f => f.student_id === student.id);
      const totalPaid = studentPayments.reduce((s, f) => s + (parseInt(f.amount) || 0), 0);
      return { ...student, expected, totalPaid, balance: Math.max(0, expected - totalPaid), payments: studentPayments };
    });

  const totalCollected = ledger.reduce((s, r) => s + r.totalPaid, 0);
  const totalPending   = ledger.reduce((s, r) => s + r.balance, 0);

  const handleRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.fees.recordPayment({
        studentId: parseInt(form.studentId),
        feeType: form.feeType,
        amount: parseInt(form.amount),
        method: form.method,
        date: form.date,
        notes: form.notes,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      await load();
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Ledger</h1>
          <p className="page-subtitle">Track student payments and outstanding balances</p>
        </div>
        {canRecord && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Record Payment</>}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem' }}>⚠️ {error}</div>}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Total Collected</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', fontFamily: 'Lexend, sans-serif' }}>₹{totalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Pending Dues</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#dc2626', fontFamily: 'Lexend, sans-serif' }}>₹{totalPending.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Active Students</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>{students.length}</div>
        </div>
      </div>

      {/* Payment Form */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <IndianRupee size={18} color="#059669" /> Record Payment
          </h3>
          <form onSubmit={handleRecord}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Student *</label>
                <select required className="form-select" value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}>
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.name} ({s.gr_no}) — {formatGrade(s.grade)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Fee Type *</label>
                <select className="form-select" value={form.feeType} onChange={e => setForm(p => ({ ...p, feeType: e.target.value }))}>
                  {FEE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Amount (₹) *</label>
                <input required className="form-input" type="number" min="1" value={form.amount}
                  onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Enter amount" />
              </div>
              <div>
                <label className="form-label">Method *</label>
                <select className="form-select" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={form.date}
                  onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={saving}>
                <Receipt size={16} /> {saving ? 'Saving...' : 'Record & Generate Receipt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" style={{ paddingLeft: '34px' }} placeholder="Search student or GR..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
          <option value="All">All Grades</option>
          {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
        </select>
      </div>

      {/* Ledger */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th><th>Grade</th><th>Annual Fee</th><th>Paid</th><th>Balance</th><th>Status</th>
              <th style={{ textAlign: 'right' }}>Payments</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading...</td></tr>
            ) : ledger.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><div className="empty-state-title">No students found</div></div></td></tr>
            ) : ledger.map(rec => (
              <>
                <tr key={rec.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{rec.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}><span className="gr-number">{rec.gr_no}</span></div>
                  </td>
                  <td><span className="grade-pill">{formatGrade(rec.grade)}</span></td>
                  <td style={{ fontWeight: 600 }}>₹{rec.expected.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: '#059669' }}>₹{rec.totalPaid.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: rec.balance > 0 ? '#dc2626' : '#059669' }}>
                    {rec.balance > 0 ? `₹${rec.balance.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td>
                    {rec.balance === 0
                      ? <span className="badge badge-cleared">Cleared</span>
                      : <span className="badge badge-due"><AlertCircle size={10} /> Due</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(expandedId === rec.id ? null : rec.id)}>
                      {rec.payments.length} receipts {expandedId === rec.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </td>
                </tr>
                {expandedId === rec.id && rec.payments.length > 0 && (
                  <tr key={`pay-${rec.id}`} style={{ background: '#f8fafc' }}>
                    <td colSpan={7} style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {rec.payments.map(p => (
                          <div key={p.id} style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: '#475569', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', color: '#4f46e5', fontWeight: 700 }}>{p.receipt_no}</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>₹{parseInt(p.amount).toLocaleString('en-IN')}</span>
                            <span>{p.fee_type}</span>
                            <span style={{ color: '#94a3b8' }}>{p.method} · {p.date}</span>
                            {p.notes && <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{p.notes}</span>}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
