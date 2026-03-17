import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { IndianRupee, Receipt, AlertCircle, Plus } from 'lucide-react';

export default function Fees() {
    const [showForm, setShowForm] = useState(false);

    const students = useLiveQuery(() => db.students.toArray()) || [];
    const validStudents = students.filter(s => s && s.id);
    const fees = useLiveQuery(() => db.fees.toArray()) || [];

    // Create a combined ledger view
    const ledger = validStudents.map(student => {
        // Basic fee structure: Class 1 = 10k, Class 2 = 12k, etc.
        const expectedFee = parseInt(student.grade) * 2000 + 8000;

        // Calculate total paid by this student
        const studentPayments = fees.filter(f => f.studentId === student.id);
        const totalPaid = studentPayments.reduce((acc, curr) => acc + (parseInt(curr.amount) || 0), 0);

        const pending = expectedFee - totalPaid;

        return {
            ...student,
            expectedFee,
            totalPaid,
            pending,
            payments: studentPayments
        };
    });

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        await db.fees.add({
            studentId: parseInt(data.studentId),
            amount: parseInt(data.amount),
            method: data.method,
            date: data.date,
            receiptNo: `REC-${Date.now().toString().slice(-6)}`
        });

        setShowForm(false);
        e.target.reset();
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Fee Ledger</h2>
                    <p className="text-slate-500 mt-1">Track student payments and pending balances.</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                >
                    {showForm ? 'Cancel' : <><Plus size={20} /> Record Payment</>}
                </button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-2xl border border-emerald-200 shadow-sm mb-6 animate-in fade-in bg-emerald-50/10">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
                            <IndianRupee size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-semibold text-slate-800">New Payment Receipt</h3>
                            <p className="text-sm text-slate-500">Record a new fee collection.</p>
                        </div>
                    </div>

                    <form onSubmit={handleRecordPayment} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Student *</label>
                                <select required name="studentId" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                                    <option value="">Select Student</option>
                                    {validStudents.map(s => (
                                        <option key={s.id} value={s.id}>{s.name} (GR: {s.grNo})</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Amount (₹) *</label>
                                <input required name="amount" type="number" min="1" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="0.00" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method *</label>
                                <select required name="method" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                                    <option value="Cash">Cash</option>
                                    <option value="Cheque">Cheque</option>
                                    <option value="Online">Online Transfer</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Date *</label>
                                <input required name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none" />
                            </div>
                        </div>
                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
                                <Receipt size={18} /> Generate Receipt
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600">
                        <thead className="text-xs uppercase bg-slate-50 text-slate-500 border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Student</th>
                                <th className="px-6 py-4 font-semibold">Class</th>
                                <th className="px-6 py-4 font-semibold">Total Fee</th>
                                <th className="px-6 py-4 font-semibold">Paid</th>
                                <th className="px-6 py-4 font-semibold">Pending</th>
                                <th className="px-6 py-4 font-semibold text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {ledger.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                        No students found. Register students first to see the fee ledger.
                                    </td>
                                </tr>
                            ) : (
                                ledger.map((record) => (
                                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-900">{record.name}</div>
                                            <div className="text-xs text-slate-500">GR: {record.grNo}</div>
                                        </td>
                                        <td className="px-6 py-4">Class {record.grade}</td>
                                        <td className="px-6 py-4 font-medium text-slate-700">₹{record.expectedFee.toLocaleString()}</td>
                                        <td className="px-6 py-4 font-medium text-emerald-600">₹{record.totalPaid.toLocaleString()}</td>
                                        <td className="px-6 py-4 font-medium text-rose-600">₹{record.pending.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right">
                                            {record.pending === 0 ? (
                                                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                                    Cleared
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                                                    <AlertCircle size={14} /> Due
                                                </span>
                                            )}
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
