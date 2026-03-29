import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Plus, X, Receipt, AlertCircle, IndianRupee, Search, ChevronDown, ChevronUp } from 'lucide-react';

const FEE_TYPES = ['Admission Fee', 'Monthly Tuition', 'Exam Fee', 'Other'];
const PAYMENT_METHODS = ['Cash', 'Cheque', 'Bank Transfer', 'Online'];

export default function Fees() {
  const { can } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ studentId: '', feeType: 'Monthly Tuition', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });

  const canRecord = can('fees.record');

  const activeStudents = useLiveQuery(() =>
    db.students.where({ admissionStatus: 'Active' }).toArray()
  ) || [];

  const feePayments = useLiveQuery(() => db.feePayments.toArray()) || [];
  const feeStructure = useLiveQuery(() => db.feeStructure.toArray()) || [];

  const getStructure = (grade) => feeStructure.find(f => f.grade === grade);

  // Ledger: one row per active student
  const ledger = activeStudents
    .filter(s => {
      const matchSearch = !searchQuery
        || s.name.toLowerCase().includes(searchQuery.toLowerCase())
        || (s.grNo && s.grNo.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchGrade = filterGrade === 'All' || s.grade === filterGrade;
      return matchSearch && matchGrade;
    })
    .map(student => {
      const structure = getStructure(student.grade);
      // Annual expected: admission + 12 months + exam
      const expectedAnnual = (structure?.admissionFee || 0) + (structure?.monthlyFee || 0) * 12 + (structure?.examFee || 0);
      const payments = feePayments.filter(f => f.studentId === student.id);
      const totalPaid = payments.reduce((s, f) => s + (parseInt(f.amount) || 0), 0);
      const balance = Math.max(0, expectedAnnual - totalPaid);
      return { ...student, expectedAnnual, totalPaid, balance, payments };
    });

  const totalCollected = ledger.reduce((s, r) => s + r.totalPaid, 0);
  const totalPending   = ledger.reduce((s, r) => s + r.balance, 0);

  const handleRecord = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const receiptNo = `REC-${Date.now().toString().slice(-7)}`;
      await db.feePayments.add({
        studentId: parseInt(form.studentId),
        feeType: form.feeType,
        amount: parseInt(form.amount),
        method: form.method,
        date: form.date,
        notes: form.notes,
        receiptNo,
        createdAt: new Date().toISOString(),
      });
      setForm({ studentId: '', feeType: 'Monthly Tuition', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
      setShowForm(false);
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

      {/* Summary Stats */}
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
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>{activeStudents.length}</div>
        </div>
        <div className="card" style={{ padding: '16px', background: 'linear-gradient(135deg, #fef9c3, #fef3c7)', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>⚡ Zero Fines Policy</div>
          <div style={{ fontSize: '0.78rem', color: '#92400e', fontWeight: 600 }}>Late payments tracked, no penalties charged</div>
        </div>
      </div>

      {/* Payment Form */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
              <IndianRupee size={22} />
            </div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Record Payment</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>A receipt number is auto-generated on save.</p>
            </div>
          </div>
          <form onSubmit={handleRecord}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Student *</label>
                <select required className="form-select" value={form.studentId} onChange={e => setForm(p => ({ ...p, studentId: e.target.value }))}>
                  <option value="">Select student...</option>
                  {activeStudents.map(s => (
                    <option key={s.id} value={s.id}>{s.name} (GR: {s.grNo}) — {formatGrade(s.grade)}</option>
                  ))}
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
                <input required className="form-input" type="number" min="1" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="Enter amount" />
              </div>
              <div>
                <label className="form-label">Payment Method *</label>
                <select className="form-select" value={form.method} onChange={e => setForm(p => ({ ...p, method: e.target.value }))}>
                  {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} required />
              </div>
              <div>
                <label className="form-label">Notes</label>
                <input className="form-input" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional note..." />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-success" disabled={saving}>
                <Receipt size={16} />{saving ? 'Saving...' : 'Record & Generate Receipt'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" style={{ paddingLeft: '34px' }} placeholder="Search student or GR..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
          <option value="All">All Grades</option>
          {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
        </select>
      </div>

      {/* Ledger Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Grade</th>
              <th>Annual Fee</th>
              <th>Paid</th>
              <th>Balance</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Payments</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <div className="empty-state-title">No active students found</div>
                    <div className="empty-state-desc">Activate students in the Students page first.</div>
                  </div>
                </td>
              </tr>
            ) : ledger.map(record => (
              <>
                <tr key={record.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{record.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}><span className="gr-number">{record.grNo}</span></div>
                  </td>
                  <td><span className="grade-pill">{formatGrade(record.grade)}</span></td>
                  <td style={{ fontWeight: 600 }}>₹{record.expectedAnnual.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: '#059669' }}>₹{record.totalPaid.toLocaleString('en-IN')}</td>
                  <td style={{ fontWeight: 700, color: record.balance > 0 ? '#dc2626' : '#059669' }}>
                    {record.balance > 0 ? `₹${record.balance.toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td>
                    {record.balance === 0
                      ? <span className="badge badge-cleared">Cleared</span>
                      : <span className="badge badge-due"><AlertCircle size={10} /> Due</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
                    >
                      {record.payments.length} receipts {expandedId === record.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </td>
                </tr>
                {expandedId === record.id && record.payments.length > 0 && (
                  <tr key={`pay-${record.id}`} style={{ background: '#f8fafc' }}>
                    <td colSpan={7} style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {record.payments.map(p => (
                          <div key={p.id} style={{ display: 'flex', gap: '16px', fontSize: '0.82rem', color: '#475569', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'monospace', color: '#4f46e5', fontWeight: 700 }}>{p.receiptNo}</span>
                            <span style={{ fontWeight: 700, color: '#059669' }}>₹{parseInt(p.amount).toLocaleString('en-IN')}</span>
                            <span>{p.feeType}</span>
                            <span style={{ color: '#94a3b8' }}>{p.method}</span>
                            <span style={{ color: '#94a3b8' }}>{p.date}</span>
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
