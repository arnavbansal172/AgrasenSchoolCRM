import { Outlet, Link } from 'react-router-dom';
import { Wifi, WifiOff } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans w-full">
            {/* Sidebar */}
            <aside className="w-64 bg-indigo-900 text-white flex flex-col shadow-xl z-10">
                <div className="p-6">
                    <h1 className="text-2xl font-bold tracking-tight">SAVM Portal</h1>
                    <p className="text-indigo-200 text-sm mt-1">School Management System</p>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2">
                    <Link to="/" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Dashboard</Link>
                    <Link to="/students" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Students</Link>
                    <Link to="/attendance" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Attendance</Link>
                    <Link to="/teachers" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Teachers</Link>
                    <Link to="/fees" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Fees</Link>
                    <Link to="/reports" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Reports</Link>
                </nav>

                <div className="p-4 border-t border-indigo-800">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        {isOnline ? 'Online (Sync Ready)' : 'Offline Mode'}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col overflow-hidden relative">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 shadow-sm justify-end z-0">
                    <div className="text-sm text-slate-500">Shri Agrasen Vidya Mandir</div>
                </header>
                <div className="flex-1 overflow-auto p-8 bg-slate-50">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
