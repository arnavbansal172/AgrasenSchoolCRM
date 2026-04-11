import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Bell, Pin, Plus, X, Trash2 } from 'lucide-react';

export default function Notices() {
  const { user, can } = useAuthStore();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', pinned: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canPost = can('notices.post');

  const load = useCallback(async () => {
    try {
      const data = await api.notices.list();
      setNotices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.notices.create({ title: form.title, content: form.content, pinned: form.pinned, postedBy: user?.name });
      setForm({ title: '', content: '', pinned: false });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this notice?')) return;
    try {
      await api.notices.delete(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Notice Board</h1>
          <p className="page-subtitle">{notices.length} notices · {notices.filter(n => n.pinned).length} pinned</p>
        </div>
        {canPost && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Post Notice</>}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '0.875rem' }}>⚠️ {error}</div>}

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label className="form-label">Title *</label>
              <input required className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Notice title" />
            </div>
            <div>
              <label className="form-label">Content</label>
              <textarea className="form-textarea" value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} placeholder="Notice details..." rows={3} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
              <input type="checkbox" checked={form.pinned} onChange={e => setForm(p => ({ ...p, pinned: e.target.checked }))} />
              Pin to top
            </label>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Posting...' : 'Post Notice'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Loading notices...</div>
      ) : notices.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Bell size={32} color="#e2e8f0" style={{ marginBottom: '12px' }} />
          <div style={{ color: '#94a3b8', fontWeight: 600 }}>No notices posted yet</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notices.map(notice => (
            <div key={notice.id} className="card" style={{ padding: '20px', borderLeft: notice.pinned ? '4px solid #f59e0b' : '4px solid transparent', display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {notice.pinned && <Pin size={16} color="#f59e0b" style={{ flexShrink: 0, marginTop: '2px' }} />}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '6px' }}>{notice.title}</div>
                {notice.content && <div style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.6 }}>{notice.content}</div>}
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '8px' }}>
                  Posted by {notice.posted_by} · {new Date(notice.posted_at).toLocaleDateString('en-IN')}
                </div>
              </div>
              {canPost && (
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(notice.id)} style={{ color: '#dc2626' }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
