import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { formatGrade, GRADES } from '../../lib/grEngine';
import { X } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const PERIODS = [1,2,3,4,5,6,7,8];

export default function Timetable() {
  const { can } = useAuthStore();
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [slots, setSlots] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editCell, setEditCell] = useState(null);
  const [cellForm, setCellForm] = useState({ subject: '', teacherName: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEdit = can('timetable.edit');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tt, t] = await Promise.all([api.timetable.list(selectedGrade), api.teachers.list()]);
      setSlots(tt);
      setTeachers(t.filter(t => t.status === 'Active'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade]);

  useEffect(() => { load(); }, [load]);

  const getSlot = (day, period) => slots.find(s => s.day === day && s.period === period);

  const openEdit = (day, period) => {
    if (!canEdit) return;
    const existing = getSlot(day, period);
    setCellForm({ subject: existing?.subject || '', teacherName: existing?.teacher_name || '' });
    setEditCell({ day, period });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!editCell) return;
    setSaving(true);
    setError('');
    try {
      await api.timetable.save({ grade: selectedGrade, day: editCell.day, period: editCell.period, subject: cellForm.subject, teacherName: cellForm.teacherName });
      setEditCell(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (day, period) => {
    try {
      await api.timetable.clear(selectedGrade, day, period);
      setEditCell(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Weekly schedule grid per class</p>
        </div>
      </div>

      {error && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', color: '#dc2626', fontSize: '0.875rem' }}>⚠️ {error}</div>}

      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Class:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {GRADES.map(g => (
            <button key={g} className={selectedGrade === g ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'} onClick={() => setSelectedGrade(g)}>
              {formatGrade(g)}
            </button>
          ))}
        </div>
        {canEdit && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8' }}>Click any cell to edit</span>}
      </div>

      <div className="table-container card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>Loading timetable...</div>
        ) : (
          <table className="data-table" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: '70px' }}>Period</th>
                {DAYS.map(day => <th key={day}>{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map(period => (
                <tr key={period}>
                  <td style={{ fontWeight: 700, color: '#4f46e5', textAlign: 'center', background: '#f8fafc' }}>P{period}</td>
                  {DAYS.map(day => {
                    const slot = getSlot(day, period);
                    return (
                      <td key={day} onClick={() => openEdit(day, period)}
                        style={{ cursor: canEdit ? 'pointer' : 'default', padding: '10px 12px', transition: 'background 0.15s' }}
                        onMouseEnter={e => { if (canEdit) e.currentTarget.style.background = '#f5f3ff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                        {slot?.subject ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{slot.subject}</div>
                            {slot.teacher_name && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{slot.teacher_name}</div>}
                          </div>
                        ) : canEdit && <div style={{ color: '#e2e8f0', fontSize: '0.72rem', textAlign: 'center' }}>+ Add</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editCell && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>{editCell.day} — Period {editCell.period} ({formatGrade(selectedGrade)})</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditCell(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label className="form-label">Subject</label>
                  <input className="form-input" value={cellForm.subject} onChange={e => setCellForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Mathematics" autoFocus />
                </div>
                <div>
                  <label className="form-label">Teacher</label>
                  <select className="form-select" value={cellForm.teacherName} onChange={e => setCellForm(p => ({ ...p, teacherName: e.target.value }))}>
                    <option value="">None</option>
                    {teachers.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleClear(editCell.day, editCell.period)}>Clear</button>
                <button type="button" className="btn btn-ghost" onClick={() => setEditCell(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
