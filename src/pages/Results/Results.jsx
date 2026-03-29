import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { GRADES, formatGrade } from '../../lib/grEngine';
import { Plus, Search, Save, Trophy, BookOpen, X } from 'lucide-react';

const SUBJECTS_BY_GRADE = {
  KG1: ['Activity', 'Drawing', 'Rhymes'],
  KG2: ['Activity', 'Drawing', 'Rhymes', 'Basic English'],
  Balvatica: ['Hindi', 'Gujarati', 'English', 'Mathematics', 'EVS'],
  default: ['Hindi', 'Gujarati', 'English', 'Mathematics', 'Science', 'Social Studies', 'General Knowledge'],
};

const getSubjects = (grade) => SUBJECTS_BY_GRADE[grade] || SUBJECTS_BY_GRADE.default;

const TERMS = ['Unit Test 1', 'Term 1', 'Unit Test 2', 'Term 2 (Final)'];

const getGrade = (percent) => {
  if (percent >= 90) return { label: 'A+', color: '#059669' };
  if (percent >= 80) return { label: 'A',  color: '#0284c7' };
  if (percent >= 70) return { label: 'B',  color: '#7c3aed' };
  if (percent >= 60) return { label: 'C',  color: '#d97706' };
  if (percent >= 35) return { label: 'D',  color: '#ea580c' };
  return { label: 'F', color: '#dc2626' };
};

export default function Results() {
  const { can } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('All');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedTerm, setSelectedTerm] = useState('Term 1');
  const [marks, setMarks] = useState({});
  const [maxMarks, setMaxMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewResultStudent, setViewResultStudent] = useState(null);

  const canEnter = can('results.enter');

  const students = useLiveQuery(() => db.students.where({ admissionStatus: 'Active' }).toArray()) || [];
  const allResults = useLiveQuery(() => db.results.toArray()) || [];

  const filteredStudents = students.filter(s => {
    const matchSearch = !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || (s.grNo && s.grNo.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchGrade  = filterGrade === 'All' || s.grade === filterGrade;
    return matchSearch && matchGrade;
  });

  const selectStudent = (student) => {
    setSelectedStudent(student);
    const subjects = getSubjects(student.grade);
    const initMarks = {};
    const initMax = {};
    subjects.forEach(s => { initMarks[s] = ''; initMax[s] = '100'; });
    setMarks(initMarks);
    setMaxMarks(initMax);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedStudent) return;
    setSaving(true);
    try {
      const subjects = getSubjects(selectedStudent.grade);
      const subjectData = {};
      let totalObtained = 0, totalMax = 0;
      subjects.forEach(sub => {
        const obtained = parseInt(marks[sub]) || 0;
        const max      = parseInt(maxMarks[sub]) || 100;
        subjectData[sub] = { obtained, max };
        totalObtained += obtained;
        totalMax += max;
      });
      const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

      await db.results.add({
        studentId: selectedStudent.id,
        grade: selectedStudent.grade,
        term: selectedTerm,
        subjects: subjectData,
        total: totalObtained,
        maxTotal: totalMax,
        percent,
        date: new Date().toISOString(),
      });

      setSelectedStudent(null);
      setMarks({});
    } finally {
      setSaving(false);
    }
  };

  const studentResults = (studentId) => allResults.filter(r => r.studentId === studentId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      <div className="page-header">
        <div>
          <h1 className="page-title">Results & Marksheets</h1>
          <p className="page-subtitle">Enter and review academic performance by term</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', alignItems: 'start' }}>

        {/* Student List */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '14px', fontSize: '0.95rem' }}>
            <Search size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#4f46e5' }} />
            Select Student
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            <input className="form-input" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <select className="form-select" value={filterGrade} onChange={e => setFilterGrade(e.target.value)}>
              <option value="All">All Grades</option>
              {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '480px', overflowY: 'auto' }}>
            {filteredStudents.map(s => {
              const results = studentResults(s.id);
              const isSelected = selectedStudent?.id === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '10px 12px', borderRadius: '10px', border: isSelected ? '2px solid #4f46e5' : '1px solid #e2e8f0', background: isSelected ? '#eef2ff' : '#fafafa', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{s.name}</span>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '3px' }}>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{s.grNo} · {formatGrade(s.grade)}</span>
                    {results.length > 0 && <span style={{ fontSize: '0.72rem', color: '#4f46e5', fontWeight: 700 }}>{results.length} result{results.length !== 1 ? 's' : ''}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Entry Form or Placeholder */}
        <div>
          {selectedStudent ? (
            <div className="card animate-in" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.1rem' }}>{selectedStudent.name}</h3>
                  <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>{selectedStudent.grNo} · {formatGrade(selectedStudent.grade)}</p>
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
                          <input
                            type="number"
                            className="form-input"
                            placeholder="Marks"
                            value={marks[subject] || ''}
                            onChange={e => setMarks(p => ({ ...p, [subject]: e.target.value }))}
                            min="0"
                          />
                          <span style={{ color: '#94a3b8', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap' }}>/ </span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '70px' }}
                            placeholder="Max"
                            value={maxMarks[subject] || '100'}
                            onChange={e => setMaxMarks(p => ({ ...p, [subject]: e.target.value }))}
                            min="1"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Total preview */}
                  {(() => {
                    const subjects = getSubjects(selectedStudent.grade);
                    const totalObtained = subjects.reduce((s, sub) => s + (parseInt(marks[sub]) || 0), 0);
                    const totalMax = subjects.reduce((s, sub) => s + (parseInt(maxMarks[sub]) || 100), 0);
                    const percent = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;
                    const grade = getGrade(percent);
                    return (
                      <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '14px 18px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>TOTAL</span>
                          <div style={{ fontSize: '1.4rem', fontWeight: 800, fontFamily: 'Lexend, sans-serif', color: 'var(--text-primary)' }}>{totalObtained} / {totalMax}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '2rem', fontWeight: 900, color: grade.color, fontFamily: 'Lexend, sans-serif' }}>{grade.label}</div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{percent}%</div>
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

              {/* Past results for this student */}
              {studentResults(selectedStudent.id).length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
                  <h4 style={{ fontWeight: 700, marginBottom: '10px', fontSize: '0.9rem' }}>Past Results</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {studentResults(selectedStudent.id).map(r => {
                      const grade = getGrade(r.percent || 0);
                      return (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#fafafa', borderRadius: '10px', border: '1px solid #f1f5f9' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{r.term}</span>
                            <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#94a3b8' }}>{new Date(r.date).toLocaleDateString('en-IN')}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{r.total}/{r.maxTotal}</span>
                            <span style={{ fontSize: '0.875rem', fontWeight: 800, color: grade.color }}>{grade.label} ({r.percent}%)</span>
                          </div>
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
              <p style={{ fontWeight: 600, color: '#94a3b8', fontSize: '1rem' }}>Select a student from the list to enter results</p>
              <p style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>Subjects are automatically chosen based on the student's grade</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
