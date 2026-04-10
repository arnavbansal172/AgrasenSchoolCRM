import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, LogIn, AlertCircle, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

/*
  LOGIN PAGE — v2.0 (Real Authentication)
  
  Connects to the actual PostgreSQL backend via the authStore.
  JWT token is stored in sessionStorage on success.
*/

export default function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentials, setCredentials] = useState({ loginId: '', password: '' });

  const login = useAuthStore(s => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await login(credentials.loginId.trim().toLowerCase(), credentials.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Invalid Login ID or Password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 40%, #312e81 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Decorative background blobs */}
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-15%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(99,102,241,0.12)', filter: 'blur(80px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', left: '-10%', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(139,92,246,0.1)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', top: '40%', left: '40%', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(67,56,202,0.08)', filter: 'blur(50px)' }} />
      </div>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }}>

        {/* Branding */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '80px', height: '80px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '24px',
            marginBottom: '20px',
            border: '1px solid rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
          }}>
            <GraduationCap size={40} color="white" />
          </div>
          <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, marginBottom: '6px', fontFamily: 'Lexend, sans-serif' }}>
            SAVM Portal
          </h1>
          <p style={{ color: 'rgba(199,210,254,0.7)', fontSize: '0.9rem', fontWeight: 500 }}>
            Shri Agrasen Vidya Mandir — Staff Portal
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.97)',
          borderRadius: '28px',
          boxShadow: '0 32px 64px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
          overflow: 'hidden',
          padding: '36px',
        }}>

          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e1b4b', marginBottom: '4px' }}>
              Staff Login
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
              Enter your credentials to access the ERP
            </p>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fecaca', borderRadius: '12px',
              padding: '12px 16px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '0.85rem', fontWeight: 600,
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label className="form-label">Login ID</label>
              <input
                id="loginId"
                type="text"
                required
                autoComplete="username"
                className="form-input"
                placeholder="e.g. admin or superadmin"
                value={credentials.loginId}
                onChange={e => setCredentials(p => ({ ...p, loginId: e.target.value }))}
                style={{ fontSize: '1rem' }}
              />
            </div>

            <div>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="form-input"
                  placeholder="••••••••"
                  value={credentials.password}
                  onChange={e => setCredentials(p => ({ ...p, password: e.target.value }))}
                  style={{ paddingRight: '44px', fontSize: '1rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', lineHeight: 0,
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '14px', fontSize: '1rem', fontWeight: 700, marginTop: '4px' }}
              disabled={loading}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span className="spinner-small" /> Verifying...
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <LogIn size={18} /> Sign In
                </span>
              )}
            </button>
          </form>

          {/* Security note */}
          <div style={{
            marginTop: '24px', display: 'flex', alignItems: 'center', gap: '8px',
            justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem'
          }}>
            <Shield size={13} />
            <span>Secured · Local Network Only · PostgreSQL</span>
          </div>
        </div>

        {/* Version badge */}
        <div style={{ textAlign: 'center', marginTop: '16px', color: 'rgba(199,210,254,0.4)', fontSize: '0.72rem' }}>
          SAVM ERP v2.0 · 4-Role Access Control
        </div>
      </div>

      <style>{`
        .spinner-small {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          display: inline-block;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
