import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { generateGrNumber, computeRollNumbers, GRADES, formatGrade, nextGrade } from '../../lib/grEngine';
import {
  Plus, Search, UserPlus, Users, X, Edit2, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, ArrowUpCircle, FileText, Hash, RefreshCw
} from 'lucide-react';
import ErrorDumper from '../../components/ErrorDumper';

/* 
  STUDENT MANAGEMENT MODULE
  This is the core of the ERP. It handles:
  1. Registration (New Admission)
  2. GR Number Generation (Activation)
  3. Automatic Roll Number Calculation
  4. Leaving Certificate (LC) issuance with Fee Clearance checks
  5. Bulk Class Promotion
*/

// Configuration for student status badges (UI styling)
const STATUS_CONFIG = {
  'New Admission': { cls: 'badge-new',      label: 'New Admission' }, // Initial state, no GR yet
  'Active':        { cls: 'badge-active',    label: 'Active' },        // Fully admitted with GR
  'Inactive':      { cls: 'badge-inactive',  label: 'Inactive' },      // Suspended or on-hold
  'Left':          { cls: 'badge-left',      label: 'Left' },          // Issued TC/LC
};

function StudentsInner() {
  // ── AUTH & PERMISSIONS ───────────────────────────────────────────────────
  const { can } = useAuthStore(); // Check user permissions (e.g., can they promote?)

  // ── UI STATE ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');               // Search name/GR
  const [filterGrade, setFilterGrade] = useState('All');             // Filter by grade
  const [filterStatus, setFilterStatus] = useState('All');           // Filter by status
  const [showAddForm, setShowAddForm] = useState(false);             // Registration form visibility
  const [formData, setFormData] = useState({                         // New student details
    name: '', grade: 'KG1', parentName: '', phone: '', dob: '' 
  });
  const [editModal, setEditModal] = useState(null);                  // Buffer for editing status
  const [lcModal, setLcModal] = useState(null);                      // Buffer for TC/LC process
  const [promoteModal, setPromoteModal] = useState(false);           // Bulk promotion popup
  const [promoteGrade, setPromoteGrade] = useState('1');            // Source grade for promotion
  const [saving, setSaving] = useState(false);                       // DB operation loading state
  const [expandedId, setExpandedId] = useState(null);                // Which row has info accordion open

  // ── DATABASE QUERIES (REACTIVE) ──────────────────────────────────────────
  // useLiveQuery ensures the table updates automatically when data changes elsewhere.
  const rawStudents = useLiveQuery(() => db.students.toArray()) || [];
  const allStudents = [...rawStudents].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const feePayments = useLiveQuery(() => db.feePayments.toArray()) || [];
  const feeStructure = useLiveQuery(() => db.feeStructure.toArray()) || [];

  // ── LOGIC: FEE BALANCE CALCULATION ───────────────────────────────────────
  // Used to prevent issuing LC if the student owes money.
  const getStudentBalance = (student) => {
    if (!student.grNo) return 0; // New Admission, no fees due yet
    const structure = feeStructure.find(f => f.grade === student.grade);
    if (!structure) return 0;
    const monthlyDue = (structure.monthlyFee || 0) * 12; // Flat 12-month calculation
    const examDue = structure.examFee || 0;
    const admitted = student.grNo ? (structure.admissionFee || 0) : 0;
    
    const totalDue = admitted + monthlyDue + examDue;
    const paid = feePayments.filter(f => f.studentId === student.id)
                          .reduce((s, f) => s + (parseInt(f.amount) || 0), 0);
    return Math.max(0, totalDue - paid);
  };

  // ── LOGIC: FILTERING ─────────────────────────────────────────────────────
  const filtered = allStudents.filter(s => {
    const matchSearch = !searchQuery ||
      (s.name && s.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.grNo && s.grNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGrade  = filterGrade === 'All' || s.grade === filterGrade;
    const matchStatus = filterStatus === 'All' || s.admissionStatus === filterStatus;
    return matchSearch && matchGrade && matchStatus;
  });

  // ── LOGIC: ROLL NUMBER MAPPING ───────────────────────────────────────────
  // We compute roll numbers dynamically based on alphabetical order within active students of a grade.
  const getWithRollNo = (students) => {
    const activeByGrade = {};
    students.filter(s => s.admissionStatus === 'Active').forEach(s => {
      const g = s.grade || 'Unknown';
      if (!activeByGrade[g]) activeByGrade[g] = [];
      activeByGrade[g].push(s);
    });
    const rollMap = {};
    Object.entries(activeByGrade).forEach(([grade, arr]) => {
      computeRollNumbers(arr).forEach(s => { rollMap[s.id] = s.rollNo; });
    });
    return rollMap;
  };
  const rollMap = getWithRollNo(allStudents);

  // ── ACTIONS: REGISTER STUDENT ────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.students.add({
        name: formData.name.trim(),
        grade: formData.grade,
        parentName: formData.parentName.trim(),
        phone: formData.phone.trim(),
        dob: formData.dob,
        admissionStatus: 'New Admission', // Forced start state
        grNo: null,                       // No GR yet
        createdAt: new Date().toISOString(),
      });
      setFormData({ name: '', grade: 'KG1', parentName: '', phone: '', dob: '' });
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  // ── ACTIONS: ACTIVATE & ASSIGN GR ────────────────────────────────────────
  // This is the "Full Admission" step. Automatically generates the next unique GR Number.
  const handleActivate = async (student) => {
    if (student.admissionStatus === 'Active') return;
    setSaving(true);
    try {
      const grNo = await generateGrNumber(student.grade);
      await db.students.update(student.id, { 
        admissionStatus: 'Active', 
        grNo, 
        activatedAt: new Date().toISOString() 
      });
    } finally {
      setSaving(false);
    }
  };

  // ── ACTIONS: CHANGE STATUS ───────────────────────────────────────────────
  const handleStatusChange = async (student, newStatus) => {
    if (newStatus === 'Active' && !student.grNo) {
      await handleActivate(student);
      return;
    }
    await db.students.update(student.id, { admissionStatus: newStatus });
    setEditModal(null);
  };

  // ── ACTIONS: ISSUE LC (Transfer Certificate) ─────────────────────────────
  const handleIssueLC = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const { student } = lcModal;
    const balance = getStudentBalance(student);
    
    // Strict block: Cannot leave if money is owed
    if (balance > 0) {
      alert(`Cannot issue LC. Student has pending balance of ₹${balance.toLocaleString('en-IN')}.`);
      return;
    }

    await db.students.update(student.id, {
      admissionStatus: 'Left',
      lcDate: form.get('lcDate'),
      lcReason: form.get('lcReason'),
    });
    setLcModal(null);
    alert('Leaving Certificate issued successfully.');
  };

  // ── ACTIONS: BULK CLASS PROMOTION ────────────────────────────────────────
  // Moves entire batches (e.g., all Std. 1 to Std. 2) in one click.
  const handlePromote = async () => {
    const toGrade = nextGrade(promoteGrade);
    if (!toGrade) { alert('No higher grade available.'); return; }
    setSaving(true);
    try {
      const students = await db.students.where({ grade: promoteGrade, admissionStatus: 'Active' }).toArray();
      await Promise.all(students.map(s => db.students.update(s.id, { grade: toGrade })));
      alert(`${students.length} students promoted from ${formatGrade(promoteGrade)} → ${formatGrade(toGrade)}`);
      setPromoteModal(false);
    } finally {
      setSaving(false);
    }
  };

  // ── PERMISSION FLAGS ─────────────────────────────────────────────────────
  const canAdd      = can('students.add');
  const canEdit     = can('students.edit');
  const canActivate = can('students.activate');
  const canLC       = can('students.issueLC');
  const canPromote  = can('students.promote');

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header & Main Actions */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Students</h1>
          <p className="page-subtitle">
            {allStudents.filter(s => s.admissionStatus === 'Active').length} active · {allStudents.filter(s => s.admissionStatus === 'New Admission').length} pending activation
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

      {/* Registration Form (Collapsible) */}
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
                <input required className="form-input" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Anjali Sharma" />
              </div>
              <div>
                <label className="form-label">Grade / Class *</label>
                <select required className="form-select" value={formData.grade} onChange={e => setFormData(p => ({ ...p, grade: e.target.value }))}>
                  {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Parent / Guardian Name</label>
                <input className="form-input" value={formData.parentName} onChange={e => setFormData(p => ({ ...p, parentName: e.target.value }))} placeholder="e.g. Ramesh Sharma" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input className="form-input" type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 9876543210" />
              </div>
              <div>
                <label className="form-label">Date of Birth</label>
                <input className="form-input" type="date" value={formData.dob} onChange={e => setFormData(p => ({ ...p, dob: e.target.value }))} />
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

      {/* Global Filters & Search */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '34px' }}
            placeholder="Search name or GR number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
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

      {/* Main Student Registry Table */}
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
              <tr>
                <td colSpan={7}>
                  <div className="empty-state">
                    <Users size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No students found</div>
                  </div>
                </td>
              </tr>
            ) : filtered.map(student => {
              const balance = getStudentBalance(student);
              return (
                <React.Fragment key={student.id}>
                  {/* Standard Row */}
                  <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === student.id ? null : student.id)}>
                    <td>
                      {student.admissionStatus === 'Active' && rollMap[student.id]
                        ? <span style={{ fontWeight: 700, color: '#4f46e5', fontSize: '0.9rem' }}>#{rollMap[student.id]}</span>
                        : <span style={{ color: '#cbd5e1', fontSize: '0.8rem' }}>—</span>}
                    </td>
                    <td>
                      {student.grNo
                        ? <span className="gr-number">{student.grNo}</span>
                        : <span className="gr-unassigned">Pending</span>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.name}</div>
                      {student.dob && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>DOB: {student.dob}</div>}
                    </td>
                    <td><span className="grade-pill">{formatGrade(student.grade)}</span></td>
                    <td>
                      <span className={`badge ${STATUS_CONFIG[student.admissionStatus]?.cls}`}>
                        {STATUS_CONFIG[student.admissionStatus]?.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{student.parentName || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                        {/* Option: Activate (only for New Admissions) */}
                        {canActivate && student.admissionStatus === 'New Admission' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleActivate(student)} disabled={saving} title="Activate & Assign GR">
                            <CheckCircle size={14} /> Activate
                          </button>
                        )}
                        {/* Option: Edit Status */}
                        {canEdit && student.admissionStatus !== 'Left' && (
                          <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(student)} title="Edit Status">
                            <Edit2 size={14} />
                          </button>
                        )}
                        {/* Option: Issue LC (TC) */}
                        {canLC && student.admissionStatus === 'Active' && (
                          <button
                            className={`btn btn-warning btn-sm`}
                            onClick={() => setLcModal({ student })}
                          >
                            <FileText size={14} /> LC
                            {balance > 0 && <AlertTriangle size={12} style={{ color: '#fbbf24', marginLeft: '4px' }} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Accordion Detail Row */}
                  {expandedId === student.id && (
                    <tr key={`exp-${student.id}`} style={{ background: '#f8fafc' }}>
                      <td colSpan={7} style={{ padding: '12px 20px' }}>
                        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '0.82rem', color: '#475569' }}>
                          <div><span style={{ fontWeight: 700 }}>Phone:</span> {student.phone || 'N/A'}</div>
                          <div><span style={{ fontWeight: 700 }}>Admitted On:</span> {student.createdAt ? new Date(student.createdAt).toLocaleDateString('en-IN') : 'N/A'}</div>
                          {student.activatedAt && <div><span style={{ fontWeight: 700 }}>Activated:</span> {new Date(student.activatedAt).toLocaleDateString('en-IN')}</div>}
                          {student.grNo && <div><span style={{ fontWeight: 700 }}>Fee Balance:</span> <span style={{ color: balance > 0 ? '#dc2626' : '#059669', fontWeight: 700 }}>₹{balance.toLocaleString('en-IN')}</span></div>}
                          {student.lcDate && <div><span style={{ fontWeight: 700 }}>Left on:</span> {student.lcDate}</div>}
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

      {/* Overlay: Edit Status */}
      {editModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Edit Status: {editModal.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#64748b' }}>
                GR: <strong>{editModal.grNo || 'Not yet assigned'}</strong> | Grade: <strong>{formatGrade(editModal.grade)}</strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {Object.keys(STATUS_CONFIG).map(status => {
                  if (status === 'Active' && !editModal.grNo) return (
                    <button key={status} className="btn btn-success" onClick={() => handleStatusChange(editModal, status)} disabled={saving}>
                      <CheckCircle size={16} /> Activate & Assign GR Number
                    </button>
                  );
                  if (status === 'New Admission') return null; // Cannot go back to New status
                  return (
                    <button
                      key={status}
                      className={`btn btn-ghost`}
                      style={{ justifyContent: 'flex-start', border: editModal.admissionStatus === status ? '2px solid #4f46e5' : undefined }}
                      onClick={() => handleStatusChange(editModal, status)}
                      disabled={saving || editModal.admissionStatus === status}
                    >
                      <span className={`badge ${STATUS_CONFIG[status].cls}`}>{status}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Overlay: Issue LC */}
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
                  <div style={{ color: '#64748b' }}>GR: {lcModal.student.grNo} | {formatGrade(lcModal.student.grade)}</div>
                </div>
                {(() => {
                  const balance = getStudentBalance(lcModal.student);
                  if (balance > 0) return (
                    <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                      <AlertTriangle size={16} />
                      <div>
                        <strong>Block: Unpaid Fees!</strong> Pending balance of ₹{balance.toLocaleString('en-IN')} must be cleared first.
                      </div>
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

      {/* Overlay: Bulk Promotion */}
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
                Confirm Global Promotion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper with Error Boundary
export default function Students() {
  return (
    <ErrorDumper>
      <StudentsInner />
    </ErrorDumper>
  );
}
