import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { BookOpen, Search, Save, History } from 'lucide-react';

export default function Results() {
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [term, setTerm] = useState('Term 1');
    const [marks, setMarks] = useState({
        Mathematics: '',
        Science: '',
        English: '',
        Hindi: '',
        SocialStudies: ''
    });

    const students = useLiveQuery(
        () => db.students
            .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.grNo.toString().includes(searchQuery))
            .toArray(),
        [searchQuery]
    );

    const handleSaveResult = async (e) => {
        e.preventDefault();
        if (!selectedStudent) return;

        const total = Object.values(marks).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0);

        const resultData = {
            studentId: selectedStudent.id,
            grNo: selectedStudent.grNo,
            name: selectedStudent.name,
            term,
            subjects: marks,
            total
        };

        await db.results.add(resultData);

        // Sync to local server
        try {
            await fetch('http://localhost:3001/api/results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(resultData)
            });
            alert('Result saved and synced to file!');
        } catch (err) {
            console.error('Sync failed', err);
            alert('Result saved locally but server sync failed.');
        }

        setSelectedStudent(null);
        setMarks({ Mathematics: '', Science: '', English: '', Hindi: '', SocialStudies: '' });
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Grades & Results</h2>
                <p className="text-slate-500 mt-1">Record and manage academic performance.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Student Selection */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            <Search size={20} className="text-indigo-600" /> Find Student
                        </h3>
                        <div className="relative mb-4">
                            <input
                                type="text"
                                placeholder="Search name or GR..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-4 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                            />
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {students?.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setSelectedStudent(s)}
                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${selectedStudent?.id === s.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}
                                >
                                    <div className="font-medium text-slate-900">{s.name}</div>
                                    <div className="text-xs text-slate-500">GR: {s.grNo} | Class {s.grade}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Result Entry Form */}
                <div className="lg:col-span-2">
                    {selectedStudent ? (
                        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-right-4">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">{selectedStudent.name}</h3>
                                    <p className="text-slate-500">Entering results for Class {selectedStudent.grade}</p>
                                </div>
                                <select
                                    value={term}
                                    onChange={(e) => setTerm(e.target.value)}
                                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option>Term 1</option>
                                    <option>Term 2</option>
                                    <option>Final Exam</option>
                                </select>
                            </div>

                            <form onSubmit={handleSaveResult} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {Object.keys(marks).map(subject => (
                                        <div key={subject}>
                                            <label className="block text-sm font-semibold text-slate-700 mb-2">{subject}</label>
                                            <input
                                                type="number"
                                                required
                                                value={marks[subject]}
                                                onChange={(e) => setMarks({ ...marks, [subject]: e.target.value })}
                                                placeholder="Marks / 100"
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                            />
                                        </div>
                                    ))}
                                </div>

                                <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                                    <div className="text-lg font-bold text-slate-900">
                                        Total: <span className="text-indigo-600">{Object.values(marks).reduce((acc, curr) => acc + (parseInt(curr) || 0), 0)}</span>
                                    </div>
                                    <button type="submit" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-200">
                                        <Save size={20} /> Save Assessment
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="bg-slate-100/50 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-20 text-slate-400">
                            <BookOpen size={48} className="mb-4 opacity-50" />
                            <p className="text-lg font-medium">Select a student from the list to enter results</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
