import { useState, useEffect } from 'react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Link } from 'react-router-dom';
import {
  Users, IndianRupee, ClipboardCheck, GraduationCap,
  Bell, CalendarDays, AlertCircle, ChevronRight, Scan
} from 'lucide-react';
import { formatGrade } from '../../lib/grEngine';

const gradeOrder = ['KG1','KG2','Balvatica','1','2','3','4','5','6','7','8'];

export default function Dashboard() {
  const { user, getRoleLabel } = useAuthStore();
  const todayStr = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [summary, setSummary] = useState(null);
  const [students, setStudents] = useState([]);
  const [notices, setNotices] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [s, n, e, sum] = await Promise.all([
          api.students.list(),
          api.notices.list(),
          api.events.list(),
          api.reports.summary(),
        ]);
        setStudents(s);
        setNotices(n.slice(0, 3));
        setEvents(e.filter(ev => ev.date >= todayStr).slice(0, 3));
        setSummary(sum);
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const activeStudents = students.filter(s => s.admission_status === 'Active');
  const newAdmissions  = students.filter(s => s.admission_status === 'New Admission');
  
  // Grade breakdown
  const gradeBreakdown = {};
  activeStudents.forEach(s => { gradeBreakdown[s.grade] = (gradeBreakdown[s.grade] || 0) + 1; });
  const gradesWithStudents = gradeOrder.filter(g => gradeBreakdown[g]);

  const todayEvent = events.find(e => e.date === todayStr);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8' }}>Loading dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Today's Event Banner */}
      {todayEvent && (
        <div style={{ background: 'linear-gradient(135deg, #7c3aed, #4f46e5)', borderRadius: '16px', padding: '20px 24px', color: 'white', display: 'flex', gap: '16px', alignItems: 'center', boxShadow: '0 8px 24px rgba(79,70,229,0.3)' }}>
          <div style={{ fontSize: '2.5rem' }}>🎉</div>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.8, marginBottom: '4px' }}>Today's Event</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'Lexend, sans-serif' }}>{todayEvent.title}</div>
            {todayEvent.description && <div style={{ fontSize: '0.875rem', opacity: 0.85, marginTop: '4px' }}>{todayEvent.description}</div>}
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">{todayFormatted} · {getRoleLabel()}</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <Link to="/students" style={{ textDecoration: 'none' }}>
          <div className="stat-card card-hover">
            <div className="stat-icon" style={{ background: '#eef2ff', color: '#4f46e5' }}><Users size={24} /></div>
            <div>
              <div className="stat-label">Active Students</div>
              <div className="stat-value" style={{ color: '#4f46e5' }}>{activeStudents.length}</div>
              {newAdmissions.length > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#f59e0b', fontWeight: 600, marginTop: '2px' }}>
                  +{newAdmissions.length} pending activation
                </div>
              )}
            </div>
          </div>
        </Link>

        <Link to="/face-attendance" style={{ textDecoration: 'none' }}>
          <div className="stat-card card-hover">
            <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}><Scan size={24} /></div>
            <div>
              <div className="stat-label">Teachers Present Today</div>
              <div className="stat-value" style={{ color: '#059669' }}>{summary?.teachersPresentToday || 0}</div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginTop: '2px' }}>Face-scan attendance</div>
            </div>
          </div>
        </Link>

        <Link to="/fees" style={{ textDecoration: 'none' }}>
          <div className="stat-card card-hover">
            <div className="stat-icon" style={{ background: '#fffbeb', color: '#d97706' }}><IndianRupee size={24} /></div>
            <div>
              <div className="stat-label">Fees This Year</div>
              <div className="stat-value" style={{ color: '#d97706' }}>₹{(parseInt(summary?.feesThisYear) || 0).toLocaleString('en-IN')}</div>
            </div>
          </div>
        </Link>

        <Link to="/teachers" style={{ textDecoration: 'none' }}>
          <div className="stat-card card-hover">
            <div className="stat-icon" style={{ background: '#f5f3ff', color: '#7c3aed' }}><GraduationCap size={24} /></div>
            <div>
              <div className="stat-label">Active Teachers</div>
              <div className="stat-value" style={{ color: '#7c3aed' }}>
                {summary?.teachers?.find(t => t.status === 'Active')?.count || 0}
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* Bottom Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>

        {/* Class Strength */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Class Strength</h3>
            <Link to="/students" style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>View all →</Link>
          </div>
          {gradesWithStudents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>No students enrolled yet</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {gradesWithStudents.map(grade => {
                const count = gradeBreakdown[grade];
                const pct = Math.min((count / 40) * 100, 100);
                return (
                  <div key={grade}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{formatGrade(grade)}</span>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#4f46e5' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              <CalendarDays size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#4f46e5' }} />
              Upcoming Events
            </h3>
            <Link to="/events" style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>See all →</Link>
          </div>
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>No upcoming events</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map(event => (
                <div key={event.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ background: event.date === todayStr ? '#eef2ff' : '#f8fafc', border: `1px solid ${event.date === todayStr ? '#c7d2fe' : '#e2e8f0'}`, borderRadius: '10px', padding: '6px 10px', textAlign: 'center', minWidth: '44px', flexShrink: 0 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
                      {new Date(event.date).toLocaleDateString('en-IN', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: event.date === todayStr ? '#4f46e5' : '#1e293b', fontFamily: 'Lexend, sans-serif' }}>
                      {new Date(event.date).getDate()}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{event.title}</div>
                    {event.description && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{event.description.slice(0, 60)}{event.description.length > 60 ? '...' : ''}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notices */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              <Bell size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#f59e0b' }} />
              Notice Board
            </h3>
            <Link to="/notices" style={{ fontSize: '0.78rem', color: '#4f46e5', fontWeight: 600, textDecoration: 'none' }}>See all →</Link>
          </div>
          {notices.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#94a3b8', fontSize: '0.85rem' }}>No notices posted</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notices.map(notice => (
                <div key={notice.id} style={{ padding: '12px 14px', background: '#fafafa', border: '1px solid #f1f5f9', borderRadius: '10px', borderLeft: notice.pinned ? '3px solid #f59e0b' : '3px solid transparent' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '2px' }}>{notice.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    {notice.posted_by} · {new Date(notice.posted_at).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
