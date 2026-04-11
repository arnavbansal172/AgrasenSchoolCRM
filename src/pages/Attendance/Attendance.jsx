import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade, computeRollNumbers } from '../../lib/grEngine';
import { Calendar, Lock, Unlock, CheckCircle2, XCircle, CheckSquare, RefreshCw } from 'lucide-react';

/*
  STUDENT ATTENDANCE — v2.0 (PostgreSQL API)
  Teacher marks daily attendance from their class on WiFi.
*/
export default function Attendance() {
  const { user, can } = useAuthStore();
  const todayStr = new Date().toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedGrade, setSelectedGrade] = useState(
    user?.teacherId ? '' : 'KG1'  // teacher sees their linked grade; will be set after load
  );
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState({}); // { studentId: 'Present'|'Absent' }
  const [isLocked, setIsLocked] = useState(false);
  const [lockedMeta, setLockedMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canMark = can('attendance.mark');

  // For teacher role, restrict to their linked grade
  const availableGrades = GRADES;

  // ── Load students and attendance for selected grade+date ─────────────────
  const loadData = useCallback(async () => {
    if (!selectedGrade) return;
    setLoading(true);
    setError('');
    try {
      const [allStudents, attRecords, locks] = await Promise.all([
        api.students.list(),
        api.attendance.list({ grade: selectedGrade, date: selectedDate }),
        api.attendance.getLocks(),
      ]);

      const gradeStudents = allStudents
        .filter(s => s.grade === selectedGrade && s.admission_status === 'Active');
      setStudents(computeRollNumbers(gradeStudents));

      // Build quick lookup map: studentId -> status
      const map = {};
      attRecords.forEach(r => { map[r.student_id] = r.status; });
      setRecords(map);

      // Check lock
      const lock = locks.find(l => l.grade === selectedGrade && l.date === selectedDate);
      setIsLocked(!!lock);
      setLockedMeta(lock || null);
    } catch (err) {
      setError('Failed to load attendance: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Mark single student ───────────────────────────────────────────────────
  const markStudent = async (student, newStatus) => {
    if (!canMark) return;
    const currentStatus = records[student.id];
    // Lock rule: can only make absent→present (late arrival), not present→absent
    if (isLocked && currentStatus === 'Present' && newStatus === 'Absent') return;
    if (currentStatus === newStatus) return;

    setSaving(true);
    try {
      await api.attendance.bulkSave([{
        studentId: student.id, grade: selectedGrade,
        date: selectedDate, status: newStatus,
      }]);
      setRecords(prev => ({ ...prev, [student.id]: newStatus }));
    } catch (err) {
      setError('Could not save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Mark all present ──────────────────────────────────────────────────────
  const markAllPresent = async () => {
    if (!canMark || isLocked) return;
    setSaving(true);
    try {
      const allRecords = students.map(s => ({
        studentId: s.id, grade: selectedGrade, date: selectedDate, status: 'Present',
      }));
      await api.attendance.bulkSave(allRecords);
      const map = {};
      students.forEach(s => { map[s.id] = 'Present'; });
      setRecords(map);
    } catch (err) {
      setError('Could not mark all present: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Submit & Lock ─────────────────────────────────────────────────────────
  const submitAndLock = async () => {
    if (!canMark) return;
    setSaving(true);
    try {
      // Mark all unmarked students as Absent
      const unmarked = students.filter(s => !records[s.id]);
      if (unmarked.length > 0) {
        const absentRecords = unmarked.map(s => ({
          studentId: s.id, grade: selectedGrade, date: selectedDate, status: 'Absent',
        }));
        await api.attendance.bulkSave(absentRecords);
        const updated = { ...records };
        unmarked.forEach(s => { updated[s.id] = 'Absent'; });
        setRecords(updated);
      }
      // Lock this grade+date
      await api.attendance.lock(selectedGrade, selectedDate);
      setIsLocked(true);
    } catch (err) {
      setError('Could not submit: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(records).filter(s => s === 'Present').length;
  const absentCount  = Object.values(records).filter(s => s === 'Absent').length;
  const pendingCount = students.length - presentCount - absentCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracker</h1>
          <p className="page-subtitle">Mark daily student attendance</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem', fontWeight: 600 }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="#94a3b8" />
          <input type="date" className="form-input" style={{ width: 'auto' }}
            value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Class:</label>
          <select className="form-select" style={{ width: 'auto' }}
            value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
            {availableGrades.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          {isLocked ? (
            <span className="badge badge-locked" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> Locked
              {lockedMeta?.locked_at && <span style={{ fontSize: '0.65rem', opacity: 0.8, marginLeft: '4px' }}>
                {new Date(lockedMeta.locked_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
              </span>}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
              <Unlock size={11} /> Open
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        {[
          { label: 'Present', count: presentCount, color: '#059669' },
          { label: 'Absent',  count: absentCount,  color: '#dc2626' },
          { label: 'Pending', count: pendingCount,  color: '#94a3b8' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, fontFamily: 'Lexend, sans-serif' }}>{s.count}</div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      {canMark && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={markAllPresent} disabled={isLocked || saving}>
            <CheckSquare size={16} /> Mark All Present
          </button>
          {!isLocked && students.length > 0 && (
            <button className="btn btn-warning" onClick={submitAndLock} disabled={saving}>
              <Lock size={16} /> {saving ? 'Saving...' : 'Submit & Lock'}
            </button>
          )}
        </div>
      )}

      {isLocked && canMark && (
        <div className="alert alert-warning">
          <Lock size={16} />
          <span><strong>Attendance Locked.</strong> You can still mark absent students as Present (late arrivals).</span>
        </div>
      )}

      {/* Student Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll</th>
              <th>GR No</th>
              <th>Student Name</th>
              <th>Status</th>
              {canMark && <th style={{ textAlign: 'right' }}>Mark</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5}><div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} /><br/>Loading...
              </div></td></tr>
            ) : students.length === 0 ? (
              <tr><td colSpan={5}><div className="empty-state">
                <div className="empty-state-title">No active students in {formatGrade(selectedGrade)}</div>
                <div className="empty-state-desc">Add and activate students in the Students section.</div>
              </div></td></tr>
            ) : students.map(student => {
              const status = records[student.id] || 'Pending';
              const canMarkAbsent = canMark && (!isLocked || status !== 'Present');
              return (
                <tr key={student.id}>
                  <td style={{ fontWeight: 700, color: '#4f46e5' }}>#{student.rollNo}</td>
                  <td><span className="gr-number">{student.gr_no}</span></td>
                  <td style={{ fontWeight: 600 }}>{student.name}</td>
                  <td>
                    {status === 'Present' && <span className="badge badge-present"><CheckCircle2 size={11} /> Present</span>}
                    {status === 'Absent'  && <span className="badge badge-absent"><XCircle size={11} /> Absent</span>}
                    {status === 'Pending' && <span className="badge badge-pending">Pending</span>}
                  </td>
                  {canMark && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-success btn-sm"
                          onClick={() => markStudent(student, 'Present')}
                          disabled={status === 'Present' || saving}
                          style={{ opacity: status === 'Present' ? 0.4 : 1 }}>
                          P
                        </button>
                        <button className="btn btn-ghost btn-sm"
                          onClick={() => markStudent(student, 'Absent')}
                          disabled={!canMarkAbsent || status === 'Absent' || saving}
                          style={{ opacity: (!canMarkAbsent || status === 'Absent') ? 0.4 : 1 }}
                          title={isLocked && status === 'Present' ? 'Cannot mark Present→Absent after lock' : ''}>
                          {isLocked && status === 'Present' ? <Lock size={12} /> : null} A
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
