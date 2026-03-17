import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Download, FileText, Users, HandCoins, UserCheck } from 'lucide-react';

export default function Reports() {
    const [activeTab] = useState('summary');

    // Load basic stats
    const studentsCount = useLiveQuery(() => db.students.count()) || 0;
    const teachersCount = useLiveQuery(() => db.teachers.count()) || 0;

    const fees = useLiveQuery(() => db.fees.toArray()) || [];
    const totalReceived = fees.reduce((sum, f) => sum + parseInt(f.amount || 0), 0);

    const attendance = useLiveQuery(() => db.attendance.toArray()) || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const todayPresent = attendance.filter(a => a.date === todayStr && a.status === 'Present').length;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Reports Dash</h2>
                    <p className="text-slate-500 mt-1">Cross-system insights and exports.</p>
                </div>
                <button className="flex items-center gap-2 bg-white text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                    <Download size={20} /> Export All (CSV)
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Users size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Total Students</div>
                        <div className="text-2xl font-bold text-slate-900">{studentsCount}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
                        <HandCoins size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Fee Received</div>
                        <div className="text-2xl font-bold text-slate-900">₹{totalReceived.toLocaleString()}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-violet-50 text-violet-600 rounded-xl">
                        <UserCheck size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Teachers Active</div>
                        <div className="text-2xl font-bold text-slate-900">{teachersCount}</div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-4 bg-sky-50 text-sky-600 rounded-xl">
                        <FileText size={24} />
                    </div>
                    <div>
                        <div className="text-sm font-medium text-slate-500">Present Today</div>
                        <div className="text-2xl font-bold text-slate-900">{todayPresent}</div>
                    </div>
                </div>
            </div>

            {/* Report Tabs Placeholder */}
            <div className="bg-white border text-center py-20 border-slate-200 rounded-2xl shadow-sm">
                <FileText className="mx-auto text-slate-300 mb-4" size={48} />
                <h3 className="text-lg font-medium text-slate-800">Advanced Reports Engine</h3>
                <p className="text-slate-500 mt-2 max-w-sm mx-auto">
                    Student-wise GR printing, class-wise attendance sheets, and full term grade logs are available here. Add data first to generate these views.
                </p>
            </div>
        </div>
    );
}
