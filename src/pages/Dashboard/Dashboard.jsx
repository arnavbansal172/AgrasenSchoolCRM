import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { BookOpen, Users, UserCheck, Banknote } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
    const studentsCount = useLiveQuery(() => db.students.count()) || 0;
    const teachersCount = useLiveQuery(() => db.teachers.count()) || 0;

    const fees = useLiveQuery(() => db.fees.toArray()) || [];
    const totalReceived = fees.reduce((sum, f) => sum + parseInt(f.amount || 0), 0);

    const todayStr = new Date().toISOString().split('T')[0];
    const attendance = useLiveQuery(() => db.attendance.filter(a => a.date === todayStr).toArray()) || [];
    const presentCount = attendance.filter(a => a.status === 'Present').length;

    const attendanceRate = studentsCount > 0 ? Math.round((presentCount / studentsCount) * 100) : 0;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
                <p className="text-slate-500 mt-1">Welcome back. Here is the overview for today.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-indigo-50 text-indigo-600 rounded-xl">
                            <Users size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Total Students</div>
                            <div className="text-2xl font-bold text-slate-900">{studentsCount}</div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                        <Link to="/students" className="text-indigo-600 hover:text-indigo-800 font-medium">View Directory →</Link>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl">
                            <Banknote size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Fees Collected</div>
                            <div className="text-2xl font-bold text-slate-900">₹{totalReceived.toLocaleString()}</div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                        <Link to="/fees" className="text-emerald-600 hover:text-emerald-800 font-medium">Manage Ledger →</Link>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-sky-50 text-sky-600 rounded-xl">
                            <UserCheck size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Today's Attendance</div>
                            <div className="text-2xl font-bold text-slate-900">{attendanceRate}%</div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                        <Link to="/attendance" className="text-sky-600 hover:text-sky-800 font-medium">Mark Attendance →</Link>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-violet-50 text-violet-600 rounded-xl">
                            <BookOpen size={24} />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-slate-500">Active Teachers</div>
                            <div className="text-2xl font-bold text-slate-900">{teachersCount}</div>
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-sm">
                        <Link to="/teachers" className="text-violet-600 hover:text-violet-800 font-medium">View Staff →</Link>
                    </div>
                </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-500 to-violet-600 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold mb-2">Offline-Ready Portal</h3>
                    <p className="text-indigo-100 max-w-xl text-lg">
                        This module operates perfectly without internet. Your data is stored securely on this device and can be exported at any time.
                    </p>
                </div>
                {/* Decorative background shapes */}
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-1/4 translate-y-1/2 w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
            </div>
        </div>
    );
}
