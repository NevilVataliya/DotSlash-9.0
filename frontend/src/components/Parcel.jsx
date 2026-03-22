import { useState, useEffect } from 'react';
import axios from 'axios';
import { PREDEFINED_LOCATIONS } from '../data/demoData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const PARCEL_API_URL = `${API_BASE_URL}/parcels`;
const USER_API_URL = `${API_BASE_URL}/pools/demo-user`;

export default function Parcel() {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRole, setActiveRole] = useState('owner'); // 'owner' | 'rider'
  
  // Data State
  const [myParcels, setMyParcels] = useState([]); 
  const [availableParcels, setAvailableParcels] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  
  // UI State
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    source: '', destination: '', date: '', time: '', itemDetails: '', weight: '1'
  });

  const fetchParcels = async (user) => {
    try {
      setLoading(true);
      const res = await axios.get(`${PARCEL_API_URL}/all`);
      const all = res.data.data || [];
      
      setMyParcels(all.filter(p => p.ownerId === user._id));
      setMyDeliveries(all.filter(p => p.riderId === user._id));
      setAvailableParcels(all.filter(p => p.status === 'pending' && p.ownerId !== user._id));
    } catch (err) {
      console.warn("Could not fetch parcels from API, backend might not be ready yet.", err.message);
      // For demonstration, we won't crash if the backend endpoint doesn't exist yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initUser = async () => {
      try {
        const res = await axios.get(USER_API_URL);
        const user = res.data.data;
        setCurrentUser(user);
        fetchParcels(user);
      } catch (err) {
        console.error("Failed to init user for parcels", err);
      }
    };
    initUser();
  }, []);

  const handleCreateParcel = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('User not initialized');

    const newParcel = {
      _id: `temp-${Date.now()}`, // Temporary ID for local state
      ownerId: currentUser._id,
      ownerName: currentUser.fullName || 'Demo User',
      ...formData,
      status: 'pending' // pending -> accepted -> picked_up -> dropped
    };
    
    try {
      const res = await axios.post(`${PARCEL_API_URL}/create`, newParcel);
      if (res.data && res.data.data) {
        newParcel._id = res.data.data._id; // Update with real ID if backend works
      }
    } catch (err) {
      console.warn("Backend request failed, updating local state only");
    }
    
    setMyParcels([...myParcels, newParcel]);
    setIsCreating(false);
    setFormData({ source: '', destination: '', date: '', time: '', itemDetails: '', weight: '1' });
    alert("Parcel delivery requested successfully!");
  };

  const updateStatus = async (parcelId, newStatus) => {
    try {
      await axios.put(`${PARCEL_API_URL}/${parcelId}/status`, { 
        status: newStatus, 
        riderId: currentUser._id 
      });
    } catch (err) {
      console.warn("Status update API failed, falling back to local state");
    }

    // Update local state to reflect changes instantly regardless of API
    if (activeRole === 'rider') {
      if (newStatus === 'accepted') {
        const p = availableParcels.find(x => x._id === parcelId);
        if (p) {
          setAvailableParcels(availableParcels.filter(x => x._id !== parcelId));
          setMyDeliveries([...myDeliveries, { ...p, status: newStatus, riderId: currentUser._id }]);
        }
      } else {
        setMyDeliveries(myDeliveries.map(p => p._id === parcelId ? { ...p, status: newStatus } : p));
      }
    } else {
      setMyParcels(myParcels.map(p => p._id === parcelId ? { ...p, status: newStatus } : p));
    }
  };

  const renderStatusBadge = (status) => {
    const statusConfig = {
      'pending': { color: '#fbbf24', label: 'Pending Rider' },
      'accepted': { color: '#60a5fa', label: 'Accepted by Rider' },
      'picked_up': { color: '#818cf8', label: 'In Transit' },
      'dropped': { color: '#34d399', label: 'Delivered' }
    };
    const conf = statusConfig[status] || { color: '#9ca3af', label: status };
    
    return (
      <span style={{ 
        backgroundColor: `${conf.color}20`, 
        color: conf.color,
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '0.75rem',
        fontWeight: 'bold',
        display: 'inline-block'
      }}>
        {conf.label}
      </span>
    );
  };

  return (
    <div className="pool-container">
      <div className="pool-header">
        <h2>Parcel Delivery</h2>
        <div className="role-toggle" style={{display: 'flex', gap: '10px'}}>
          <button 
            className={`btn-secondary ${activeRole === 'owner' ? 'active' : ''}`}
            style={{background: activeRole === 'owner' ? '#6366f1' : 'transparent'}}
            onClick={() => setActiveRole('owner')}
          >
            Owner
          </button>
          <button 
            className={`btn-secondary ${activeRole === 'rider' ? 'active' : ''}`}
            style={{background: activeRole === 'rider' ? '#6366f1' : 'transparent'}}
            onClick={() => setActiveRole('rider')}
          >
            Rider
          </button>
        </div>
      </div>

      {activeRole === 'owner' && (
        <>
          <div style={{marginBottom: '20px'}}>
            <button 
              className="schedule-toggle-btn"
              style={{width: '100%'}}
              onClick={() => setIsCreating(!isCreating)}
            >
              {isCreating ? 'Cancel Request' : 'Create New Parcel Request'}
            </button>
          </div>

          {isCreating && (
            <form className="schedule-form panel" onSubmit={handleCreateParcel}>
              <div className="form-group">
                <label>Item Description</label>
                <input 
                  type="text" 
                  className="pool-input"
                  placeholder="e.g. Small box, Documents..."
                  value={formData.itemDetails}
                  onChange={(e) => setFormData({...formData, itemDetails: e.target.value})}
                  required
                />
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Pickup Location</label>
                  <select 
                    className="pool-input"
                    value={formData.source}
                    onChange={(e) => setFormData({...formData, source: e.target.value})}
                    required
                  >
                    <option value="">Select city</option>
                    {PREDEFINED_LOCATIONS.map(loc => (
                      <option key={`src-${loc.name}`} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Dropoff Location</label>
                  <select 
                    className="pool-input"
                    value={formData.destination}
                    onChange={(e) => setFormData({...formData, destination: e.target.value})}
                    required
                  >
                    <option value="">Select city</option>
                    {PREDEFINED_LOCATIONS.map(loc => (
                      <option key={`dest-${loc.name}`} value={loc.name}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>Date</label>
                  <input 
                    type="date" 
                    className="pool-input"
                    min={new Date().toISOString().split('T')[0]}
                    value={formData.date}
                    onChange={(e) => setFormData({...formData, date: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Time</label>
                  <input 
                    type="time" 
                    className="pool-input"
                    value={formData.time}
                    onChange={(e) => setFormData({...formData, time: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Approx. Weight (kg)</label>
                <input 
                  type="number" 
                  className="pool-input"
                  min="0.5"
                  step="0.5"
                  value={formData.weight}
                  onChange={(e) => setFormData({...formData, weight: e.target.value})}
                  required
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Request Delivery</button>
              </div>
            </form>
          )}

          <div className="ride-list">
            <h3 style={{marginBottom: '15px'}}>My Parcels</h3>
            {myParcels.length > 0 ? (
              myParcels.map(parcel => (
                <div key={parcel._id} className="ride-card">
                  <div className="ride-card-top">
                    <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{parcel.itemDetails}</div>
                    <div>{renderStatusBadge(parcel.status)}</div>
                  </div>
                  <div className="ride-route" style={{margin: '12px 0'}}>
                    <strong>{parcel.source}</strong>
                    <span className="route-arrow">→</span>
                    <strong>{parcel.destination}</strong>
                  </div>
                  <div className="ride-details" style={{justifyContent: 'flex-start', gap: '15px'}}>
                    <div className="ride-detail-item"><span>📅</span> {parcel.date} {parcel.time}</div>
                    <div className="ride-detail-item"><span>⚖️</span> {parcel.weight} kg</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state panel"><p>You haven't requested any parcel deliveries yet.</p></div>
            )}
          </div>
        </>
      )}

      {activeRole === 'rider' && (
        <>
          <div className="ride-list">
            <h3 style={{marginBottom: '15px'}}>My Deliveries</h3>
            {myDeliveries.length > 0 ? (
              myDeliveries.map(parcel => (
                <div key={`del-${parcel._id}`} className="ride-card">
                  <div className="ride-card-top">
                    <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{parcel.itemDetails}</div>
                    <div>{renderStatusBadge(parcel.status)}</div>
                  </div>
                  <div className="ride-route" style={{margin: '12px 0'}}>
                    <strong>{parcel.source}</strong>
                    <span className="route-arrow">→</span>
                    <strong>{parcel.destination}</strong>
                  </div>
                  <div className="ride-details" style={{justifyContent: 'flex-start', gap: '15px', marginBottom: '15px'}}>
                    <div className="ride-detail-item"><span>👤</span> {parcel.ownerName || 'Customer'}</div>
                    <div className="ride-detail-item"><span>⚖️</span> {parcel.weight} kg</div>
                  </div>
                  <div className="form-actions">
                    {parcel.status === 'accepted' && (
                      <button className="btn-primary" onClick={() => updateStatus(parcel._id, 'picked_up')}>Mark Picked Up</button>
                    )}
                    {parcel.status === 'picked_up' && (
                      <button className="btn-primary" onClick={() => updateStatus(parcel._id, 'dropped')} style={{background: '#10b981'}}>Mark Delivered</button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state panel" style={{marginBottom: '20px'}}><p>You have no active deliveries.</p></div>
            )}

            <h3 style={{marginBottom: '15px'}}>Available Parcels to Deliver</h3>
            {loading ? (
              <p>Loading...</p>
            ) : availableParcels.length > 0 ? (
              availableParcels.map(parcel => (
                <div key={`avail-${parcel._id}`} className="ride-card">
                  <div className="ride-card-top">
                    <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{parcel.itemDetails}</div>
                    <div>{renderStatusBadge(parcel.status)}</div>
                  </div>
                  <div className="ride-route" style={{margin: '12px 0'}}>
                    <strong>{parcel.source}</strong>
                    <span className="route-arrow">→</span>
                    <strong>{parcel.destination}</strong>
                  </div>
                  <div className="ride-details" style={{justifyContent: 'flex-start', gap: '15px'}}>
                    <div className="ride-detail-item"><span>📅</span> {parcel.date} {parcel.time}</div>
                    <div className="ride-detail-item"><span>⚖️</span> {parcel.weight} kg</div>
                  </div>
                  <button 
                    className="contact-btn" 
                    style={{marginTop: '15px', width: '100%'}}
                    onClick={() => updateStatus(parcel._id, 'accepted')}
                  >
                    Accept Parcel Delivery
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-state panel"><p>No pending parcels available right now.</p></div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
