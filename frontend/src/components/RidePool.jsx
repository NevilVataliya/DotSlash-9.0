import { useState, useMemo } from 'react';
import { RIDE_POOL_RECORDS, PREDEFINED_LOCATIONS } from '../data/demoData';

export default function RidePool() {
  const [rides, setRides] = useState([
    {
      id: 'initial_you_ride',
      owner: 'You',
      source: 'New Delhi',
      destination: 'Jaipur',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
      seats: 3,
      status: 'available',
      vehicleName: 'Sedan (Petrol)'
    },
    ...RIDE_POOL_RECORDS
  ]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  
  // Request management state
  const [joinRequests, setJoinRequests] = useState([
    {
      id: 'req_mock_1',
      rideId: 'initial_you_ride', // We'll need to make sure this matches or just use a generic one
      rideDetails: 'New Delhi → Jaipur',
      owner: 'You',
      requesterName: 'Vikram AD',
      requesterPhone: '+91 9988776655',
      status: 'pending'
    }
  ]);
  const [showPhoneModal, setShowPhoneModal] = useState(null); // rideId
  const [requesterPhone, setRequesterPhone] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    date: '',
    time: '',
    seats: 3
  });

  const filteredRides = useMemo(() => {
    if (!filterDate) return rides;
    return rides.filter(ride => ride.date === filterDate);
  }, [rides, filterDate]);

  const handleSchedule = (e) => {
    e.preventDefault();
    const newRide = {
      id: `r${Date.now()}`,
      owner: 'You',
      ...formData,
      status: 'available',
      vehicleName: 'Your Vehicle'
    };
    setRides([newRide, ...rides]);
    setIsScheduling(false);
    setFormData({ source: '', destination: '', date: '', time: '', seats: 3 });
    alert('Ride scheduled successfully!');
  };

  const handleJoinClick = (rideId) => {
    setShowPhoneModal(rideId);
  };

  const submitJoinRequest = (e) => {
    e.preventDefault();
    const ride = rides.find(r => r.id === showPhoneModal);
    const newRequest = {
      id: `req${Date.now()}`,
      rideId: showPhoneModal,
      rideDetails: `${ride.source} → ${ride.destination}`,
      owner: ride.owner,
      requesterName: 'You',
      requesterPhone: requesterPhone,
      status: 'pending'
    };
    
    setJoinRequests([...joinRequests, newRequest]);
    setShowPhoneModal(null);
    setRequesterPhone('');
    alert(`Request sent to ${ride.owner}! Your phone number (${requesterPhone}) has been shared.`);
  };

  const handleAcceptRequest = (requestId) => {
    setJoinRequests(joinRequests.map(req => 
      req.id === requestId ? { ...req, status: 'accepted' } : req
    ));
    const req = joinRequests.find(r => r.id === requestId);
    alert(`Request accepted! You can now contact ${req.requesterName} at ${req.requesterPhone}.`);
  };

  const handleDeclineRequest = (requestId) => {
    setJoinRequests(joinRequests.map(req => 
      req.id === requestId ? { ...req, status: 'declined' } : req
    ));
    alert('Request declined.');
  };

  // Check if there are any requests for rides owned by "You"
  const myRides = rides.filter(r => r.owner === 'You');
  const incomingRequests = joinRequests.filter(req => 
    myRides.some(ride => ride.id === req.rideId) && req.requesterName !== 'You'
  );

  return (
    <div className="pool-container">
      <div className="pool-header">
        <h2>Ride Pool</h2>
        <button 
          className="schedule-toggle-btn"
          onClick={() => setIsScheduling(!isScheduling)}
        >
          {isScheduling ? 'Cancel' : 'Schedule Ride'}
        </button>
      </div>

      {isScheduling && (
        <form className="schedule-form panel" onSubmit={handleSchedule}>
          <div className="form-group">
            <label>Source</label>
            <select 
              className="pool-input"
              value={formData.source}
              onChange={(e) => setFormData({...formData, source: e.target.value})}
              required
            >
              <option value="">Select city</option>
              {PREDEFINED_LOCATIONS.map(loc => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Destination</label>
            <select 
              className="pool-input"
              value={formData.destination}
              onChange={(e) => setFormData({...formData, destination: e.target.value})}
              required
            >
              <option value="">Select city</option>
              {PREDEFINED_LOCATIONS.map(loc => (
                <option key={loc.name} value={loc.name}>{loc.name}</option>
              ))}
            </select>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Date</label>
              <input 
                type="date" 
                className="pool-input"
                min={new Date().toISOString().split('T')[0]}
                max={new Date(new Date().setDate(new Date().getDate() + 7)).toISOString().split('T')[0]}
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
            <label>Available Seats</label>
            <input 
              type="number" 
              className="pool-input"
              min="1"
              max="6"
              value={formData.seats}
              onChange={(e) => setFormData({...formData, seats: parseInt(e.target.value)})}
              required
            />
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary">Post Ride</button>
          </div>
        </form>
      )}

      {/* Manage Incoming Requests Section */}
      {incomingRequests.length > 0 && (
        <div className="requests-section panel">
          <h3 className="section-title">Incoming Requests</h3>
          <div className="requests-list">
            {incomingRequests.map(req => (
              <div key={req.id} className={`request-item ${req.status}`}>
                <div className="request-info">
                  <span className="requester"><strong>{req.requesterName}</strong> wants to join your ride:</span>
                  <span className="ride-summary">{req.rideDetails}</span>
                </div>
                <div className="request-actions">
                  {req.status === 'pending' ? (
                    <>
                      <button onClick={() => handleAcceptRequest(req.id)} className="accept-btn">Accept</button>
                      <button onClick={() => handleDeclineRequest(req.id)} className="decline-btn">Decline</button>
                    </>
                  ) : req.status === 'accepted' ? (
                    <span className="status-badge accepted">Accepted - Call {req.requesterPhone}</span>
                  ) : (
                    <span className="status-badge declined">Declined</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phone Number Modal */}
      {showPhoneModal && (
        <div className="modal-overlay">
          <div className="modal-content panel">
            <h3>Enter Your Contact Info</h3>
            <p>Share your phone number so the owner can contact you if they accept.</p>
            <form onSubmit={submitJoinRequest}>
              <div className="form-group">
                <label>Phone Number</label>
                <input 
                  type="tel" 
                  className="pool-input" 
                  placeholder="+91 XXXXX XXXXX"
                  value={requesterPhone}
                  onChange={(e) => setRequesterPhone(e.target.value)}
                  required 
                  autoFocus
                />
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary">Send Request</button>
                <button type="button" className="btn-secondary" onClick={() => setShowPhoneModal(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="pool-filters">
        <span className="filter-label">Filter by Date:</span>
        <input 
          type="date" 
          className="pool-input" 
          style={{padding: '4px 8px'}}
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
        />
        {filterDate && (
          <button 
            className="remove-stop-btn" 
            onClick={() => setFilterDate('')}
            title="Clear filter"
          >
            ✕
          </button>
        )}
      </div>

      <div className="ride-list">
        {filteredRides.length > 0 ? (
          filteredRides.map(ride => (
            <div key={ride.id} className="ride-card">
              <div className="ride-card-top">
                <div className="owner-info">
                  <div className="owner-avatar">
                    {ride.owner.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="owner-name">{ride.owner}</div>
                    <div className="ride-detail-item" style={{fontSize: '10px', color: 'var(--text-muted)'}}>
                      {ride.vehicleName}
                    </div>
                  </div>
                </div>
                <div className="ride-seats">{ride.seats} seats left</div>
              </div>

              <div className="ride-route">
                <strong>{ride.source}</strong>
                <span className="route-arrow">→</span>
                <strong>{ride.destination}</strong>
              </div>

              <div className="ride-details">
                <div className="ride-detail-item">
                  <span>📅</span> {ride.date}
                </div>
                <div className="ride-detail-item">
                  <span>🕒</span> {ride.time}
                </div>
              </div>

              {ride.owner !== 'You' && (
                <button 
                  className="contact-btn"
                  onClick={() => handleJoinClick(ride.id)}
                >
                  Contact to Join
                </button>
              )}
            </div>
          ))
        ) : (
          <div className="empty-state panel">
            <p>No rides found for this date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
