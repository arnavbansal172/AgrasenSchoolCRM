import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Calendar, CheckCircle2, XCircle } from 'lucide-react';

export default function Attendance() {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedClass, setSelectedClass] = useState('1');

    const students = useLiveQuery(
        () => db.students.filter(s => s.grade === selectedClass).toArray(),
        [selectedClass]
    );

    const attendanceRecords = useLiveQuery(
        () => db.attendance.filter(a => a.date === selectedDate).toArray(),
        [selectedDate]
    );

    const toggleAttendance = async (studentId, currentStatus) => {
        const newStatus = currentStatus === 'Present' ? 'Absent' : 'Present';
        const existingRecord = attendanceRecords?.find(a => a.studentId === studentId);

        if (existingRecord) {
            await db.attendance.update(existingRecord.id, { status: newStatus });
        } else {
            await db.attendance.add({
                studentId,
                date: selectedDate,
                status: newStatus
            });
        }
    };

    const getStatus = (studentId) => {
        return attendanceRecords?.find(a => a.studentId === studentId)?.status || 'Pending';
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">Attendance Tracker</h2>
                <p className="text-slate-500 mt-1">Mark daily attendance for students.</p>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                    <Calendar className="text-slate-400" size={20} />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                    <label className="text-sm font-medium text-slate-700">Class:</label>
                    <select
                        value={selectedClass}
                        onChange={(e) => setSelectedClass(e.target.value)}
                        className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {[...Array(12)].map((_, i) => (
                            <option key={i + 1} value={(i + 1).toString()}>Class {i + 1}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4 font-semibold">G.R. No</th>
                            <th className="px-6 py-4 font-semibold">Name</th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                            <th className="px-6 py-4 font-semibold text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {!students || students.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                    No students found in Class {selectedClass}.
                                </td>
                            </tr>
                        ) : (
                            students.map((student) => {
                                const status = getStatus(student.id);
                                return (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900">#{student.grNo}</td>
                                        <td className="px-6 py-4">{student.name}</td>
                                        <td className="px-6 py-4">
                                            {status === 'Present' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 size={14} /> Present</span>}
                                            {status === 'Absent' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-700"><XCircle size={14} /> Absent</span>}
                                            {status === 'Pending' && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">Pending</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => toggleAttendance(student.id, status)}
                                                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${status === 'Present' ? 'bg-slate-100 text-slate-700 hover:bg-rose-100 hover:text-rose-700' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                                            >
                                                {status === 'Present' ? 'Mark Absent' : 'Mark Present'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
