import { Outlet, Link } from 'react-router-dom';
import { Wifi, WifiOff, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';

export default function Layout() {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
        <div className="flex h-screen bg-slate-50 text-slate-900 font-sans w-full overflow-hidden">

            {/* Mobile Menu Backdrop */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 lg:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed lg:static inset-y-0 left-0 w-64 bg-indigo-900 text-white flex flex-col shadow-xl z-30 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">SAVM Portal</h1>
                        <p className="text-indigo-200 text-sm mt-1">School Management System</p>
                    </div>
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden text-indigo-300 hover:text-white p-1"
                    >
                        <X size={24} />
                    </button>
                </div>

                <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Dashboard</Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/students" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Students</Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/attendance" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Attendance</Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/teachers" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Teachers</Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/fees" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Fees</Link>
                    <Link onClick={() => setIsMobileMenuOpen(false)} to="/reports" className="block px-4 py-2.5 rounded-lg hover:bg-indigo-800 transition-colors font-medium">Reports</Link>
                </nav>

                <div className="p-4 border-t border-indigo-800">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
                        {isOnline ? 'Online (Sync Ready)' : 'Offline Mode'}
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full lg:w-[calc(100%-16rem)]">
                <header className="h-16 shrink-0 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 shadow-sm justify-between lg:justify-end z-10">
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="lg:hidden text-slate-500 hover:text-slate-800 p-2 -ml-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <Menu size={24} />
                    </button>
                    <div className="text-sm font-medium text-slate-500">Shri Agrasen Vidya Mandir</div>
                </header>
                <div className="flex-1 overflow-auto p-4 lg:p-8 bg-slate-50">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
