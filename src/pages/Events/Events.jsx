import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { CalendarDays, Plus, X, Trash2 } from 'lucide-react';

export default function Events() {
  const { can } = useAuthStore();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().split('T')[0], description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canManage = can('events.manage');

  const load = useCallback(async () => {
    try {
      const data = await api.events.list();
      setEvents([...data].sort((a, b) => new Date(a.date) - new Date(b.date)));
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.events.create(form);
      setForm({ title: '', date: new Date().toISOString().split('T')[0], description: '' });
      setShowForm(false);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this event?')) return;
    try { await api.events.delete(id); await load(); }
    catch (err) { setError(err.message); }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const upcoming = events.filter(e => e.date >= todayStr);
  const past     = events.filter(e => e.date < todayStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">School Events</h1>
          <p className="page-subtitle">{upcoming.length} upcoming · {past.length} past</p>
        </div>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Add Event</>}
          </button>
        )}
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '0.875rem' }}>⚠️ {error}</div>}

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '14px' }}>
              <div>
                <label className="form-label">Event Title *</label>
                <input required className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Annual Sports Day" />
              </div>
              <div>
                <label className="form-label">Date *</label>
                <input required type="date" className="form-input" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="form-label">Description</label>
              <textarea className="form-textarea" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Details..." rows={2} />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Event'}</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Loading...</div>
      ) : (
        <>
          {upcoming.length === 0 && past.length === 0 && (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <CalendarDays size={32} color="#e2e8f0" style={{ marginBottom: '12px' }} />
              <div style={{ color: '#94a3b8', fontWeight: 600 }}>No events scheduled</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Upcoming</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcoming.map(ev => (
                  <div key={ev.id} className="card" style={{ padding: '16px 20px', display: 'flex', gap: '16px', alignItems: 'center', borderLeft: ev.date === todayStr ? '4px solid #4f46e5' : '4px solid transparent' }}>
                    <div style={{ background: ev.date === todayStr ? '#eef2ff' : '#f1f5f9', borderRadius: '10px', padding: '8px 12px', textAlign: 'center', minWidth: '52px', flexShrink: 0 }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>{new Date(ev.date + 'T00:00').toLocaleDateString('en-IN', { month: 'short' })}</div>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, color: ev.date === todayStr ? '#4f46e5' : '#1e293b', fontFamily: 'Lexend, sans-serif' }}>{new Date(ev.date + 'T00:00').getDate()}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{ev.title}</div>
                      {ev.description && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>{ev.description}</div>}
                      {ev.date === todayStr && <span style={{ fontSize: '0.65rem', fontWeight: 800, background: '#eef2ff', color: '#4f46e5', borderRadius: '999px', padding: '2px 8px', marginTop: '4px', display: 'inline-block' }}>TODAY</span>}
                    </div>
                    {canManage && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(ev.id)} style={{ color: '#dc2626', flexShrink: 0 }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Past Events</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[...past].reverse().map(ev => (
                  <div key={ev.id} className="card" style={{ padding: '12px 20px', display: 'flex', gap: '16px', alignItems: 'center', opacity: 0.7 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#94a3b8', minWidth: '80px' }}>{new Date(ev.date + 'T00:00').toLocaleDateString('en-IN')}</div>
                    <div style={{ fontWeight: 600, color: '#475569', flex: 1 }}>{ev.title}</div>
                    {canManage && (
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleDelete(ev.id)} style={{ color: '#dc2626' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
