import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogIn, AlertCircle } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';

/* 
  LOGIN PAGE
  This component serves as the entry point for all staff members.
  
  Authentication Flow:
  1. User enters Login ID and Password.
  2. frontend checks the local 'staffUsers' table in IndexedDB.
  3. If match is found, session is persisted in authStore (sessionStorage).
  4. System redirects to the Dashboard.
*/

export default function Login() {
  // ── UI STATE ─────────────────────────────────────────────────────────────
  const [error, setError] = useState('');                   // Auth error feedback
  const [loading, setLoading] = useState(false);             // Authenticating spinner state
  const [credentials, setCredentials] = useState({           // Input buffer
    loginId: '', 
    password: '' 
  });

  // ── ACTIONS & ROUTING ────────────────────────────────────────────────────
  const login = useAuthStore(s => s.login);                  // Centralized auth function
  const navigate = useNavigate();                            // Dynamic router redirection

  // ── LIVE QUERY: DB WARMUP ────────────────────────────────────────────────
  // We trigger a live query here to ensure Dexie is awake and the 'on ready' 
  // seeding logic (admin account creation) has space to execute.
  useLiveQuery(() => db.staffUsers.toArray());

  // ── AUTHENTICATION HANDLER ───────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Sanitize inputs
      const loginId = credentials.loginId.trim().toLowerCase();
      const password = credentials.password;

      // 2. Perform the secure login via the centralized authStore
      // This function handles the logic of checking the local IndexedDB.
      const success = await login(loginId, password);

      if (success) {
        // 3. If valid, redirect to the secure home page
        navigate('/', { replace: true });
      } else {
        // 4. Show "Invalid" feedback if the combination doesn't exist locally
        setError('Invalid Login ID or Password');
      }
    } catch (err) {
      console.error('Login Technical Error:', err);
      setError('Login failed due to a system error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      
      {/* Visual background decoration (Blurs) */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(129,140,248,0.1)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(167,139,250,0.1)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '380px', position: 'relative', zIndex: 1 }}>

        {/* Portal Branding Section */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', background: 'rgba(255,255,255,0.12)', borderRadius: '20px', marginBottom: '16px', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
            <GraduationCap size={36} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: 800, marginBottom: '4px' }}>SAVM Portal</h1>
          <p style={{ color: 'rgba(199,210,254,0.8)', fontSize: '0.9rem' }}>Shri Agrasen Vidya Mandir ERP</p>
        </div>

        {/* Auth Card (Floating Glass-like container) */}
        <div style={{ background: 'rgba(255,255,255,0.97)', borderRadius: '24px', boxShadow: '0 25px 50px rgba(0,0,0,0.35)', overflow: 'hidden', padding: '32px' }}>
          
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e1b4b' }}>Staff Login</h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>Enter your credentials to continue.</p>
          </div>

          {/* Error Message Display */}
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', textAlign: 'center', marginBottom: '20px', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="form-label">Login ID</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. admin"
                value={credentials.loginId}
                onChange={e => setCredentials(p => ({ ...p, loginId: e.target.value }))}
              />
            </div>
            <div>
              <label className="form-label">Password</label>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={credentials.password}
                onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px', padding: '12px', fontSize: '1rem', display: 'flex', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="spinner-small" /> Authenticating...
                </div>
              ) : (
                <>
                  <LogIn size={18} style={{ marginRight: '8px' }} /> Sign In
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
