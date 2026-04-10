import React, { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { generateGrNumber, computeRollNumbers, GRADES, formatGrade, nextGrade } from '../../lib/grEngine';
import {
  Plus, Search, UserPlus, Users, X, Edit2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, ArrowUpCircle, FileText, RefreshCw
} from 'lucide-react';

/*
  STUDENT MANAGEMENT MODULE — v2.0 (PostgreSQL API)
  
  Changes from v1:
  - Data fetched from PostgreSQL via REST API (not Dexie/IndexedDB)
  - GR generation happens atomically on the server (no race conditions)
  - All writes go to server first
*/

const STATUS_CONFIG = {
  'New Admission': { cls: 'badge-new',      label: 'New Admission' },
  'Active':        { cls: 'badge-active',    label: 'Active' },
  'Inactive':      { cls: 'badge-inactive',  label: 'Inactive' },
  'Left':          { cls: 'badge-left',      label: 'Left' },
};

export default function Students() {
  const { can } = useAuthStore();
  
  // ── Data State ──────────────────────────────────────────────────────────
  const [allStudents, setAllStudents] = useState([]);
  const [feePayments, setFeePayments] = useState([]);
  const [feeStructure, setFeeStructure] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── UI State ────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', grade: 'KG1', parentName: '', phone: '', dob: '' });
  const [editModal, setEditModal] = useState(null);
  const [lcModal, setLcModal] = useState(null);
  const [promoteModal, setPromoteModal] = useState(false);
  const [promoteGrade, setPromoteGrade] = useState('1');
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  // ── DATA LOADING ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    try {
      const [students, payments, structure] = await Promise.all([
        api.students.list(),
        api.fees.getPayments(),
        api.fees.getStructure(),
      ]);
      // Sort alphabetically
      setAllStudents([...students].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      setFeePayments(payments);
      setFeeStructure(structure);
    } catch (err) {
      console.error('Failed to load student data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── FEE BALANCE CALCULATION ───────────────────────────────────────────────
  const getStudentBalance = (student) => {
    if (!student.gr_no) return 0;
    const structure = feeStructure.find(f => f.grade === student.grade);
    if (!structure) return 0;
    const totalDue = (structure.admission_fee || 0) + (structure.monthly_fee || 0) * 12 + (structure.exam_fee || 0);
    const paid = feePayments
      .filter(f => f.student_id === student.id)
      .reduce((s, f) => s + (parseInt(f.amount) || 0), 0);
    return Math.max(0, totalDue - paid);
  };

  // ── FILTERING ─────────────────────────────────────────────────────────────
  const filtered = allStudents.filter(s => {
    const matchSearch = !searchQuery ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.gr_no && s.gr_no.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGrade  = filterGrade === 'All' || s.grade === filterGrade;
    const matchStatus = filterStatus === 'All' || s.admission_status === filterStatus;
    return matchSearch && matchGrade && matchStatus;
  });

  // ── ROLL NUMBERS ──────────────────────────────────────────────────────────
  const rollMap = (() => {
    const activeByGrade = {};
    allStudents.filter(s => s.admission_status === 'Active').forEach(s => {
      const g = s.grade || 'Unknown';
      if (!activeByGrade[g]) activeByGrade[g] = [];
      activeByGrade[g].push(s);
    });
    const map = {};
    Object.entries(activeByGrade).forEach(([, arr]) => {
      computeRollNumbers(arr).forEach(s => { map[s.id] = s.rollNo; });
    });
    return map;
  })();

  // ── ACTIONS ───────────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.students.create({
        name: formData.name.trim(),
        grade: formData.grade,
        parentName: formData.parentName.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob || null,
      });
      setFormData({ name: '', grade: 'KG1', parentName: '', phone: '', dob: '' });
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (student) => {
    if (student.admission_status === 'Active') return;
    setSaving(true);
    try {
      await api.students.activate(student.id);
      await loadData();
    } catch (err) {
      alert('Activation failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (student, newStatus) => {
    if (newStatus === 'Active' && !student.gr_no) {
      await handleActivate(student);
      setEditModal(null);
      return;
    }
    try {
      await api.students.update(student.id, { admissionStatus: newStatus });
      setEditModal(null);
      await loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleIssueLC = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const { student } = lcModal;
    const balance = getStudentBalance(student);
    if (balance > 0) {
      alert(`Cannot issue LC. Student has pending balance of ₹${balance.toLocaleString('en-IN')}.`);
      return;
    }
    try {
      await api.students.update(student.id, {
        admissionStatus: 'Left',
        lcDate: form.get('lcDate'),
        lcReason: form.get('lcReason'),
      });
      setLcModal(null);
      await loadData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handlePromote = async () => {
    const toGrade = nextGrade(promoteGrade);
    if (!toGrade) { alert('No higher grade available.'); return; }
    if (!confirm(`Promote all active students from ${formatGrade(promoteGrade)} → ${formatGrade(toGrade)}?`)) return;
    setSaving(true);
    try {
      const result = await api.students.promote(promoteGrade, toGrade);
      alert(`${result.promoted} students promoted!`);
      setPromoteModal(false);
      await loadData();
    } catch (err) {
      alert('Promotion failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const canAdd      = can('students.add');
  const canEdit     = can('students.edit');
  const canActivate = can('students.activate');
  const canLC       = can('students.issueLC');
  const canPromote  = can('students.promote');

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: '12px', color: '#94a3b8' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
        Loading student records...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {allStudents.filter(s => s.admission_status === 'Active').length} active ·{' '}
            {allStudents.filter(s => s.admission_status === 'New Admission').length} pending activation
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {canPromote && (
            <button className="btn btn-ghost btn-sm" onClick={() => setPromoteModal(true)}>
              <ArrowUpCircle size={15} /> Promote Class
            </button>
          )}
          {canAdd && (
            <button className="btn btn-primary" onClick={() => setShowAddForm(s => !s)}>
              {showAddForm ? <X size={16} /> : <><Plus size={16} /> New Admission</>}
            </button>
          )}
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5' }}>
              <UserPlus size={22} />
            </div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>New Admission</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Student starts as "New Admission" — GR assigned only upon activation.</p>
            </div>
          </div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Full Name *</label>
                <input required className="form-input" value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Anjali Sharma" />
              </div>
              <div>
                <label className="form-label">Grade / Class *</label>
                <select required className="form-select" value={formData.grade}
                  onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))}>
                  {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Parent / Guardian Name</label>
                <input className="form-input" value={formData.parentName}
                  onChange={e => setFormData(p => ({ ...p, parentName: e.target.value }))} placeholder="e.g. Ramesh Sharma" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="9876543210" />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input className="form-input" type="date" value={formData.dob}
                  onChange={e => setFormData(p => ({ ...p, dob: e.target.value }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Register Student'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input className="form-input" style={{ paddingLeft: '34px' }} placeholder="Search name or GR number..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
          <option value="All">All Grades</option>
          {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
        </select>
        <select className="form-select" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="All">All Status</option>
          <option value="New Admission">New Admission</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="Left">Left</option>
        </select>
        <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>{filtered.length} records</span>
      </div>

      {/* Student Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll</th>
              <th>GR No.</th>
              <th>Name</th>
              <th>Grade</th>
              <th>Status</th>
              <th>Parent</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7}><div className="empty-state"><Users size={32} className="empty-state-icon" /><div className="empty-state-title">No students found</div></div></td></tr>
            ) : filtered.map(student => {
              const balance = getStudentBalance(student);
              return (
                <React.Fragment key={student.id}>
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}>
                    <td>
                      {student.admission_status === 'Active' && rollMap[student.id]
                        ? <span style={{ fontWeight: 700, color: '#4f46e5' }}>#{rollMap[student.id]}</span>
                        : <span style={{ color: '#cbd5e1' }}>—</span>}
                    </td>
                    <td>
                      {student.gr_no
                        ? <span className="gr-number">{student.gr_no}</span>
                        : <span className="gr-unassigned">Pending</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{student.name}</div>
                      {student.dob && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>DOB: {student.dob}</div>}
                    </td>
                    <td><span className="grade-pill">{formatGrade(student.grade)}</span></td>
                    <td>
                      <span className={`badge ${STATUS_CONFIG[student.admission_status]?.cls}`}>
                        {STATUS_CONFIG[student.admission_status]?.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{student.parent_name || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {canActivate && student.admission_status === 'New Admission' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleActivate(student)} disabled={saving}>
                            <CheckCircle size={14} /> Activate
                          </button>
                        )}
                        {canEdit && student.admission_status !== 'Left' && (
                          <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(student)}>
                            <Edit2 size={14} />
                          </button>
                        )}
                        {canLC && student.admission_status === 'Active' && (
                          <button className="btn btn-warning btn-sm" onClick={() => setLcModal({ student })}>
                            <FileText size={14} /> LC
                            {balance > 0 && <AlertTriangle size={12} style={{ color: '#fbbf24', marginLeft: '4px' }} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expandedId === student.id && (
                    <tr key={`exp-${student.id}`} style={{ background: '#f8fafc' }}>
                      <td colSpan={7} style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                          <div><span style={{ fontWeight: 700 }}>Phone:</span> {student.phone || 'N/A'}</div>
                          <div><span style={{ fontWeight: 700 }}>Admitted:</span> {student.created_at ? new Date(student.created_at).toLocaleDateString('en-IN') : 'N/A'}</div>
                          {student.activated_at && <div><span style={{ fontWeight: 700 }}>Activated:</span> {new Date(student.activated_at).toLocaleDateString('en-IN')}</div>}
                          {student.gr_no && <div><span style={{ fontWeight: 700 }}>Fee Balance:</span> <span style={{ color: balance > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>₹{balance.toLocaleString('en-IN')}</span></div>}
                          {student.lc_date && <div><span style={{ fontWeight: 700 }}>Left on:</span> {student.lc_date}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Status Modal */}
      {editModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Edit Status: {editModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#64748b' }}>
                GR: <strong>{editModal.gr_no || 'Not yet assigned'}</strong> | Grade: <strong>{formatGrade(editModal.grade)}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(STATUS_CONFIG).map(status => {
                  if (status === 'Active' && !editModal.gr_no) return (
                    <button key={status} className="btn btn-success" onClick={() => handleStatusChange(editModal, status)} disabled={saving}>
                      <CheckCircle size={16} /> Activate & Assign GR Number
                    </button>
                  );
                  if (status === 'New Admission') return null;
                  return (
                    <button key={status} className="btn btn-ghost"
                      style={{ justifyContent: 'flex-start', border: editModal.admission_status === status ? '2px solid #4f46e5' : undefined }}
                      onClick={() => handleStatusChange(editModal, status)}
                      disabled={saving || editModal.admission_status === status}>
                      <span className={`badge ${STATUS_CONFIG[status].cls}`}>{status}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LC Modal */}
      {lcModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Issue Leaving Certificate</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setLcModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleIssueLC}>
              <div className="modal-body">
                <div style={{ background: '#fafafa', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 700 }}>{lcModal.student.name}</div>
                  <div style={{ color: '#64748b' }}>GR: {lcModal.student.gr_no} | {formatGrade(lcModal.student.grade)}</div>
                </div>
                {(() => {
                  const balance = getStudentBalance(lcModal.student);
                  if (balance > 0) return (
                    <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                      <AlertTriangle size={16} />
                      <div><strong>Block: Unpaid Fees!</strong> ₹{balance.toLocaleString('en-IN')} must be cleared first.</div>
                    </div>
                  );
                  return null;
                })()}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div>
                    <label className="form-label">Date of Leaving *</label>
                    <input type="date" name="lcDate" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div>
                    <label className="form-label">Reason for Leaving *</label>
                    <textarea name="lcReason" className="form-textarea" required placeholder="e.g. Completed Std. 8, relocation, etc." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setLcModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-warning" disabled={getStudentBalance(lcModal.student) > 0}>
                  <FileText size={16} /> Confirm Issue LC
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Promote Modal */}
      {promoteModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Bulk Class Promotion</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setPromoteModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                <AlertTriangle size={16} />
                <div>All <strong>Active</strong> students in the selected grade will be moved up.</div>
              </div>
              <div>
                <label className="form-label">From Grade</label>
                <select className="form-select" value={promoteGrade} onChange={e => setPromoteGrade(e.target.value)}>
                  {GRADES.filter(g => nextGrade(g) !== null).map(g => (
                    <option key={g} value={g}>{formatGrade(g)} → {formatGrade(nextGrade(g))}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPromoteModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handlePromote} disabled={saving}>
                Confirm Promotion
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
