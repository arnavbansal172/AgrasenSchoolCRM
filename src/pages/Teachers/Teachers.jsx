import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { Plus, X, GraduationCap, Edit2, UserCheck, Phone, BookOpen } from 'lucide-react';
import { GRADES, formatGrade } from '../../lib/grEngine';

const STATUS_COLORS = {
  Active: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  Inactive: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
};

export default function Teachers() {
  const { can } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', employeeId: '', subject: '', assignedGrade: '', phone: '', basePay: '', status: 'Active' });

  const canAdd  = can('teachers.add');
  const canEdit = can('teachers.edit');

  const teachers = useLiveQuery(() => db.teachers.orderBy('name').toArray()) || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTeacher) {
        await db.teachers.update(editTeacher.id, { ...form, basePay: parseInt(form.basePay) || 0 });
        setEditTeacher(null);
      } else {
        await db.teachers.add({ ...form, basePay: parseInt(form.basePay) || 0, createdAt: new Date().toISOString() });
        setShowForm(false);
      }
      setForm({ name: '', employeeId: '', subject: '', assignedGrade: '', phone: '', basePay: '', status: 'Active' });
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (teacher) => {
    setForm({ name: teacher.name, employeeId: teacher.employeeId || '', subject: teacher.subject || '', assignedGrade: teacher.assignedGrade || '', phone: teacher.phone || '', basePay: teacher.basePay || '', status: teacher.status || 'Active' });
    setEditTeacher(teacher);
  };

  const renderTeacherForm = (onCancel) => (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div>
          <label className="form-label">Full Name *</label>
          <input required className="form-input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Desai" />
        </div>
        <div>
          <label className="form-label">Employee ID (PER SOFTECH)</label>
          <input className="form-input" value={form.employeeId} onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} placeholder="e.g. TCH-8091" />
        </div>
        <div>
          <label className="form-label">Primary Subject</label>
          <input className="form-input" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Mathematics" />
        </div>
        <div>
          <label className="form-label">Assigned Class</label>
          <select className="form-select" value={form.assignedGrade} onChange={e => setForm(p => ({ ...p, assignedGrade: e.target.value }))}>
            <option value="">No class assigned</option>
            {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-input" type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="e.g. 9876543210" />
        </div>
        <div>
          <label className="form-label">Base Pay (₹/month)</label>
          <input className="form-input" type="number" min="0" value={form.basePay} onChange={e => setForm(p => ({ ...p, basePay: e.target.value }))} placeholder="e.g. 18000" />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : (editTeacher ? 'Update Teacher' : 'Enroll Teacher')}
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">{teachers.filter(t => t.status === 'Active').length} active staff members</p>
        </div>
        {canAdd && (
          <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setEditTeacher(null); }}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Enroll Teacher</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>New Teacher Enrollment</h3>
          {renderTeacherForm(() => setShowForm(false))}
        </div>
      )}

      {/* Teacher Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
        {teachers.length === 0 ? (
          <div className="card" style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center' }}>
            <div className="empty-state">
              <GraduationCap size={40} className="empty-state-icon" />
              <div className="empty-state-title">No teachers enrolled</div>
              <div className="empty-state-desc">Use the "Enroll Teacher" button to add staff records.</div>
            </div>
          </div>
        ) : teachers.map(t => {
          const statusColor = STATUS_COLORS[t.status] || STATUS_COLORS.Inactive;
          return (
            <div key={t.id} className="card card-hover" style={{ padding: '20px', position: 'relative' }}>
              {/* Status badge */}
              <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {t.status}
                </span>
              </div>

              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                  <UserCheck size={22} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'Lexend, sans-serif' }}>{t.name}</div>
                  {t.employeeId && (
                    <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', borderRadius: '6px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>
                      {t.employeeId}
                    </span>
                  )}
                </div>
              </div>

              <div className="divider" style={{ margin: '14px 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#475569' }}>
                {t.subject && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BookOpen size={13} color="#94a3b8" />
                    <span>{t.subject}</span>
                  </div>
                )}
                {t.assignedGrade && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <GraduationCap size={13} color="#94a3b8" />
                    <span>Class Teacher: <strong>{formatGrade(t.assignedGrade)}</strong></span>
                  </div>
                )}
                {t.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Phone size={13} color="#94a3b8" />
                    <span>{t.phone}</span>
                  </div>
                )}
                {t.basePay && (
                  <div style={{ fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                    Base Pay: ₹{parseInt(t.basePay).toLocaleString('en-IN')}/month
                  </div>
                )}
              </div>

              {canEdit && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: '14px', width: '100%', justifyContent: 'center' }}
                  onClick={() => openEdit(t)}
                >
                  <Edit2 size={13} /> Edit Profile
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editTeacher && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Edit: {editTeacher.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditTeacher(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {renderTeacherForm(() => setEditTeacher(null))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
