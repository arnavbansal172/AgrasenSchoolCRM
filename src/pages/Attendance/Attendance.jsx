import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade, computeRollNumbers } from '../../lib/grEngine';
import { Calendar, Lock, Unlock, CheckCircle2, XCircle, CheckSquare, X } from 'lucide-react';

export default function Attendance() {
  const { user, can } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGrade, setSelectedGrade] = useState(
    user?.role === 'teacher' && user?.assignedGrade ? user.assignedGrade : 'KG1'
  );

  const canMark = can('attendance.student.mark');

  // Only show the teacher's assigned grade if they're a teacher
  const availableGrades = user?.role === 'teacher' && user?.assignedGrade
    ? [user.assignedGrade]
    : GRADES;

  const students = useLiveQuery(
    () => db.students.where({ grade: selectedGrade, admissionStatus: 'Active' }).toArray(),
    [selectedGrade]
  ) || [];

  const sortedStudents = computeRollNumbers(students);

  const attendanceRecords = useLiveQuery(
    () => db.attendance.where({ grade: selectedGrade, date: selectedDate }).toArray(),
    [selectedGrade, selectedDate]
  ) || [];

  const lockRecord = useLiveQuery(
    () => db.attendanceLocks.get([selectedGrade, selectedDate]),
    [selectedGrade, selectedDate]
  );
  const isLocked = !!lockRecord?.locked;

  const getStatus = (studentId) =>
    attendanceRecords.find(a => a.studentId === studentId)?.status || 'Pending';

  const markStudent = async (student, newStatus) => {
    if (!canMark) return;
    const existing = attendanceRecords.find(a => a.studentId === student.id);

    // Lock rule: if locked, can only change Absent→Present (not Present→Absent)
    if (isLocked) {
      const currentStatus = getStatus(student.id);
      if (currentStatus === 'Present' && newStatus === 'Absent') return; // blocked
    }

    if (existing) {
      await db.attendance.update(existing.id, { status: newStatus });
    } else {
      await db.attendance.add({ studentId: student.id, grade: selectedGrade, date: selectedDate, status: newStatus });
    }
  };

  const markAllPresent = async () => {
    if (!canMark || isLocked) return;
    for (const s of sortedStudents) {
      const existing = attendanceRecords.find(a => a.studentId === s.id);
      if (existing) {
        await db.attendance.update(existing.id, { status: 'Present' });
      } else {
        await db.attendance.add({ studentId: s.id, grade: selectedGrade, date: selectedDate, status: 'Present' });
      }
    }
  };

  const submitAndLock = async () => {
    if (!canMark) return;
    // Mark all Pending as Absent before locking
    for (const s of sortedStudents) {
      const existing = attendanceRecords.find(a => a.studentId === s.id);
      if (!existing) {
        await db.attendance.add({ studentId: s.id, grade: selectedGrade, date: selectedDate, status: 'Absent' });
      }
    }
    await db.attendanceLocks.put({ 
      grade: selectedGrade, 
      date: selectedDate, 
      locked: true, 
      lockedAt: new Date().toISOString(),
      lockedBy: user.name || 'Admin'
    });
  };

  const presentCount = attendanceRecords.filter(a => a.status === 'Present').length;
  const absentCount  = attendanceRecords.filter(a => a.status === 'Absent').length;
  const pendingCount = sortedStudents.length - presentCount - absentCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance Tracker</h1>
          <p className="page-subtitle">Mark and manage daily student attendance</p>
        </div>
      </div>

      {/* Controls */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={16} color="#94a3b8" />
          <input
            type="date"
            className="form-input"
            style={{ width: 'auto' }}
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Class:</label>
          <select className="form-select" style={{ width: 'auto' }} value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}>
            {availableGrades.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
          </select>
        </div>

        {/* Lock badge */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isLocked ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
              <span className="badge badge-locked">
                <Lock size={11} /> Locked
              </span>
              {lockRecord?.lockedAt && (
                <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                  by {lockRecord.lockedBy || 'Admin'} at {new Date(lockRecord.lockedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                </span>
              )}
            </div>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Unlock size={11} /> Open
            </span>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669', fontFamily: 'Lexend, sans-serif' }}>{presentCount}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Present</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626', fontFamily: 'Lexend, sans-serif' }}>{absentCount}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Absent</div>
        </div>
        <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#94a3b8', fontFamily: 'Lexend, sans-serif' }}>{pendingCount}</div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Pending</div>
        </div>
      </div>

      {/* Action buttons */}
      {canMark && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button className="btn btn-success" onClick={markAllPresent} disabled={isLocked}>
            <CheckSquare size={16} /> Mark All Present
          </button>
          {!isLocked && (
            <button className="btn btn-warning" onClick={submitAndLock}>
              <Lock size={16} /> Submit & Lock
            </button>
          )}
        </div>
      )}

      {isLocked && canMark && (
        <div className="alert alert-warning">
          <Lock size={16} />
          <span><strong>Attendance Locked.</strong> You can still mark absent students as Present (late arrivals), but cannot mark Present students as Absent.</span>
        </div>
      )}

      {/* Student List */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Roll No</th>
              <th>GR No</th>
              <th>Student Name</th>
              <th>Status</th>
              {canMark && <th style={{ textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {sortedStudents.length === 0 ? (
              <tr>
                <td colSpan={canMark ? 5 : 4}>
                  <div className="empty-state">
                    <div className="empty-state-title">No active students in {formatGrade(selectedGrade)}</div>
                    <div className="empty-state-desc">Add and activate students in the Students section first.</div>
                  </div>
                </td>
              </tr>
            ) : sortedStudents.map(student => {
              const status = getStatus(student.id);
              const canMarkAbsent = canMark && (!isLocked || status !== 'Present');
              return (
                <tr key={student.id}>
                  <td style={{ fontWeight: 700, color: '#4f46e5' }}>#{student.rollNo}</td>
                  <td><span className="gr-number">{student.grNo}</span></td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.name}</td>
                  <td>
                    {status === 'Present' && <span className="badge badge-present"><CheckCircle2 size={11} /> Present</span>}
                    {status === 'Absent'  && <span className="badge badge-absent"><XCircle size={11} /> Absent</span>}
                    {status === 'Pending' && <span className="badge badge-pending">Pending</span>}
                  </td>
                  {canMark && (
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => markStudent(student, 'Present')}
                          disabled={status === 'Present'}
                          style={{ opacity: status === 'Present' ? 0.4 : 1 }}
                        >
                          Present
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => markStudent(student, 'Absent')}
                          disabled={!canMarkAbsent || status === 'Absent'}
                          style={{
                            opacity: (!canMarkAbsent || status === 'Absent') ? 0.4 : 1,
                            cursor: isLocked && status === 'Present' ? 'not-allowed' : 'pointer'
                          }}
                          title={isLocked && status === 'Present' ? 'Cannot mark Present as Absent after lock' : ''}
                        >
                          {isLocked && status === 'Present' ? <Lock size={12} /> : null} Absent
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
    </div>
  );
}
