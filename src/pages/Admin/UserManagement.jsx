import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore, ROLE_LABELS, ROLE_COLORS } from '../../store/authStore';
import { Plus, X, Edit2, Shield, User, UserCheck, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react';

/*
  USER MANAGEMENT PAGE
  Super Admin only — Create, edit, and deactivate staff login accounts.
  Assign roles: super_admin, admin, teacher, viewer.
*/

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin', desc: 'Full system access — everything' },
  { value: 'admin',       label: 'Admin',       desc: 'Fees, attendance, management' },
  { value: 'teacher',     label: 'Teacher',     desc: 'Class, students, attendance' },
  { value: 'viewer',      label: 'Viewer',      desc: 'Read-only access to all modules' },
];

function UserForm({ user, teachers, onSave, onCancel }) {
  const [form, setForm] = useState({
    loginId: user?.login_id || '',
    name: user?.name || '',
    role: user?.role || 'viewer',
    password: '',
    confirmPassword: '',
    teacherId: user?.teacher_id || '',
    isActive: user?.is_active !== false,
  });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const isEdit = !!user;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isEdit && !form.password) { setError('Password is required for new accounts.'); return; }
    if (form.password && form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (form.password && form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    
    setSaving(true);
    setError('');
    try {
      const payload = {
        loginId: form.loginId,
        name: form.name,
        role: form.role,
        teacherId: form.role === 'teacher' ? (form.teacherId || null) : null,
        isActive: form.isActive,
        ...(form.password ? { password: form.password, newPassword: form.password } : {}),
      };
      await onSave(payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {error && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', color: '#dc2626', fontSize: '0.85rem', fontWeight: 600 }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label className="form-label">Login ID *</label>
          <input required className="form-input" value={form.loginId}
            onChange={e => setForm(p => ({ ...p, loginId: e.target.value.toLowerCase().replace(/\s/g, '') }))}
            placeholder="e.g. priya.teacher" disabled={isEdit} />
          {isEdit && <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>Login ID cannot be changed.</p>}
        </div>
        <div>
          <label className="form-label">Full Name *</label>
          <input required className="form-input" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Sharma" />
        </div>
      </div>

      {/* Role Selection */}
      <div>
        <label className="form-label">Role *</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
          {ROLE_OPTIONS.map(r => {
            const rc = ROLE_COLORS[r.value];
            const isSelected = form.role === r.value;
            return (
              <button
                key={r.value} type="button"
                onClick={() => setForm(p => ({ ...p, role: r.value }))}
                style={{
                  padding: '10px 12px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer',
                  border: isSelected ? `2px solid ${rc.text}` : '2px solid #e2e8f0',
                  background: isSelected ? rc.bg : 'white',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isSelected ? rc.text : '#1e293b' }}>{r.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>{r.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Link teacher account to teacher record */}
      {form.role === 'teacher' && (
        <div>
          <label className="form-label">Link to Teacher Record (Optional)</label>
          <select className="form-select" value={form.teacherId}
            onChange={e => setForm(p => ({ ...p, teacherId: e.target.value }))}>
            <option value="">— Not linked —</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name} ({t.employee_id || 'No ID'})</option>)}
          </select>
          <p style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
            Linking allows teacher to see attendance for their assigned class only.
          </p>
        </div>
      )}

      {/* Password */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <label className="form-label">{isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label>
          <div style={{ position: 'relative' }}>
            <input className="form-input" type={showPass ? 'text' : 'password'}
              value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder={isEdit ? '(unchanged)' : 'Min 6 characters'}
              style={{ paddingRight: '40px' }} />
            <button type="button" onClick={() => setShowPass(s => !s)}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type={showPass ? 'text' : 'password'}
            value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
            placeholder="Repeat password" />
        </div>
      </div>

      {isEdit && (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          <input type="checkbox" checked={form.isActive}
            onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} />
          Account is Active (uncheck to disable login)
        </label>
      )}

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : (isEdit ? 'Update Account' : 'Create Account')}
        </button>
      </div>
    </form>
  );
}

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);

  const load = async () => {
    try {
      const [u, t] = await Promise.all([api.users.list(), api.teachers.list()]);
      setUsers(u);
      setTeachers(t);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (data) => {
    await api.users.create(data);
    setShowForm(false);
    await load();
  };

  const handleUpdate = async (data) => {
    await api.users.update(editUser.id, data);
    setEditUser(null);
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">User Management</h1>
          <p className="page-subtitle">{users.length} staff accounts · {users.filter(u => u.is_active).length} active</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setEditUser(null); }}>
          {showForm ? <X size={16} /> : <><Plus size={16} /> New Account</>}
        </button>
      </div>

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} color="#4f46e5" /> Create Staff Account
          </h3>
          <UserForm teachers={teachers} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Loading accounts...</div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login ID</th>
                <th>Role</th>
                <th>Linked Teacher</th>
                <th>Status</th>
                <th>Last Login</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.viewer;
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: rc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <User size={15} color={rc.text} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.875rem' }}>{u.name}</div>
                          {isSelf && <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 700 }}>You</div>}
                        </div>
                      </div>
                    </td>
                    <td><code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontSize: '0.82rem' }}>{u.login_id}</code></td>
                    <td>
                      <span style={{ background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '0.72rem', fontWeight: 800 }}>
                        {ROLE_LABELS[u.role] || u.role}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#475569' }}>{u.teacher_name || '—'}</td>
                    <td>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: u.is_active ? '#ecfdf5' : '#fef2f2', color: u.is_active ? '#059669' : '#dc2626' }}>
                        {u.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-IN') : 'Never'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditUser(u)}>
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit modal */}
      {editUser && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Edit Account: {editUser.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditUser(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <UserForm user={editUser} teachers={teachers} onSave={handleUpdate} onCancel={() => setEditUser(null)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
