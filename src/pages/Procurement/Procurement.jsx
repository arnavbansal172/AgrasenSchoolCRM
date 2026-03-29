import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useAuthStore } from '../../store/authStore';
import { Plus, X, ShoppingCart, CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_CONFIG = {
  Wishlist:  { cls: 'badge-new',     label: 'Wishlist',  color: '#1d4ed8' },
  Approved:  { cls: 'badge-active',  label: 'Approved',  color: '#059669' },
  Purchased: { cls: 'badge-cleared', label: 'Purchased', color: '#059669' },
  Rejected:  { cls: 'badge-left',    label: 'Rejected',  color: '#dc2626' },
};

export default function Procurement() {
  const { can, user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item: '', description: '', estimatedCost: '', category: 'Stationery' });
  const [saving, setSaving] = useState(false);

  const canRequest = can('procurement.request');
  const canApprove = can('procurement.approve');

  const procurements = useLiveQuery(() => db.procurements.orderBy('date').reverse().toArray()) || [];

  const handleAdd = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await db.procurements.add({ ...form, estimatedCost: parseInt(form.estimatedCost) || 0, requestedBy: user?.name, status: 'Wishlist', date: new Date().toISOString() });
      setForm({ item: '', description: '', estimatedCost: '', category: 'Stationery' });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id, status, approvedBy) => {
    await db.procurements.update(id, { status, approvedBy: approvedBy || undefined, updatedAt: new Date().toISOString() });
  };

  const totalApproved  = procurements.filter(p => p.status === 'Approved').reduce((s, p) => s + (p.estimatedCost || 0), 0);
  const totalPurchased = procurements.filter(p => p.status === 'Purchased').reduce((s, p) => s + (p.estimatedCost || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Procurement</h1>
          <p className="page-subtitle">Wishlist → Approval → Purchase workflow</p>
        </div>
        {canRequest && (
          <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
            {showForm ? <X size={16} /> : <><Plus size={16} /> Request Item</>}
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Pending Approval</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1d4ed8' }}>{procurements.filter(p => p.status === 'Wishlist').length}</div>
        </div>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Approved (₹)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>₹{totalApproved.toLocaleString('en-IN')}</div>
        </div>
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Purchased (₹)</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#7c3aed' }}>₹{totalPurchased.toLocaleString('en-IN')}</div>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card animate-in" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '16px' }}>Request Item</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
              <div>
                <label className="form-label">Item Name *</label>
                <input required className="form-input" value={form.item} onChange={e => setForm(p => ({ ...p, item: e.target.value }))} placeholder="e.g. Whiteboard markers" />
              </div>
              <div>
                <label className="form-label">Category</label>
                <select className="form-select" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                  {['Stationery','Furniture','Electronics','Sports','Books','Other'].map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Estimated Cost (₹)</label>
                <input className="form-input" type="number" min="0" value={form.estimatedCost} onChange={e => setForm(p => ({ ...p, estimatedCost: e.target.value }))} placeholder="0" />
              </div>
              <div>
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>Submit Request</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="table-container card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Category</th>
              <th>Requested By</th>
              <th>Est. Cost</th>
              <th>Status</th>
              {canApprove && <th style={{ textAlign: 'right' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {procurements.length === 0 ? (
              <tr>
                <td colSpan={canApprove ? 6 : 5}>
                  <div className="empty-state">
                    <ShoppingCart size={32} className="empty-state-icon" />
                    <div className="empty-state-title">No procurement requests</div>
                    <div className="empty-state-desc">Teachers can submit item requests using the "Request Item" button.</div>
                  </div>
                </td>
              </tr>
            ) : procurements.map(p => (
              <tr key={p.id}>
                <td>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{p.item}</div>
                  {p.description && <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{p.description}</div>}
                </td>
                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{p.category}</td>
                <td style={{ fontSize: '0.82rem', color: '#64748b' }}>{p.requestedBy}</td>
                <td style={{ fontWeight: 700, color: '#7c3aed' }}>{p.estimatedCost ? `₹${p.estimatedCost.toLocaleString('en-IN')}` : '—'}</td>
                <td><span className={`badge ${STATUS_CONFIG[p.status]?.cls}`}>{STATUS_CONFIG[p.status]?.label}</span></td>
                {canApprove && (
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {p.status === 'Wishlist' && (
                        <>
                          <button className="btn btn-success btn-sm" onClick={() => updateStatus(p.id, 'Approved', user?.name)}>
                            <CheckCircle size={13} /> Approve
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => updateStatus(p.id, 'Rejected', user?.name)}>
                            <XCircle size={13} /> Reject
                          </button>
                        </>
                      )}
                      {p.status === 'Approved' && (
                        <button className="btn btn-primary btn-sm" onClick={() => updateStatus(p.id, 'Purchased', user?.name)}>
                          <ShoppingCart size={13} /> Mark Purchased
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
