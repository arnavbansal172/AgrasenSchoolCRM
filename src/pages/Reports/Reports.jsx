import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Download, FileBarChart2, Users, IndianRupee, UserCheck, CheckSquare } from 'lucide-react';

export default function Reports() {
  const { can } = useAuthStore();
  const canExport = can('reports.export');

  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [sum, sts] = await Promise.all([api.reports.summary(), api.students.list()]);
        setSummary(sum);
        setStudents(sts);
      } catch (err) {
        console.error('Reports load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeStudents = students.filter(s => s.admission_status === 'Active');
  const gradeCount = {};
  activeStudents.forEach(s => { gradeCount[s.grade] = (gradeCount[s.grade] || 0) + 1; });

  // CSV export helper (client-side, from API data)
  const toCSV = (data, filename) => {
    if (!data?.length) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportStudents = () => toCSV(students.map(s => ({
    GR_No: s.gr_no || 'Pending', Name: s.name, Grade: s.grade, Status: s.admission_status,
    Parent: s.parent_name || '', Phone: s.phone || '',
  })), 'savm_students.csv');

  if (loading) return <div style={{ textAlign: 'center', padding: '64px', color: '#94a3b8' }}>Loading reports...</div>;

  const cards = [
    { label: 'Total Students',  value: students.length, sub: `${activeStudents.length} active`, icon: Users, color: '#4f46e5', bg: '#eef2ff' },
    { label: 'Fees Collected',  value: `₹${(parseInt(summary?.feesThisYear) || 0).toLocaleString('en-IN')}`, icon: IndianRupee, color: '#059669', bg: '#ecfdf5' },
    { label: 'Active Teachers', value: summary?.teachers?.find(t => t.status === 'Active')?.count || 0, icon: UserCheck, color: '#7c3aed', bg: '#f5f3ff' },
    { label: 'Present Today',   value: summary?.teachersPresentToday || 0, icon: CheckSquare, color: '#0284c7', bg: '#eff6ff' },
    { label: 'Total Results',   value: summary?.resultsCount || 0, icon: FileBarChart2, color: '#d97706', bg: '#fffbeb' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="page-subtitle">Insights and data exports</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px' }}>
        {cards.map(card => {
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

      {/* Exports */}
      {canExport && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '4px', fontSize: '0.95rem' }}>Export Data (CSV)</h3>
          <p style={{ fontSize: '0.82rem', color: '#94a3b8', marginBottom: '16px' }}>Download data for backup or use in other software.</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={exportStudents} style={{ border: '1.5px solid #e2e8f0' }}>
              <Download size={14} color="#4f46e5" /> Export Students ({students.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
