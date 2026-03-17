import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Plus, Search, UserPlus } from 'lucide-react';

export default function Students() {
    const [showForm, setShowForm] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch students from IndexedDB
    const students = useLiveQuery(
        () => db.students
            .filter(student =>
                student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                student.grNo.toString().includes(searchQuery)
            )
            .toArray(),
        [searchQuery]
    );

    const handleAddStudent = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        await db.students.add({
            grNo: data.grNo,
            name: data.name,
            grade: data.grade,
            status: 'Active',
            createdAt: new Date().toISOString()
        });

        setShowForm(false);
        e.target.reset();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Students</h2>
                    <p className="text-slate-500 mt-1">Manage student records and admissions.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    {showForm ? 'Cancel' : <><Plus size={20} /> Add Student</>}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                            <UserPlus size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-slate-800">New Registration</h3>
                            <p className="text-sm text-slate-500">Enter the student's admission details below.</p>
                        </div>
                    </div>

                    <form onSubmit={handleAddStudent} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">G.R. Number *</label>
                                <input required name="grNo" type="number" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" placeholder="e.g. 1045" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                                <input required name="name" type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" placeholder="e.g. Rahul Sharma" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Class / Grade *</label>
                                <select required name="grade" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow bg-white">
                                    <option value="">Select Class</option>
                                    {[...Array(12)].map((_, i) => (
                                        <option key={i + 1} value={i + 1}>Class {i + 1}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm">
                                Register Student
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Student List */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                    <div className="relative w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search by name or GR no..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm"
                        />
                    </div>
                    <div className="text-sm text-slate-500 font-medium">
                        Total Students: {students?.length || 0}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">G.R. No</th>
                                <th className="px-6 py-4 font-semibold">Name</th>
                                <th className="px-6 py-4 font-semibold">Class</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!students || students.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                        No students found. Click "Add Student" to register.
                                    </td>
                                </tr>
                            ) : (
                                students.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">#{student.grNo}</td>
                                        <td className="px-6 py-4">{student.name}</td>
                                        <td className="px-6 py-4">Class {student.grade}</td>
                                        <td className="px-6 py-4">
                                            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                {student.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-indigo-600 hover:text-indigo-900 font-medium">View & Edit</button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
