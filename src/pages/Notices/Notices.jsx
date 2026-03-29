import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { Plus, X, Bell, Pin, Trash2 } from 'lucide-react';

export default function Notices() {
  const { can, user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', pinned: false });
  const [saving, setSaving] = useState(false);

  const canPost = can('notices.post');

  const notices = useLiveQuery(() => db.notices.orderBy('postedAt').reverse().toArray()) || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.notices.add({ ...form, postedBy: user?.name || 'Staff', postedAt: new Date().toISOString() });
      setForm({ title: '', body: '', pinned: false });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this notice?')) await db.notices.delete(id);
  };

  const handleTogglePin = async (notice) => {
    await db.notices.update(notice.id, { pinned: !notice.pinned });
  };

  const pinned   = notices.filter(n => n.pinned);
  const unpinned = notices.filter(n => !n.pinned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notice Board</h1>
          <p className="page-subtitle">Staff announcements and important notices</p>
        </div>
        {canPost && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Post Notice</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>New Notice</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '16px' }}>
              <div>
                <label className="form-label">Title *</label>
                <input required className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Notice title..." />
              </div>
              <div>
                <label className="form-label">Body</label>
                <textarea className="form-textarea" style={{ minHeight: '100px' }} value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} placeholder="Notice details..." />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className={`toggle-track ${form.pinned ? 'on' : ''}`} onClick={() => setForm(p => ({ ...p, pinned: !p.pinned }))}>
                  <div className="toggle-thumb" />
                </div>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>Pin to top</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Post Notice</button>
            </div>
          </form>
        </div>
      )}

      {/* Pinned */}
      {pinned.length > 0 && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Pin size={14} /> Pinned Notices
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pinned.map(notice => <NoticeCard key={notice.id} notice={notice} canPost={canPost} onDelete={handleDelete} onTogglePin={handleTogglePin} />)}
          </div>
        </div>
      )}

      {/* All Notices */}
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bell size={14} /> All Notices ({unpinned.length})
        </h3>
        {notices.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <Bell size={32} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
            <div style={{ fontWeight: 600 }}>No notices posted yet</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {unpinned.map(notice => <NoticeCard key={notice.id} notice={notice} canPost={canPost} onDelete={handleDelete} onTogglePin={handleTogglePin} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function NoticeCard({ notice, canPost, onDelete, onTogglePin }) {
  return (
    <div style={{ background: 'white', border: `1px solid ${notice.pinned ? '#fde68a' : '#e2e8f0'}`, borderLeft: `4px solid ${notice.pinned ? '#f59e0b' : '#4f46e5'}`, borderRadius: '12px', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: '4px' }}>{notice.title}</div>
          {notice.body && <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.6, marginBottom: '8px' }}>{notice.body}</div>}
          <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
            Posted by <strong>{notice.postedBy}</strong> · {new Date(notice.postedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        {canPost && (
          <div style={{ display: 'flex', gap: '6px', marginLeft: '10px', flexShrink: 0 }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onTogglePin(notice)} title={notice.pinned ? 'Unpin' : 'Pin'}>
              <Pin size={13} color={notice.pinned ? '#f59e0b' : '#94a3b8'} />
            </button>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(notice.id)} title="Delete">
              <Trash2 size={13} color="#dc2626" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
