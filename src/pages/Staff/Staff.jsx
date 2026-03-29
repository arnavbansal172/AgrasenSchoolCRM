import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore, ROLE_LABELS, ROLE_COLORS } from '../../store/authStore';
import { ShieldCheck, Plus, X, Trash2, KeyRound, User, Edit2 } from 'lucide-react';
import { GRADES, formatGrade } from '../../lib/grEngine';

/* 
  STAFF ADMINISTRATION PAGE
  This component allows Master Administrators to create and manage login 
  credentials for teachers and office staff.
  
  Key Features:
  1. Role-Based Account Creation (Admin, Principal, Accountant, Teacher).
  2. Grade Assignment for Teachers.
  3. Secure Password Resets.
  4. Real-time listing using Dexie's useLiveQuery.
*/

export default function Staff() {
  // ── AUTHENTICATION ────────────────────────────────────────────────────────
  // We check if the current user has the 'admin' permission to see this page.
  const { can, user } = useAuthStore();
  
  // ── LOCAL UI STATE ────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);              // Toggles the "Add Staff" form
  const [saving, setSaving] = useState(false);                  // Loading state for database writes
  const [form, setForm] = useState({                            // Form data for new users
    name: '', 
    loginId: '', 
    password: '', 
    role: 'teacher', 
    assignedGrade: '' 
  });
  
  const [editModal, setEditModal] = useState(null);             // Controls the password reset popup

  // ── DATABASE QUERY ────────────────────────────────────────────────────────
  // Automatically updates the UI whenever a staff member is added or deleted.
  const isMasterAdmin = user?.role === 'admin';
  const staffUsers = useLiveQuery(() => db.staffUsers.toArray()) || [];

  // ── ACTIONS: CREATE STAFF ─────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Sanitize the Login ID (lowercase, no spaces)
      const loginId = form.loginId.toLowerCase().trim();
      
      // 2. Prevent duplicate Login IDs
      const existing = await db.staffUsers.where('loginId').equals(loginId).first();
      if (existing) {
        alert('A staff user with this Login ID already exists.');
        return;
      }

      // 3. Persist to IndexedDB (and Sync Engine will beam it to the server)
      await db.staffUsers.add({
        name: form.name.trim(),
        loginId: loginId,
        password: form.password,
        role: form.role,
        assignedGrade: form.role === 'teacher' ? form.assignedGrade : null,
      });

      // 4. Reset form UI
      setForm({ name: '', loginId: '', password: '', role: 'teacher', assignedGrade: '' });
      setShowForm(false);
    } catch (err) {
      console.error('Add Staff Error:', err);
      alert('Failed to add staff user.');
    } finally {
      setSaving(false);
    }
  };

  // ── ACTIONS: RESET PASSWORD ───────────────────────────────────────────────
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (!editModal.newPassword) {
        alert("Password cannot be blank");
        return;
      }
      // Update the specific record by its primary ID
      await db.staffUsers.update(editModal.id, { password: editModal.newPassword });
      setEditModal(null);
    } finally {
      setSaving(false);
    }
  }

  // ── ACTIONS: DELETE ACCOUNT ───────────────────────────────────────────────
  const handleDelete = async (id, staffLoginId) => {
    // Safety check: Don't let the currently logged-in admin delete themselves!
    if (staffLoginId === user.loginId) {
      alert("You cannot delete your own account.");
      return;
    }
    
    if (window.confirm('Are you sure you want to remove this staff access? This cannot be undone.')) {
      await db.staffUsers.delete(id);
    }
  };

  // ── RENDER: ACCESS DENIED ────────────────────────────────────────────────
  if (!isMasterAdmin) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <ShieldCheck size={48} color="#e2e8f0" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Access Restricted</h2>
        <p style={{ color: '#64748b', marginTop: '8px' }}>Only Master Administrators can manage staff credentials.</p>
      </div>
    );
  }

  // ── RENDER: STAFF MANAGEMENT ─────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Title & Add Button */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Staff Administration</h1>
          <p className="page-subtitle">Manage portal login credentials for all staff members</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? <X size={16} /> : <><Plus size={16} /> Add Staff</>}
        </button>
      </div>

      {/* Conditional Form: Create Staff */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1d4ed8' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Create Staff Account</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Provide a unique Login ID and default password (e.g. `1234`).</p>
            </div>
          </div>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              <div>
                <label className="form-label">Full Name *</label>
                <input required className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Ramesh Teacher" />
              </div>
              <div>
                <label className="form-label">Login ID *</label>
                <input required type="text" className="form-input" value={form.loginId} onChange={e => setForm(p => ({ ...p, loginId: e.target.value.replace(/\s/g, '') }))} placeholder="e.g. ramesh.sir" />
              </div>
              <div>
                <label className="form-label">Initial Password *</label>
                <input required type="text" className="form-input" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="e.g. admin123" />
              </div>
              <div>
                <label className="form-label">Role *</label>
                <select required className="form-select" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                  {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                    <option key={roleKey} value={roleKey}>{label}</option>
                  ))}
                </select>
              </div>
              {form.role === 'teacher' && (
                <div>
                  <label className="form-label">Assigned Class (Optional)</label>
                  <select className="form-select" value={form.assignedGrade} onChange={e => setForm(p => ({ ...p, assignedGrade: e.target.value }))}>
                    <option value="">None</option>
                    {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Creating...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Staff Registry Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Login ID</th>
              <th>Role</th>
              <th>Assigned Class</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staffUsers.length === 0 ? (
              <tr>
                <td colSpan={5}>
                  <div className="empty-state">
                    <User size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No staff authorized</div>
                  </div>
                </td>
              </tr>
            ) : staffUsers.map(staff => {
              const roleColor = ROLE_COLORS[staff.role] || ROLE_COLORS.teacher;
              return (
                <tr key={staff.id}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{staff.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} color="#94a3b8" />
                      <span style={{ fontSize: '0.875rem' }}>{staff.loginId}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', background: roleColor.bg, color: roleColor.text, border: `1px solid ${roleColor.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {ROLE_LABELS[staff.role]}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.875rem' }}>
                    {staff.role === 'teacher' ? (staff.assignedGrade ? formatGrade(staff.assignedGrade) : '—') : 'N/A'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {/* Password Reset Action */}
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => setEditModal({ id: staff.id, name: staff.name, loginId: staff.loginId, newPassword: staff.password })}
                        title="Edit Password"
                      >
                        <KeyRound size={15} color="#4f46e5" />
                      </button>
                      
                      {/* Delete Action (Disabled for Self) */}
                      <button 
                        className="btn btn-ghost btn-icon btn-sm" 
                        onClick={() => handleDelete(staff.id, staff.loginId)}
                        title={staff.loginId === user.loginId ? "Cannot delete yourself" : "Delete Account"}
                        disabled={staff.loginId === user.loginId}
                        style={{ opacity: staff.loginId === user.loginId ? 0.3 : 1 }}
                      >
                        <Trash2 size={15} color="#dc2626" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal (Floating Overlay) */}
      {editModal && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Reset Password</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditModal(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleUpdatePassword}>
              <div className="modal-body">
                <div style={{ marginBottom: '16px', fontSize: '0.875rem', color: '#64748b' }}>
                  Updating credentials for <strong>{editModal.name}</strong> ({editModal.loginId})
                </div>
                <div>
                  <label className="form-label">New Password *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={editModal.newPassword}
                    onChange={e => setEditModal(p => ({ ...p, newPassword: e.target.value }))}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                    Warning: Changing this will immediately revoke their current password access.
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
