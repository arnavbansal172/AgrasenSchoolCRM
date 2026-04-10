import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import {
  Camera, Scan, CheckCircle2, AlertCircle, UserCheck,
  RefreshCw, Clock, Calendar, Shield, XCircle
} from 'lucide-react';

/*
  TEACHER FACE-SCAN ATTENDANCE MODULE — v2.0 (Real face-api.js)
  
  How it works:
  1. On mount: Loads face-api.js neural network models from /public/models/
  2. On mount: Fetches enrolled face descriptors for all 18 teachers from PostgreSQL
  3. Teacher stands in front of camera and clicks "Scan Face"
  4. face-api.js detects the face and computes a 128-float descriptor
  5. FaceMatcher compares against all enrolled descriptors (Euclidean distance)
  6. Best match below threshold (0.5) is identified
  7. Attendance is logged to PostgreSQL via API
*/

const MODELS_PATH = '/models';
const MATCH_THRESHOLD = 0.5; // Lower = stricter matching (0.4-0.6 is ideal)

// Status badge config
const statuses = [
  { value: 'Present', color: '#10b981', bg: '#ecfdf5' },
  { value: 'Absent', color: '#ef4444', bg: '#fef2f2' },
  { value: 'Late', color: '#f59e0b', bg: '#fffbeb' },
  { value: 'Half Day', color: '#6366f1', bg: '#eef2ff' },
];

export default function TeacherFaceAttendance() {
  const { can } = useAuthStore();

  // ── Model & descriptor state ────────────────────────────────────────────
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelError, setModelError] = useState(null);
  const [faceMatcher, setFaceMatcher] = useState(null);
  const [enrolledTeachers, setEnrolledTeachers] = useState([]);

  // ── Camera state ────────────────────────────────────────────────────────
  const [stream, setStream] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);

  // ── Scan state ──────────────────────────────────────────────────────────
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null); // { type: 'success'|'error', teacher, confidence, message }

  // ── Today's attendance log (live from API) ──────────────────────────────
  const [todayLogs, setTodayLogs] = useState([]);
  const todayStr = new Date().toISOString().split('T')[0];

  // ── 1. LOAD FACE-API MODELS ──────────────────────────────────────────────
  useEffect(() => {
    const loadModels = async () => {
      setLoadingModels(true);
      setModelError(null);
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH),
        ]);
        setModelsLoaded(true);
        console.log('✅ face-api.js models loaded');
      } catch (err) {
        console.error('❌ Failed to load face models:', err);
        setModelError('Failed to load face recognition models. Check network connection.');
      } finally {
        setLoadingModels(false);
      }
    };
    loadModels();
  }, []);

  // ── 2. LOAD ENROLLED FACE DESCRIPTORS FROM POSTGRESQL ───────────────────
  const loadDescriptors = useCallback(async () => {
    try {
      const data = await api.teachers.getFaceDescriptors();
      setEnrolledTeachers(data);
      
      if (data.length === 0) {
        setFaceMatcher(null);
        return;
      }

      // Build FaceMatcher: one labeledDescriptor per teacher
      const labeledDescriptors = data
        .filter(t => t.face_descriptor && Array.isArray(t.face_descriptor))
        .map(t => new faceapi.LabeledFaceDescriptors(
          String(t.id),  // Label = teacher's DB id
          [new Float32Array(t.face_descriptor)]
        ));

      if (labeledDescriptors.length > 0) {
        const matcher = new faceapi.FaceMatcher(labeledDescriptors, MATCH_THRESHOLD);
        setFaceMatcher(matcher);
        console.log(`✅ Face matcher ready with ${labeledDescriptors.length} teachers`);
      }
    } catch (err) {
      console.error('Failed to load face descriptors:', err);
    }
  }, []);

  useEffect(() => {
    if (modelsLoaded) loadDescriptors();
  }, [modelsLoaded, loadDescriptors]);

  // ── 3. LOAD TODAY'S ATTENDANCE LOG ───────────────────────────────────────
  const loadTodayLogs = useCallback(async () => {
    try {
      const logs = await api.teacherAttendance.list({ date: todayStr });
      setTodayLogs(logs);
    } catch (err) {
      console.error('Failed to load today logs:', err);
    }
  }, [todayStr]);

  useEffect(() => {
    loadTodayLogs();
  }, [loadTodayLogs]);

  // ── 4. CAMERA CONTROL ───────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
      setCameraError(null);
    } catch (err) {
      setCameraError('Camera access denied. Please allow camera permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  // ── 5. FACE SCAN — REAL RECOGNITION ─────────────────────────────────────
  const runScan = async () => {
    if (!modelsLoaded) { setResult({ type: 'error', message: 'Models not loaded yet.' }); return; }
    if (!faceMatcher || enrolledTeachers.length === 0) {
      setResult({ type: 'error', message: 'No teachers enrolled for face scan. Enroll teachers first in the Teachers module.' });
      return;
    }
    if (!videoRef.current || !stream) {
      setResult({ type: 'error', message: 'Camera not available.' });
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      // Run face detection + descriptor computation on the video frame
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setResult({ type: 'error', message: 'No face detected. Please look directly at the camera.' });
        setScanning(false);
        return;
      }

      // Match against all enrolled teachers
      const match = faceMatcher.findBestMatch(detection.descriptor);

      if (match.label === 'unknown') {
        setResult({ type: 'error', message: 'Face not recognized. Please ensure you are enrolled and try again in good lighting.' });
        setScanning(false);
        return;
      }

      // Find the matched teacher's info
      const matchedTeacher = enrolledTeachers.find(t => String(t.id) === match.label);
      if (!matchedTeacher) {
        setResult({ type: 'error', message: 'match ID not found in database.' });
        setScanning(false);
        return;
      }

      // Convert distance to confidence percentage (lower distance = higher confidence)
      const confidence = Math.round((1 - match.distance) * 100);

      // Log attendance to PostgreSQL
      await api.teacherAttendance.log({
        teacherId: matchedTeacher.id,
        date: todayStr,
        status: 'Present',
        method: 'Face Recognition',
        matchScore: (1 - match.distance).toFixed(3),
      });

      setResult({
        type: 'success',
        teacher: matchedTeacher,
        confidence,
        distance: match.distance,
      });

      // Refresh today's log
      await loadTodayLogs();

      // Auto-reset after 5 seconds
      setTimeout(() => setResult(null), 5000);
    } catch (err) {
      console.error('Face scan error:', err);
      setResult({ type: 'error', message: `Scan failed: ${err.message}` });
    } finally {
      setScanning(false);
    }
  };

  // ── MANUAL ATTENDANCE OVERRIDE ───────────────────────────────────────────
  const markManual = async (teacher, status) => {
    if (!can('face_attendance.override')) return;
    try {
      await api.teacherAttendance.log({
        teacherId: teacher.id,
        date: todayStr,
        status,
        method: 'Manual',
      });
      await loadTodayLogs();
    } catch (err) {
      alert('Failed to mark attendance: ' + err.message);
    }
  };

  // ── RENDER ───────────────────────────────────────────────────────────────
  if (loadingModels) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '16px' }}>
        <RefreshCw size={32} style={{ animation: 'spin 1.5s linear infinite', color: '#6366f1' }} />
        <div style={{ fontWeight: 700, color: '#1e293b' }}>Loading Face Recognition Engine...</div>
        <div style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', maxWidth: '360px' }}>
          Downloading AI models (~12MB, first load only). This takes 10-20 seconds on first use.
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (modelError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '48px', textAlign: 'center' }}>
        <AlertCircle size={40} color="#ef4444" />
        <div style={{ fontWeight: 700, color: '#1e293b' }}>Face Recognition Error</div>
        <div style={{ color: '#64748b', maxWidth: '400px' }}>{modelError}</div>
        <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  const presentToday = todayLogs.filter(l => l.status === 'Present' || l.status === 'Late').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Face-Scan Attendance</h1>
          <p className="page-subtitle">
            {enrolledTeachers.length} teachers enrolled · {presentToday}/{enrolledTeachers.length} present today
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.82rem', fontWeight: 700, background: '#ecfdf5', padding: '6px 14px', borderRadius: '999px', border: '1px solid #a7f3d0' }}>
          <Shield size={14} /> LIVE · face-api.js
        </div>
      </div>

      {/* Enrollment warning */}
      {enrolledTeachers.length === 0 && (
        <div className="alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', borderRadius: '12px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <AlertCircle size={20} color="#f59e0b" />
          <div>
            <strong>No teachers enrolled for face recognition.</strong>
            <br/><span style={{ fontSize: '0.85rem', color: '#78350f' }}>Go to <strong>Teachers</strong> module → Select a teacher → Click <strong>"Enroll Face"</strong> to register their face.</span>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>

        {/* CAMERA & SCANNER */}
        <div className="card" style={{
          padding: 0, overflow: 'hidden', position: 'relative',
          background: '#0a0a0a', borderRadius: '24px', aspectRatio: '4/3',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>

          {/* Camera feed */}
          {stream ? (
            <video
              ref={videoRef}
              autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: scanning ? 0.5 : 1, transition: 'opacity 0.3s' }}
            />
          ) : (
            <div style={{ color: '#64748b', textAlign: 'center', padding: '40px' }}>
              <Camera size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
              <div style={{ fontWeight: 600 }}>Camera Signal Lost</div>
              {cameraError && (
                <div style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '8px' }}>{cameraError}</div>
              )}
              <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={startCamera}>Retry Camera</button>
            </div>
          )}

          {/* Scanning overlay */}
          {(scanning || result?.type === 'success') && (
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {/* Animated scan line */}
              {scanning && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
                  background: 'linear-gradient(to right, transparent, #10b981, #6ee7b7, #10b981, transparent)',
                  boxShadow: '0 0 20px 4px rgba(16,185,129,0.6)',
                  zIndex: 20, animation: 'scanLine 2s infinite ease-in-out'
                }} />
              )}

              {/* Face frame */}
              <div style={{
                position: 'absolute', top: '12%', left: '22%', right: '22%', bottom: '12%',
                border: `2px solid ${result?.type === 'success' ? 'rgba(16,185,129,0.8)' : 'rgba(16,185,129,0.4)'}`,
                borderRadius: '50% 50% 45% 45% / 50% 50% 50% 50%',
                transition: 'border-color 0.3s'
              }}>
                {/* Corner accents */}
                {[
                  { top: '-2px', left: '-2px', borderTop: '4px solid #10b981', borderLeft: '4px solid #10b981', borderTopLeftRadius: '12px' },
                  { top: '-2px', right: '-2px', borderTop: '4px solid #10b981', borderRight: '4px solid #10b981', borderTopRightRadius: '12px' },
                  { bottom: '-2px', left: '-2px', borderBottom: '4px solid #10b981', borderLeft: '4px solid #10b981', borderBottomLeftRadius: '12px' },
                  { bottom: '-2px', right: '-2px', borderBottom: '4px solid #10b981', borderRight: '4px solid #10b981', borderBottomRightRadius: '12px' },
                ].map((style, i) => (
                  <div key={i} style={{ position: 'absolute', width: '28px', height: '28px', ...style }} />
                ))}
              </div>
            </div>
          )}

          {/* SUCCESS OVERLAY */}
          {result?.type === 'success' && (
            <div style={{
              position: 'absolute', inset: 'auto 20px 20px 20px',
              background: 'rgba(5,150,105,0.96)',
              backdropFilter: 'blur(12px)',
              borderRadius: '18px',
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '14px',
              color: 'white',
              boxShadow: '0 20px 40px rgba(5,150,105,0.4)',
              zIndex: 30, animation: 'slideUp 0.4s cubic-bezier(0, 0.55, 0.45, 1)'
            }}>
              <div style={{ width: '44px', height: '44px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CheckCircle2 size={26} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 800, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ✓ Identity Verified
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'Lexend, sans-serif' }}>
                  {result.teacher.name}
                </div>
                {result.teacher.employee_id && (
                  <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>ID: {result.teacher.employee_id}</div>
                )}
              </div>
              <div style={{
                background: 'rgba(255,255,255,0.15)', borderRadius: '10px',
                padding: '8px 12px', textAlign: 'center', flexShrink: 0
              }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{result.confidence}%</div>
                <div style={{ fontSize: '0.62rem', fontWeight: 700, opacity: 0.8 }}>MATCH</div>
              </div>
            </div>
          )}

          {/* ERROR OVERLAY */}
          {result?.type === 'error' && (
            <div style={{
              position: 'absolute', inset: 'auto 20px 20px 20px',
              background: 'rgba(220,38,38,0.95)',
              backdropFilter: 'blur(12px)',
              borderRadius: '18px',
              padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: '14px',
              color: 'white', zIndex: 30, animation: 'slideUp 0.4s ease'
            }}>
              <XCircle size={28} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600 }}>{result.message}</div>
              <button onClick={() => setResult(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
          )}

          {/* SCAN TRIGGER BUTTON */}
          {!scanning && !result && (
            <button
              onClick={runScan}
              disabled={!stream || enrolledTeachers.length === 0}
              style={{
                position: 'absolute', zIndex: 10,
                background: enrolledTeachers.length === 0 ? '#64748b' : 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white', border: 'none',
                padding: '18px 36px', borderRadius: '999px',
                fontWeight: 800, fontSize: '1.1rem',
                cursor: enrolledTeachers.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: '0 12px 24px rgba(16,185,129,0.5)',
                display: 'flex', alignItems: 'center', gap: '10px',
                letterSpacing: '0.02em',
              }}
            >
              <Scan size={22} /> SCAN FACE
            </button>
          )}

          {/* Scanning indicator */}
          {scanning && (
            <div style={{
              position: 'absolute', zIndex: 10, color: '#10b981',
              fontWeight: 900, fontSize: '1.1rem', textTransform: 'uppercase',
              letterSpacing: '0.15em', textShadow: '0 0 20px rgba(16,185,129,0.8)',
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'rgba(0,0,0,0.6)', padding: '14px 28px', borderRadius: '999px',
            }}>
              <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite' }} />
              ANALYZING...
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Today summary card */}
          <div className="card" style={{ padding: '20px', background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Calendar size={16} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, lineHeight: 1, fontFamily: 'Lexend, sans-serif' }}>
              {presentToday}<span style={{ fontSize: '1.4rem', opacity: 0.7 }}>/{enrolledTeachers.length}</span>
            </div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: '4px' }}>Teachers marked present</div>
          </div>

          {/* Today's scan log */}
          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={15} color="#6366f1" /> Today's Log
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto' }}>
              {todayLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.82rem' }}>
                  No attendance logged yet today
                </div>
              ) : todayLogs.map(log => (
                <div key={log.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 12px', borderRadius: '10px',
                  background: '#f8fafc', border: '1px solid #f1f5f9'
                }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <UserCheck size={16} color="#4f46e5" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.teacher_name}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                      {log.method} · {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 800,
                    padding: '2px 8px', borderRadius: '6px',
                    background: log.status === 'Present' ? '#ecfdf5' : log.status === 'Late' ? '#fffbeb' : '#fef2f2',
                    color: log.status === 'Present' ? '#059669' : log.status === 'Late' ? '#d97706' : '#dc2626',
                    flexShrink: 0
                  }}>
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Manual override (admin only) */}
          {can('face_attendance.override') && enrolledTeachers.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 800, marginBottom: '14px' }}>Manual Override</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {enrolledTeachers.map(t => {
                  const existingLog = todayLogs.find(l => l.teacher_id === t.id);
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      <span style={{ flex: 1, fontSize: '0.78rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                      {existingLog ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#ecfdf5', color: '#059669' }}>
                          {existingLog.status}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => markManual(t, 'Present')} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>P</button>
                          <button onClick={() => markManual(t, 'Absent')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>A</button>
                          <button onClick={() => markManual(t, 'Late')} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: '6px', padding: '2px 8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer' }}>L</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scanLine {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp {
          from { transform: translateY(16px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
