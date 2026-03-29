import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Plus, X, Calendar, Edit2 } from 'lucide-react';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const PERIODS = [1,2,3,4,5,6,7,8];

export default function Timetable() {
  const { can } = useAuthStore();
  const [selectedGrade, setSelectedGrade] = useState('1');
  const [editCell, setEditCell] = useState(null);
  const [cellForm, setCellForm] = useState({ subject: '', teacherName: '' });
  const [saving, setSaving] = useState(false);

  const canEdit = can('timetable.edit');

  const slots = useLiveQuery(() =>
    db.timetable.where({ grade: selectedGrade }).toArray(),
    [selectedGrade]
  ) || [];

  const teachers = useLiveQuery(() => db.teachers.where({ status: 'Active' }).toArray()) || [];

  // Matrix lookup
  const getSlot = (day, period) => slots.find(s => s.day === day && s.period === period);

  const openEdit = (day, period) => {
    if (!canEdit) return;
    const existing = getSlot(day, period);
    setCellForm({ subject: existing?.subject || '', teacherName: existing?.teacherName || '' });
    setEditCell({ day, period });
  };

  const handleSaveCell = async (e) => {
    e.preventDefault();
    if (!editCell) return;
    setSaving(true);
    try {
      const existing = getSlot(editCell.day, editCell.period);
      if (existing) {
        await db.timetable.update(existing.id, { subject: cellForm.subject, teacherName: cellForm.teacherName });
      } else {
        await db.timetable.add({ grade: selectedGrade, day: editCell.day, period: editCell.period, subject: cellForm.subject, teacherName: cellForm.teacherName });
      }
      setEditCell(null);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (day, period) => {
    const existing = getSlot(day, period);
    if (existing) await db.timetable.delete(existing.id);
    setEditCell(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Timetable</h1>
          <p className="page-subtitle">Weekly schedule grid per class</p>
        </div>
      </div>

      {/* Grade selector */}
      <div className="card" style={{ padding: '14px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Class:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {GRADES.filter(g => !['KG1','KG2','Balvatica'].includes(g)).map(g => (
            <button
              key={g}
              className={selectedGrade === g ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}
              onClick={() => setSelectedGrade(g)}
            >
              {formatGrade(g)}
            </button>
          ))}
        </div>
        {canEdit && <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: '#94a3b8' }}>Click any cell to edit</span>}
      </div>

      {/* Timetable grid */}
      <div className="table-container card">
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
                    <td
                      key={day}
                      onClick={() => openEdit(day, period)}
                      style={{ cursor: canEdit ? 'pointer' : 'default', padding: '10px 12px', transition: 'background 0.15s' }}
                      onMouseEnter={e => { if (canEdit) e.currentTarget.style.background = '#f5f3ff'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; }}
                    >
                      {slot?.subject ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>{slot.subject}</div>
                          {slot.teacherName && <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{slot.teacherName}</div>}
                        </div>
                      ) : (
                        canEdit && <div style={{ color: '#e2e8f0', fontSize: '0.72rem', textAlign: 'center' }}>+ Add</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editCell && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>{editCell.day} — Period {editCell.period} ({formatGrade(selectedGrade)})</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditCell(null)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveCell}>
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
