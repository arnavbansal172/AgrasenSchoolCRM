import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Plus, UserCheck } from 'lucide-react';

export default function Teachers() {
    const [showForm, setShowForm] = useState(false);

    const teachers = useLiveQuery(() => db.teachers.toArray());

    const handleAddTeacher = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        await db.teachers.add({
            enrollmentPerSoftech: data.enrollment,
            name: data.name,
            subject: data.subject,
            status: 'Active'
        });

        // Sync to local file server
        try {
            await fetch('http://localhost:3001/api/teachers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    enrollmentPerSoftech: data.enrollment,
                    name: data.name,
                    subject: data.subject,
                    status: 'Active'
                })
            });
        } catch (err) {
            console.error('Local server sync failed:', err);
        }

        setShowForm(false);
        e.target.reset();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Teachers</h2>
                    <p className="text-slate-500 mt-1">Manage teacher enrollments (PER SOFTECH).</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    {showForm ? 'Cancel' : <><Plus size={20} /> Enroll Teacher</>}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                            <UserCheck size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-slate-800">Teacher Enrollment</h3>
                            <p className="text-sm text-slate-500">Record new PER SOFTECH enrollments.</p>
                        </div>
                    </div>
                    <form onSubmit={handleAddTeacher} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Enrollment (PER SOFTECH) *</label>
                                <input required name="enrollment" type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" placeholder="e.g. TCH-8091" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                                <input required name="name" type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" placeholder="e.g. Anjali Verma" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Primary Subject *</label>
                                <input required name="subject" type="text" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" placeholder="e.g. Mathematics" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm">
                                Save Enrollment
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {!teachers || teachers.length === 0 ? (
                    <div className="col-span-full bg-white p-12 text-center rounded-2xl border border-slate-200 shadow-sm text-slate-500">
                        No teachers enrolled yet. Click "Enroll Teacher" to add staff records.
                    </div>
                ) : (
                    teachers.map(t => (
                        <div key={t.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <UserCheck size={64} />
                            </div>
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-900 tracking-tight">{t.name}</h3>
                                    <span className="inline-block px-2.5 py-1 mt-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold uppercase tracking-wider">
                                        {t.enrollmentPerSoftech}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                                <span className="text-slate-500">Subject: <span className="font-medium text-slate-700">{t.subject}</span></span>
                                <span className="text-emerald-600 font-medium">Active</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
