import { useState, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Save, Trophy, BookOpen, Search, X } from 'lucide-react';

const SUBJECTS_BY_GRADE = {
  KG1: ['Activity', 'Drawing', 'Rhymes'],
  KG2: ['Activity', 'Drawing', 'Rhymes', 'Basic English'],
  Balvatica: ['Hindi', 'Gujarati', 'English', 'Mathematics', 'EVS'],
  default: ['Hindi', 'Gujarati', 'English', 'Mathematics', 'Science', 'Social Studies', 'General Knowledge'],
};
const getSubjects = (grade) => SUBJECTS_BY_GRADE[grade] || SUBJECTS_BY_GRADE.default;
const TERMS = ['Unit Test 1', 'Term 1', 'Unit Test 2', 'Term 2 (Final)'];
const getGrade = (pct) => {
  if (pct >= 90) return { label: 'A+', color: '#059669' };
  if (pct >= 80) return { label: 'A',  color: '#0284c7' };
  if (pct >= 70) return { label: 'B',  color: '#7c3aed' };
  if (pct >= 60) return { label: 'C',  color: '#d97706' };
  if (pct >= 35) return { label: 'D',  color: '#ea580c' };
  return { label: 'F', color: '#dc2626' };
};

export default function Results() {
  const { can } = useAuthStore();
  const [students, setStudents] = useState([]);
  const [allResults, setAllResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [marks, setMarks] = useState({});
  const [maxMarks, setMaxMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canEnter = can('results.add');

  const load = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([api.students.list(), api.results.list()]);
      setStudents(s.filter(st => st.admission_status === 'Active'));
      setAllResults(r);
    } catch (err) {
      setError('Failed to load: ' + err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredStudents = students.filter(s => {
    const q = searchQuery.toLowerCase();
    return (!searchQuery || s.name.toLowerCase().includes(q) || (s.gr_no && s.gr_no.toLowerCase().includes(q)))
      && (filterGrade === 'All' || s.grade === filterGrade);
  });

  const selectStudent = (student) => {
    setSelectedStudent(student);
    const subs = getSubjects(student.grade);
    const m = {}; const mx = {};
    subs.forEach(s => { m[s] = ''; mx[s] = '100'; });
    setMarks(m); setMaxMarks(mx);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    setError('');
    try {
      const subs = getSubjects(selectedStudent.grade);
      const subjectData = subs.map(sub => ({
        name: sub,
        marks: parseInt(marks[sub]) || 0,
        maxMarks: parseInt(maxMarks[sub]) || 100,
      }));
      const totalObtained = subjectData.reduce((s, x) => s + x.marks, 0);
      const totalMax = subjectData.reduce((s, x) => s + x.maxMarks, 0);

      await api.results.save({
        studentId: selectedStudent.id,
        grade: selectedStudent.grade,
        term: selectedTerm,
        subjects: subjectData,
        total: totalObtained,
        date: new Date().toISOString().split('T')[0],
      });
      setSelectedStudent(null);
      await load();
    } catch (err) {
      setError('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const studentResults = (id) => allResults.filter(r => r.student_id === id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Marksheets</h1>
          <p className="page-subtitle">Enter and review academic performance by term</p>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 16px', color: '#dc2626', fontSize: '0.875rem' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>
        {/* Student Selector */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.95rem' }}>
            <Search size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#4f46e5' }} />
            Select Student
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <input className="form-input" placeholder="Search name or GR..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <select className="form-select" value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="All">All Grades</option>
              {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '480px', overflowY: 'auto' }}>
            {filteredStudents.map(s => {
              const res = studentResults(s.id);
              return (
                <button key={s.id} onClick={() => selectStudent(s)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', textAlign: 'left',
                  border: selectedStudent?.id === s.id ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                  background: selectedStudent?.id === s.id ? '#eef2ff' : '#fafafa',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.gr_no} · {formatGrade(s.grade)}</span>
                    {res.length > 0 && <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>{res.length} result{res.length !== 1 ? 's' : ''}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entry Panel */}
        <div>
          {selectedStudent ? (
            <div className="card animate-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedStudent.name}</h3>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{selectedStudent.gr_no} · {formatGrade(selectedStudent.grade)}</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select className="form-select" style={{ width: 'auto' }} value={selectedTerm} onChange={e => setSelectedTerm(e.target.value)}>
                    {TERMS.map(t => <option key={t}>{t}</option>)}
                  </select>
                  <button className="btn btn-ghost btn-icon" onClick={() => setSelectedStudent(null)}><X size={16} /></button>
                </div>
              </div>

              {canEnter ? (
                <form onSubmit={handleSave}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px' }}>
                    {getSubjects(selectedStudent.grade).map(subject => (
                      <div key={subject} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px' }}>
                        <label className="form-label" style={{ marginBottom: '8px' }}>{subject}</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <input type="number" className="form-input" placeholder="Marks" value={marks[subject] || ''}
                            onChange={e => setMarks(p => ({ ...p, [subject]: e.target.value }))} min="0" />
                          <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem' }}>/ </span>
                          <input type="number" className="form-input" style={{ width: '70px' }}
                            placeholder="Max" value={maxMarks[subject] || '100'}
                            onChange={e => setMaxMarks(p => ({ ...p, [subject]: e.target.value }))} min="1" />
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const subs = getSubjects(selectedStudent.grade);
                    const tot = subs.reduce((s, sub) => s + (parseInt(marks[sub]) || 0), 0);
                    const mx = subs.reduce((s, sub) => s + (parseInt(maxMarks[sub]) || 100), 0);
                    const pct = mx > 0 ? Math.round((tot / mx) * 100) : 0;
                    const g = getGrade(pct);
                    return (
                      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Lexend, sans-serif' }}>{tot} / {mx}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: g.color, fontFamily: 'Lexend, sans-serif' }}>{g.label}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{pct}%</div>
                        </div>
                      </div>
                    );
                  })()}
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-ghost" onClick={() => setSelectedStudent(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      <Save size={16} /> {saving ? 'Saving...' : 'Save Result'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="alert alert-info">You do not have permission to enter results.</div>
              )}

              {studentResults(selectedStudent.id).length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>Past Results</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentResults(selectedStudent.id).map(r => {
                      const pct = r.total ? Math.round((r.total / (r.total + 1)) * 100) : 0;
                      return (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.term}</span>
                            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>{r.date}</span>
                          </div>
                          <span style={{ fontWeight: 700, color: '#4f46e5' }}>Total: {r.total}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
              <BookOpen size={48} color="#e2e8f0" />
              <p style={{ fontWeight: 600, color: '#94a3b8' }}>Select a student to enter results</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
