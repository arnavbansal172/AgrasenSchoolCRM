import { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import {
  Plus, X, GraduationCap, Edit2, UserCheck, BookOpen,
  Camera, CheckCircle2, RefreshCw, Scan, AlertCircle
} from 'lucide-react';
import { GRADES, formatGrade } from '../../lib/grEngine';

const MODELS_PATH = '/models';

const STATUS_COLORS = {
  Active:   { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
  Inactive: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
};

// ── FACE ENROLLMENT MODAL ────────────────────────────────────────────────────
// Supports two methods:
//   1. Photo Upload  — take a selfie with phone camera (works on HTTP, no HTTPS needed)
//   2. Live Webcam   — classic webcam capture (requires HTTPS on non-localhost)
function FaceEnrollModal({ teacher, onClose, onSuccess }) {
  const [mode, setMode] = useState('photo'); // 'photo' | 'webcam'
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [loadingModels, setLoadingModels] = useState(true);
  const [stream, setStream] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewSrc, setPreviewSrc] = useState(null); // for photo upload preview
  const videoRef = useRef(null);
  const imgRef   = useRef(null);
  const fileRef  = useRef(null);

  // Load face-api models on mount
  useEffect(() => {
    const load = async () => {
      try {
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH),
        ]);
        setModelsLoaded(true);
      } catch {
        setError('Failed to load face models. Ensure /public/models/ files are present.');
      } finally {
        setLoadingModels(false);
      }
    };
    load();
  }, []);

  // Start webcam (only when switching to webcam mode)
  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch {
      setError('Camera access denied. Use "Photo Upload" mode instead, or allow camera permissions.');
    }
  }, []);

  useEffect(() => {
    if (mode === 'webcam') startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, [mode]);

  // ── METHOD 1: Photo Upload ─────────────────────────────────────────────────
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
  };

  const enrollFromPhoto = async () => {
    if (!previewSrc || !modelsLoaded) return;
    setCapturing(true);
    setError(null);
    try {
      const img = imgRef.current;
      // Wait for image to be loaded in DOM
      await new Promise((res, rej) => {
        if (img.complete) return res();
        img.onload = res;
        img.onerror = rej;
      });

      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 }))
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        setError('No face detected in this photo. Try a clearer, well-lit selfie looking straight at the camera.');
        return;
      }

      await api.teachers.enrollFace(teacher.id, Array.from(detection.descriptor));
      setResult({ success: true });
      onSuccess();
    } catch (err) {
      setError('Enrollment failed: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  // ── METHOD 2: Live Webcam ──────────────────────────────────────────────────
  const captureAndEnroll = async () => {
    if (!modelsLoaded || !videoRef.current || !stream) return;
    setCapturing(true);
    setError(null);
    try {
      // Take 5 samples and average them for better accuracy
      const samples = [];
      for (let i = 0; i < 5; i++) {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.6 }))
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (!detection) {
          setError('No face detected. Look directly at the camera in good lighting.');
          setCapturing(false);
          return;
        }
        samples.push(detection.descriptor);
        await new Promise(r => setTimeout(r, 200));
      }
      const avgDescriptor = samples[0].map((_, i) =>
        samples.reduce((sum, s) => sum + s[i], 0) / samples.length
      );
      await api.teachers.enrollFace(teacher.id, Array.from(avgDescriptor));
      setResult({ success: true });
      if (stream) stream.getTracks().forEach(t => t.stop());
      onSuccess();
    } catch (err) {
      setError('Enrollment failed: ' + err.message);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-box" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <h3 style={{ fontWeight: 800 }}>
            <Scan size={18} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#10b981' }} />
            Enroll Face — {teacher.name}
          </h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          {/* Success state */}
          {result?.success && (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '12px' }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>Face Enrolled!</div>
              <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '20px' }}>
                {teacher.name} can now use face scan attendance.
              </div>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          )}

          {/* Loading models */}
          {loadingModels && !result && (
            <div style={{ textAlign: 'center', padding: '32px' }}>
              <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#6366f1', marginBottom: '12px' }} />
              <div style={{ fontWeight: 600, color: '#1e293b' }}>Loading Face Recognition...</div>
            </div>
          )}

          {!loadingModels && !result && (
            <>
              {/* Mode switcher */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' }}>
                {[
                  { id: 'photo', label: '📷 Take/Upload Photo', desc: 'Works on any phone (recommended)' },
                  { id: 'webcam', label: '🎥 Live Webcam', desc: 'Needs HTTPS on phone' },
                ].map(m => (
                  <button key={m.id} onClick={() => { setMode(m.id); setError(null); }}
                    style={{
                      flex: 1, padding: '10px 8px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                      fontWeight: 700, fontSize: '0.82rem', transition: 'all 0.15s',
                      background: mode === m.id ? 'white' : 'transparent',
                      color: mode === m.id ? '#1e293b' : '#94a3b8',
                      boxShadow: mode === m.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* ── PHOTO UPLOAD MODE ── */}
              {mode === 'photo' && (
                <div>
                  <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#166534', marginBottom: '16px' }}>
                    <strong>How to enroll from phone:</strong> Tap "Take Selfie / Choose Photo" → phone front camera opens → take a clear photo looking straight ahead
                  </div>

                  {/* Hidden file input — capture="user" opens selfie camera on phones */}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    capture="user"
                    style={{ display: 'none' }}
                    onChange={handlePhotoSelect}
                  />

                  {/* Preview area or upload button */}
                  {previewSrc ? (
                    <div style={{ position: 'relative', textAlign: 'center', marginBottom: '14px' }}>
                      <img
                        ref={imgRef}
                        src={previewSrc}
                        alt="Face preview"
                        crossOrigin="anonymous"
                        style={{ maxWidth: '100%', maxHeight: '260px', borderRadius: '12px', border: '2px solid #d1fae5' }}
                      />
                      <button
                        onClick={() => { setPreviewSrc(null); setError(null); fileRef.current.value = ''; }}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{
                        border: '2px dashed #a7f3d0', borderRadius: '14px', padding: '40px 20px',
                        textAlign: 'center', cursor: 'pointer', marginBottom: '14px',
                        background: '#f0fdf4', transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#dcfce7'}
                      onMouseLeave={e => e.currentTarget.style.background = '#f0fdf4'}
                    >
                      <Camera size={32} color="#10b981" style={{ marginBottom: '10px' }} />
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem' }}>Take Selfie / Choose Photo</div>
                      <div style={{ color: '#64748b', fontSize: '0.78rem', marginTop: '4px' }}>Tap here → phone camera opens automatically</div>
                    </div>
                  )}

                  {error && (
                    <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    {previewSrc && (
                      <button className="btn btn-primary" onClick={enrollFromPhoto}
                        disabled={capturing || !modelsLoaded}
                        style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                        {capturing ? <><RefreshCw size={15} /> Analyzing...</> : <><CheckCircle2 size={15} /> Enroll This Photo</>}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ── WEBCAM MODE ── */}
              {mode === 'webcam' && (
                <div>
                  <div style={{ position: 'relative', background: '#000', borderRadius: '16px', overflow: 'hidden', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: capturing ? 0.5 : 1 }} />
                    <div style={{ position: 'absolute', top: '15%', left: '25%', right: '25%', bottom: '10%', border: '2px solid rgba(16,185,129,0.6)', borderRadius: '50% 50% 45% 45% / 50% 50% 50% 50%', pointerEvents: 'none' }} />
                    {capturing && (
                      <div style={{ position: 'absolute', color: '#10b981', fontWeight: 800, fontSize: '0.9rem', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <RefreshCw size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> Scanning (5 samples)...
                      </div>
                    )}
                  </div>

                  {error && (
                    <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '10px 14px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                    </div>
                  )}

                  <div style={{ background: '#f0fdf4', borderRadius: '10px', padding: '12px 14px', fontSize: '0.82rem', color: '#166534', marginBottom: '16px' }}>
                    Position {teacher.name}'s face in the oval. Good lighting = better accuracy.
                  </div>

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={captureAndEnroll}
                      disabled={capturing || !modelsLoaded || !stream}
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                      {capturing ? <><RefreshCw size={15} /> Scanning...</> : <><Scan size={15} /> Capture Face</>}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}



// ── MAIN TEACHERS PAGE ───────────────────────────────────────────────────────

export default function Teachers() {
  const { can } = useAuthStore();
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTeacher, setEditTeacher] = useState(null);
  const [enrollModal, setEnrollModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', employeeId: '', subject: '', assignedGrade: '',
    phone: '', basePay: '', status: 'Active'
  });

  const loadTeachers = async () => {
    try {
      const data = await api.teachers.list();
      setTeachers(data);
    } catch (err) {
      console.error('Failed to load teachers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTeachers(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editTeacher) {
        await api.teachers.update(editTeacher.id, { ...form, basePay: parseInt(form.basePay) || 0 });
        setEditTeacher(null);
      } else {
        await api.teachers.create({ ...form, basePay: parseInt(form.basePay) || 0 });
        setShowForm(false);
      }
      setForm({ name: '', employeeId: '', subject: '', assignedGrade: '', phone: '', basePay: '', status: 'Active' });
      await loadTeachers();
    } catch (err) {
      alert('Error saving teacher: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (t) => {
    setForm({
      name: t.name, employeeId: t.employee_id || '', subject: t.subject || '',
      assignedGrade: t.assigned_grade || '', phone: t.phone || '',
      basePay: t.base_pay || '', status: t.status || 'Active',
    });
    setEditTeacher(t);
  };

  const renderForm = (onCancel) => (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
        <div>
          <label className="form-label">Full Name *</label>
          <input required className="form-input" value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Priya Desai" />
        </div>
        <div>
          <label className="form-label">Employee ID</label>
          <input className="form-input" value={form.employeeId}
            onChange={e => setForm(p => ({ ...p, employeeId: e.target.value }))} placeholder="e.g. TCH-001" />
        </div>
        <div>
          <label className="form-label">Primary Subject</label>
          <input className="form-input" value={form.subject}
            onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Mathematics" />
        </div>
        <div>
          <label className="form-label">Assigned Grade</label>
          <select className="form-select" value={form.assignedGrade}
            onChange={e => setForm(p => ({ ...p, assignedGrade: e.target.value }))}>
            <option value="">— None —</option>
            {GRADES.map(g => <option key={g} value={g}>{formatGrade(g)}</option>)}
          </select>
        </div>
        <div>
          <label className="form-label">Phone</label>
          <input className="form-input" type="tel" value={form.phone}
            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="9876543210" />
        </div>
        <div>
          <label className="form-label">Base Pay (₹/month)</label>
          <input className="form-input" type="number" min="0" value={form.basePay}
            onChange={e => setForm(p => ({ ...p, basePay: e.target.value }))} placeholder="18000" />
        </div>
        <div>
          <label className="form-label">Status</label>
          <select className="form-select" value={form.status}
            onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving...' : (editTeacher ? 'Update' : 'Add Teacher')}
        </button>
      </div>
    </form>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Teachers</h1>
          <p className="page-subtitle">
            {teachers.filter(t => t.status === 'Active').length} active ·&nbsp;
            {teachers.filter(t => t.face_enrolled).length} face-enrolled
          </p>
        </div>
        {can('teachers.add') && (
          <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setEditTeacher(null); }}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Enroll Teacher</>}
          </button>
        )}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>New Teacher Profile</h3>
          {renderForm(() => setShowForm(false))}
        </div>
      )}

      {/* Teachers Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>Loading teachers...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {teachers.length === 0 ? (
            <div className="card" style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center' }}>
              <div className="empty-state">
                <GraduationCap size={40} className="empty-state-icon" />
                <div className="empty-state-title">No teachers enrolled</div>
                <div className="empty-state-desc">Add teachers using the Enroll Teacher button above.</div>
              </div>
            </div>
          ) : teachers.map(t => {
            const sc = STATUS_COLORS[t.status] || STATUS_COLORS.Inactive;
            return (
              <div key={t.id} className="card card-hover" style={{ padding: '20px', position: 'relative' }}>

                {/* Status + Face badge */}
                <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase' }}>
                    {t.status}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: t.face_enrolled ? '#ecfdf5' : '#fef2f2', color: t.face_enrolled ? '#047857' : '#dc2626', borderRadius: '6px', padding: '2px 8px', fontSize: '0.6rem', fontWeight: 800, border: `1px solid ${t.face_enrolled ? '#a7f3d0' : '#fecaca'}` }}>
                    <Scan size={9} /> {t.face_enrolled ? 'FACE OK' : 'NOT ENROLLED'}
                  </span>
                </div>

                {/* Avatar */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#f5f3ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', flexShrink: 0 }}>
                    <UserCheck size={24} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', fontFamily: 'Lexend, sans-serif' }}>{t.name}</div>
                    {t.employee_id && (
                      <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', borderRadius: '6px', padding: '1px 8px', fontSize: '0.7rem', fontWeight: 700, marginTop: '4px', fontFamily: 'monospace' }}>
                        {t.employee_id}
                      </span>
                    )}
                  </div>
                </div>

                <div className="divider" style={{ margin: '14px 0' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.82rem', color: '#475569' }}>
                  {t.subject && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpen size={13} color="#94a3b8" /> {t.subject}
                    </div>
                  )}
                  {t.assigned_grade && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <GraduationCap size={13} color="#94a3b8" /> Class: {formatGrade(t.assigned_grade)}
                    </div>
                  )}
                  {t.base_pay > 0 && (
                    <div style={{ fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                      Base Pay: ₹{parseInt(t.base_pay).toLocaleString('en-IN')}/month
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                  {can('teachers.edit') && (
                    <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => openEdit(t)}>
                      <Edit2 size={13} /> Edit
                    </button>
                  )}
                  {can('teachers.faceEnroll') && (
                    <button
                      className="btn btn-sm"
                      style={{ flex: 1, justifyContent: 'center', background: t.face_enrolled ? '#ecfdf5' : '#eef2ff', color: t.face_enrolled ? '#059669' : '#4f46e5', border: `1px solid ${t.face_enrolled ? '#a7f3d0' : '#c7d2fe'}` }}
                      onClick={() => setEnrollModal(t)}
                    >
                      <Scan size={13} /> {t.face_enrolled ? 'Re-enroll' : 'Enroll Face'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editTeacher && (
        <div className="modal-backdrop">
          <div className="modal-box" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ fontWeight: 700 }}>Edit: {editTeacher.name}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditTeacher(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">{renderForm(() => setEditTeacher(null))}</div>
          </div>
        </div>
      )}

      {/* Face Enrollment Modal */}
      {enrollModal && (
        <FaceEnrollModal
          teacher={enrollModal}
          onClose={() => setEnrollModal(null)}
          onSuccess={() => { setEnrollModal(null); loadTeachers(); }}
        />
      )}
    </div>
  );
}
