import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { formatGrade } from '../../lib/grEngine';
import {
  Plus, X, Receipt, IndianRupee, Search,
  ChevronDown, ChevronUp, CheckCircle2, Calendar
} from 'lucide-react';

/*
  FEE LEDGER — FULLY MANUAL + MULTI-CATEGORY MODE
  ─────────────────────────────────────────────────────────────────
  Record any combination of fee types in a single visit:
  ✅ Monthly Tuition  → pick months (multi-select) + amount
  ✅ Term Fee         → pick Term 1 / Term 2 + amount
  ✅ Admission Fee    → amount only
  ✅ Other            → free description + amount
  
  All categories can be active simultaneously.
  Each active category saves as a separate payment record.
  Perfect for charity schools with custom waivers & discounts.
*/

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const PAYMENT_METHODS = ['Cash', 'Cheque', 'DD', 'Online'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

// Each category has its own state block
const EMPTY_CATEGORIES = {
  monthly:   { active: false, selectedMonths: [], selectedYear: CURRENT_YEAR, amount: '' },
  term:      { active: false, selectedTerm: '', amount: '' },
  admission: { active: false, amount: '' },
  other:     { active: false, desc: '', amount: '' },
};

const EMPTY_FORM = {
  studentId:  '',
  method:     'Cash',
  date:       new Date().toISOString().split('T')[0],
  notes:      '',
  categories: EMPTY_CATEGORIES,
};

export default function Fees() {
  const { can } = useAuthStore();
  const canRecord = can('fees.record') || can('fees.*');

  // ── STATE ─────────────────────────────────────────────────────────
  const [students, setStudents]       = useState([]);
  const [payments, setPayments]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [searchQuery, setSearch]      = useState('');
  const [expandedId, setExpanded]     = useState(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [form, setForm]               = useState(EMPTY_FORM);
  const [studentSearch, setStudentSearch] = useState('');

  // ── LOAD DATA ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([api.students.list(), api.fees.getPayments()]);
      setStudents(s.filter(x => x.admission_status === 'Active' || x.admission_status === 'New Admission'));
      setPayments(p);
    } catch (err) { setError('Failed to load: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── HELPERS ───────────────────────────────────────────────────────
  const filteredForSelect = students.filter(s => {
    const q = studentSearch.toLowerCase();
    return !q || s.name.toLowerCase().includes(q) || (s.gr_no || '').toLowerCase().includes(q);
  });

  // Patch a single category's fields
  const patchCat = (key, patch) =>
    setForm(f => ({ ...f, categories: { ...f.categories, [key]: { ...f.categories[key], ...patch } } }));

  // Toggle a month in the monthly category
  const toggleMonth = (month) =>
    patchCat('monthly', {
      selectedMonths: form.categories.monthly.selectedMonths.includes(month)
        ? form.categories.monthly.selectedMonths.filter(m => m !== month)
        : [...form.categories.monthly.selectedMonths, month],
    });

  // Build readable fee_type for each active category
  const buildFeeType = (key) => {
    const c = form.categories[key];
    if (key === 'monthly') {
      if (c.selectedMonths.length === 0) return 'Monthly Fee';
      return `Monthly - ${c.selectedMonths.join(', ')} ${c.selectedYear}`;
    }
    if (key === 'term')      return c.selectedTerm || 'Term Fee';
    if (key === 'admission') return 'Admission Fee';
    return c.desc || 'Other';
  };

  // Grand total across all active categories
  const grandTotal = Object.values(form.categories)
    .filter(c => c.active)
    .reduce((s, c) => s + (parseInt(c.amount) || 0), 0);

  // ── SUBMIT ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const active = Object.entries(form.categories).filter(([, c]) => c.active);
    if (active.length === 0) { setError('Select at least one fee category.'); return; }
    if (!form.studentId)     { setError('Please select a student.'); return; }

    // Validate each active category
    for (const [key, c] of active) {
      if (!c.amount || parseInt(c.amount) <= 0) { setError(`Enter amount for ${key}.`); return; }
      if (key === 'monthly' && c.selectedMonths.length === 0) { setError('Select at least one month for Monthly Tuition.'); return; }
      if (key === 'term' && !c.selectedTerm) { setError('Select Term 1 or Term 2.'); return; }
      if (key === 'other' && !c.desc.trim()) { setError('Enter description for "Other" fee.'); return; }
    }

    setSaving(true);
    try {
      // Save one payment record per active category
      for (const [key] of active) {
        await api.fees.addPayment({
          studentId: parseInt(form.studentId),
          feeType:   buildFeeType(key),
          amount:    parseInt(form.categories[key].amount),
          method:    form.method,
          date:      form.date,
          notes:     form.notes,
        });
      }
      setForm(EMPTY_FORM);
      setStudentSearch('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const totalCollected = payments.reduce((s, p) => s + (parseInt(p.amount) || 0), 0);

  // Ledger rows — students who have at least one payment (or match search)
  const ledgerStudents = students
    .filter(s => {
      const q = searchQuery.toLowerCase();
      return (!q || s.name.toLowerCase().includes(q) || (s.gr_no || '').toLowerCase().includes(q));
    })
    .map(s => ({
      ...s,
      payments:  payments.filter(p => p.student_id === s.id),
      totalPaid: payments.filter(p => p.student_id === s.id).reduce((a, p) => a + (parseInt(p.amount) || 0), 0),
    }))
    .filter(s => s.payments.length > 0 || searchQuery);

  // ── CATEGORY SECTIONS ─────────────────────────────────────────────
  const renderCategoryToggle = (key, emoji, label) => {
    const c = form.categories[key];
    return (
      <button
        type="button"
        onClick={() => patchCat(key, { active: !c.active })}
        style={{
          padding: '10px 18px',
          borderRadius: '10px',
          border: `2px solid ${c.active ? '#4f46e5' : '#e2e8f0'}`,
          background: c.active ? '#4f46e5' : 'white',
          color: c.active ? 'white' : '#64748b',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'all 0.15s',
        }}
      >
        {c.active ? <CheckCircle2 size={16} /> : <span style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid currentColor', display: 'inline-block' }} />}
        {emoji} {label}
      </button>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Fee Ledger</h1>
          <p className="page-subtitle">Manual fee collection — record exactly what was received</p>
        </div>
        {canRecord && (
          <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setError(''); }}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Record Payment</>}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Total Collected</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#059669', fontFamily: 'Lexend, sans-serif' }}>₹{totalCollected.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Total Receipts</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>{payments.length}</div>
        </div>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Students w/ Payments</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0891b2', fontFamily: 'Lexend, sans-serif' }}>
            {new Set(payments.map(p => p.student_id)).size}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          PAYMENT FORM
      ═══════════════════════════════════════════════════════════ */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
            <IndianRupee size={18} color="#059669" /> Record Fee Payment
          </h3>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Student + Date + Method */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div>
                  <label className="form-label">Student (Name / GR No.) *</label>
                  <input
                    className="form-input"
                    placeholder="Type to search..."
                    value={studentSearch}
                    onChange={e => { setStudentSearch(e.target.value); setForm(f => ({ ...f, studentId: '' })); }}
                  />
                  {studentSearch && !form.studentId && filteredForSelect.length > 0 && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginTop: '4px', maxHeight: '160px', overflowY: 'auto', background: 'white', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', position: 'relative', zIndex: 10 }}>
                      {filteredForSelect.slice(0, 8).map(s => (
                        <div
                          key={s.id}
                          onClick={() => { setForm(f => ({ ...f, studentId: s.id })); setStudentSearch(`${s.name} (${s.gr_no || 'No GR'})`); }}
                          style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9' }}
                          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                          onMouseLeave={e => e.currentTarget.style.background = 'white'}
                        >
                          <strong>{s.name}</strong>
                          <span style={{ color: '#94a3b8', marginLeft: '8px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.gr_no || 'No GR'}</span>
                          <span style={{ color: '#c7d2fe', marginLeft: '8px', fontSize: '0.75rem' }}>{formatGrade(s.grade)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="form-label">Payment Date *</label>
                  <input required type="date" className="form-input" value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label">Payment Method *</label>
                  <select className="form-select" value={form.method}
                    onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* ── CATEGORY TOGGLES ── */}
              <div>
                <label className="form-label" style={{ marginBottom: '10px', display: 'block' }}>
                  Select Fee Type(s) — toggle all that apply *
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {renderCategoryToggle('monthly',   '📅', 'Monthly Tuition')}
                  {renderCategoryToggle('term',      '📋', 'Term Fee')}
                  {renderCategoryToggle('admission', '🎓', 'Admission Fee')}
                  {renderCategoryToggle('other',     '📌', 'Other')}
                </div>
              </div>

              {/* ── MONTHLY SECTION ── */}
              {form.categories.monthly.active && (
                <div style={{ border: '2px solid #c7d2fe', borderRadius: '12px', padding: '16px', background: '#fafafe' }}>
                  <div style={{ fontWeight: 700, color: '#4338ca', marginBottom: '14px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <Calendar size={16} /> Monthly Tuition
                  </div>
                  {/* Year selector */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                    {YEARS.map(y => (
                      <button key={y} type="button"
                        onClick={() => patchCat('monthly', { selectedYear: y })}
                        style={{ padding: '4px 14px', borderRadius: '6px', border: `1px solid ${form.categories.monthly.selectedYear === y ? '#4f46e5' : '#e2e8f0'}`, background: form.categories.monthly.selectedYear === y ? '#4f46e5' : 'white', color: form.categories.monthly.selectedYear === y ? 'white' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.8rem' }}>
                        {y}
                      </button>
                    ))}
                  </div>
                  {/* Month grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '6px', marginBottom: '14px' }}>
                    {MONTHS.map(month => {
                      const sel = form.categories.monthly.selectedMonths.includes(month);
                      return (
                        <button key={month} type="button" onClick={() => toggleMonth(month)}
                          style={{ padding: '7px 4px', borderRadius: '8px', border: `2px solid ${sel ? '#059669' : '#e2e8f0'}`, background: sel ? '#ecfdf5' : 'white', color: sel ? '#065f46' : '#64748b', fontWeight: sel ? 700 : 500, cursor: 'pointer', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', transition: 'all 0.1s' }}>
                          {sel && <CheckCircle2 size={11} />}{month.slice(0, 3)}
                        </button>
                      );
                    })}
                  </div>
                  {form.categories.monthly.selectedMonths.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, marginBottom: '10px' }}>
                      ✓ {form.categories.monthly.selectedMonths.join(', ')} {form.categories.monthly.selectedYear}
                    </div>
                  )}
                  <div>
                    <label className="form-label">Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" placeholder="Enter amount received"
                      value={form.categories.monthly.amount}
                      onChange={e => patchCat('monthly', { amount: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ── TERM SECTION ── */}
              {form.categories.term.active && (
                <div style={{ border: '2px solid #ddd6fe', borderRadius: '12px', padding: '16px', background: '#fdfaff' }}>
                  <div style={{ fontWeight: 700, color: '#6d28d9', marginBottom: '14px' }}>📋 Term Fee</div>
                  <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                    {['Term 1', 'Term 2'].map(term => (
                      <button key={term} type="button"
                        onClick={() => patchCat('term', { selectedTerm: term })}
                        style={{ padding: '10px 32px', borderRadius: '10px', border: `2px solid ${form.categories.term.selectedTerm === term ? '#7c3aed' : '#e2e8f0'}`, background: form.categories.term.selectedTerm === term ? '#7c3aed' : 'white', color: form.categories.term.selectedTerm === term ? 'white' : '#64748b', fontWeight: 700, cursor: 'pointer', fontSize: '0.95rem', transition: 'all 0.15s' }}>
                        {term}
                      </button>
                    ))}
                  </div>
                  <div>
                    <label className="form-label">Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" placeholder="Enter amount received"
                      value={form.categories.term.amount}
                      onChange={e => patchCat('term', { amount: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ── ADMISSION SECTION ── */}
              {form.categories.admission.active && (
                <div style={{ border: '2px solid #bfdbfe', borderRadius: '12px', padding: '16px', background: '#f0f9ff' }}>
                  <div style={{ fontWeight: 700, color: '#1d4ed8', marginBottom: '14px' }}>🎓 Admission Fee</div>
                  <div>
                    <label className="form-label">Amount (₹) *</label>
                    <input type="number" min="1" className="form-input" placeholder="Enter amount received"
                      value={form.categories.admission.amount}
                      onChange={e => patchCat('admission', { amount: e.target.value })} />
                  </div>
                </div>
              )}

              {/* ── OTHER SECTION ── */}
              {form.categories.other.active && (
                <div style={{ border: '2px solid #fed7aa', borderRadius: '12px', padding: '16px', background: '#fff7ed' }}>
                  <div style={{ fontWeight: 700, color: '#c2410c', marginBottom: '14px' }}>📌 Other Fee</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    <div>
                      <label className="form-label">Description *</label>
                      <input className="form-input" placeholder="e.g. Sports fee, Late fine, Activity..."
                        value={form.categories.other.desc}
                        onChange={e => patchCat('other', { desc: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Amount (₹) *</label>
                      <input type="number" min="1" className="form-input" placeholder="Enter amount received"
                        value={form.categories.other.amount}
                        onChange={e => patchCat('other', { amount: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="form-label">Notes / Remarks (optional)</label>
                <input className="form-input" placeholder="e.g. 50% waiver approved, sibling discount..."
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Grand Total Preview */}
              {grandTotal > 0 && (
                <div style={{ background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '12px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#065f46', marginBottom: '4px' }}>Receipt Summary</div>
                    {Object.entries(form.categories).filter(([,c]) => c.active && c.amount).map(([key, c]) => (
                      <div key={key} style={{ fontSize: '0.8rem', color: '#047857' }}>
                        • {buildFeeType(key)}: <strong>₹{parseInt(c.amount).toLocaleString('en-IN')}</strong>
                      </div>
                    ))}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.7rem', color: '#65a30d', fontWeight: 700 }}>TOTAL</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#15803d', fontFamily: 'Lexend, sans-serif' }}>
                      ₹{grandTotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setStudentSearch(''); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={saving || grandTotal === 0}>
                  <Receipt size={16} /> {saving ? 'Saving...' : `Save ${Object.values(form.categories).filter(c => c.active).length} Receipt(s)`}
                </button>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" style={{ paddingLeft: '34px' }} placeholder="Search student name or GR number..."
            value={searchQuery} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Payment History Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Student</th>
              <th>Grade</th>
              <th>GR No.</th>
              <th style={{ textAlign: 'right' }}>Total Paid</th>
              <th style={{ textAlign: 'right' }}>Receipts</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading...</td></tr>
            ) : ledgerStudents.length === 0 ? (
              <tr><td colSpan={5}>
                <div className="empty-state">
                  <IndianRupee size={32} className="empty-state-icon" />
                  <div className="empty-state-title">No payment records yet</div>
                  <div className="empty-state-desc">Click "Record Payment" to add the first receipt.</div>
                </div>
              </td></tr>
            ) : ledgerStudents.map(rec => (
              <>
                <tr key={rec.id} style={{ cursor: 'pointer' }}
                  onClick={() => setExpanded(expandedId === rec.id ? null : rec.id)}>
                  <td style={{ fontWeight: 600 }}>{rec.name}</td>
                  <td><span className="grade-pill">{formatGrade(rec.grade)}</span></td>
                  <td><span className="gr-number">{rec.gr_no || '—'}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                    ₹{rec.totalPaid.toLocaleString('en-IN')}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-ghost btn-sm">
                      {rec.payments.length} receipts {expandedId === rec.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </td>
                </tr>
                {expandedId === rec.id && (
                  <tr key={`exp-${rec.id}`} style={{ background: '#f8fafc' }}>
                    <td colSpan={5} style={{ padding: '12px 20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {rec.payments.map(p => (
                          <div key={p.id} style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.82rem' }}>
                            <span style={{ fontFamily: 'monospace', color: '#4f46e5', fontWeight: 700, minWidth: '90px' }}>{p.receipt_no || `#${p.id}`}</span>
                            <span style={{ fontWeight: 700, color: '#059669', minWidth: '70px' }}>₹{parseInt(p.amount).toLocaleString('en-IN')}</span>
                            <span style={{ flex: 1, color: '#334155', fontWeight: 600 }}>{p.fee_type}</span>
                            <span style={{ color: '#94a3b8' }}>{p.method}</span>
                            <span style={{ color: '#94a3b8' }}>
                              {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                            </span>
                            {p.notes && <span style={{ color: '#a78bfa', fontStyle: 'italic' }}>{p.notes}</span>}
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
