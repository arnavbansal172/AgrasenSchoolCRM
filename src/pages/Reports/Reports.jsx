import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Download, FileBarChart2, Users, IndianRupee, UserCheck, CheckSquare } from 'lucide-react';

export default function Reports() {
  const { can } = useAuthStore();
  const canExport = can('reports.export');

  const students    = useLiveQuery(() => db.students.toArray()) || [];
  const teachers    = useLiveQuery(() => db.teachers.toArray()) || [];
  const feePayments = useLiveQuery(() => db.feePayments.toArray()) || [];
  const attendance  = useLiveQuery(() => db.attendance.toArray()) || [];
  const results     = useLiveQuery(() => db.results.toArray()) || [];

  const activeStudents = students.filter(s => s.admissionStatus === 'Active');
  const totalFees = feePayments.reduce((s, f) => s + (parseInt(f.amount) || 0), 0);
  const todayStr  = new Date().toISOString().split('T')[0];
  const todayPresent = attendance.filter(a => a.date === todayStr && a.status === 'Present').length;

  // Grade breakdown
  const gradeCount = {};
  activeStudents.forEach(s => { gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1; });

  // Export helpers
  const toCSV = (data, filename) => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows    = data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv     = [headers, ...rows].join('\n');
    const blob    = new Blob([csv], { type: 'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportStudents  = () => toCSV(students.map(s => ({ GR_No: s.grNo || 'Pending', Name: s.name, Grade: s.grade, Status: s.admissionStatus, Parent: s.parentName || '', Phone: s.phone || '', DOB: s.dob || '', Admitted: s.createdAt?.split('T')[0] || '' })), 'students.csv');
  const exportFees      = () => toCSV(feePayments.map(f => ({ Receipt: f.receiptNo, StudentId: f.studentId, FeeType: f.feeType, Amount: f.amount, Method: f.method, Date: f.date })), 'fees.csv');
  const exportAttendance = () => toCSV(attendance.map(a => ({ StudentId: a.studentId, Grade: a.grade, Date: a.date, Status: a.status })), 'attendance.csv');
  const exportResults   = () => toCSV(results.map(r => ({ StudentId: r.studentId, Grade: r.grade, Term: r.term, Total: r.total, MaxTotal: r.maxTotal, Percent: r.percent, Date: r.date?.split('T')[0] || '' })), 'results.csv');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Insights and data exports for the school</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        {[
          { label: 'Total Students', value: students.length, sub: `${activeStudents.length} active`, icon: Users, color: '#4f46e5', bg: '#eef2ff' },
          { label: 'Fees Collected', value: `₹${totalFees.toLocaleString('en-IN')}`, icon: IndianRupee, color: '#059669', bg: '#ecfdf5' },
          { label: 'Active Teachers', value: teachers.filter(t => t.status === 'Active').length, icon: UserCheck, color: '#7c3aed', bg: '#f5f3ff' },
          { label: 'Present Today', value: todayPresent, icon: CheckSquare, color: '#0284c7', bg: '#eff6ff' },
          { label: 'Total Results', value: results.length, icon: FileBarChart2, color: '#d97706', bg: '#fffbeb' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color, flexShrink: 0 }}>
                <Icon size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{card.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: card.color, fontFamily: 'Lexend, sans-serif' }}>{card.value}</div>
                {card.sub && <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{card.sub}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Grade Breakdown */}
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '16px', fontSize: '0.95rem' }}>Active Students by Grade</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '10px' }}>
          {GRADES.map(g => (
            <div key={g} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', textAlign: 'center', border: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>{formatGrade(g)}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5', fontFamily: 'Lexend, sans-serif' }}>{gradeCount[g] || 0}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Export Panel */}
      {canExport && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '4px', fontSize: '0.95rem' }}>Export Data (CSV)</h3>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '16px' }}>Download all data for backup or use in other software.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Students', count: students.length, fn: exportStudents, color: '#4f46e5' },
              { label: 'Fee Records', count: feePayments.length, fn: exportFees, color: '#059669' },
              { label: 'Attendance', count: attendance.length, fn: exportAttendance, color: '#0284c7' },
              { label: 'Results', count: results.length, fn: exportResults, color: '#d97706' },
            ].map(exp => (
              <button
                key={exp.label}
                onClick={exp.fn}
                className="btn btn-ghost"
                style={{ justifyContent: 'space-between', border: '1.5px solid #e2e8f0' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Download size={14} color={exp.color} />
                  {exp.label}
                </span>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 700 }}>{exp.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
