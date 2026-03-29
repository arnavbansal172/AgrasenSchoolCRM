import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { Plus, X, CalendarDays, Trash2 } from 'lucide-react';

export default function Events() {
  const { can, user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', title: '', description: '' });
  const [saving, setSaving] = useState(false);

  const canCreate = can('events.create');

  const todayStr = new Date().toISOString().split('T')[0];
  const events   = useLiveQuery(() => db.events.orderBy('date').toArray()) || [];

  const upcoming = events.filter(e => e.date >= todayStr);
  const past     = events.filter(e => e.date < todayStr);

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.events.add({ ...form, createdBy: user?.name, createdAt: new Date().toISOString() });
      setForm({ date: '', title: '', description: '' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this event?')) await db.events.delete(id);
  };

  const EventCard = ({ event }) => {
    const isToday = event.date === todayStr;
    return (
      <div key={event.id} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '14px 16px', background: isToday ? '#eef2ff' : 'white', borderRadius: '12px', border: `1px solid ${isToday ? '#c7d2fe' : '#e2e8f0'}` }}>
        <div style={{ background: isToday ? '#4f46e5' : '#f8fafc', border: `1px solid ${isToday ? '#4f46e5' : '#e2e8f0'}`, borderRadius: '12px', padding: '8px 12px', textAlign: 'center', minWidth: '52px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: isToday ? 'rgba(255,255,255,0.7)' : '#94a3b8', textTransform: 'uppercase' }}>
            {new Date(event.date).toLocaleDateString('en-IN', { month: 'short' })}
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: isToday ? 'white' : '#1e293b', fontFamily: 'Lexend, sans-serif', lineHeight: 1.1 }}>
            {new Date(event.date).getDate()}
          </div>
          <div style={{ fontSize: '0.6rem', fontWeight: 700, color: isToday ? 'rgba(255,255,255,0.7)' : '#94a3b8' }}>
            {new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short' }).toUpperCase()}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              {isToday && <span style={{ display: 'inline-block', background: '#4f46e5', color: 'white', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 8px', marginBottom: '4px' }}>TODAY</span>}
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{event.title}</div>
              {event.description && <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '3px' }}>{event.description}</div>}
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '6px' }}>Added by {event.createdBy}</div>
            </div>
            {canCreate && (
              <button className="btn btn-ghost btn-icon" onClick={() => handleDelete(event.id)} title="Delete event">
                <Trash2 size={14} color="#dc2626" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Events Calendar</h1>
          <p className="page-subtitle">Full-day events override the regular timetable and appear on the dashboard</p>
        </div>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Add Event</>}
          </button>
        )}
      </div>

      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>New Event</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Date *</label>
                <input required className="form-input" type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Event Title *</label>
                <input required className="form-input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Independence Day" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional note" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Add Event</button>
            </div>
          </form>
        </div>
      )}

      {/* Upcoming */}
      <div>
        <h3 style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
          <CalendarDays size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
          Upcoming Events ({upcoming.length})
        </h3>
        {upcoming.length === 0
          ? <div className="card" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>No upcoming events scheduled.</div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{upcoming.map(e => <EventCard key={e.id} event={e} />)}</div>
        }
      </div>

      {past.length > 0 && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '12px', fontSize: '0.95rem', color: '#94a3b8' }}>Past Events ({past.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.6 }}>{past.reverse().slice(0, 5).map(e => <EventCard key={e.id} event={e} />)}</div>
        </div>
      )}
    </div>
  );
}
