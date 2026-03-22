import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { PREDEFINED_LOCATIONS } from '../data/demoData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/$/, '');
const POOL_API_URL = `${API_BASE_URL}/pools`;
const MY_TRIP_ID = '65f0a34b2c12345678901234';

export default function RidePool() {
  const [currentUser, setCurrentUser] = useState(null);
  const [rides, setRides] = useState([]);
  const [myPools, setMyPools] = useState([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  // Request management state
  const [showContactModal, setShowContactModal] = useState(null); // rideId
  const [loading, setLoading] = useState(true);

  // Form state
  const [formData, setFormData] = useState({
    source: '',
    destination: '',
    date: '',
    time: '',
    seats: 3
  });

  const fetchPools = async (userId) => {
    try {
      setLoading(true);
      // Fetch all available pools
      const allRes = await axios.get(`${POOL_API_URL}/all`);
      setRides(allRes.data.data || []);

      if (userId) {
        // Fetch pools created by this driver
        const driverRes = await axios.get(`${POOL_API_URL}/driver/${userId}`);
        setMyPools(driverRes.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch pools:", err);
    } finally {
      setLoading(false);
    }
  };

  const initDemoUser = async () => {
    try {
      const res = await axios.get(`${POOL_API_URL}/demo-user`);
      const user = res.data.data;
      setCurrentUser(user);
      fetchPools(user._id);
    } catch (err) {
      console.error("Failed to fetch demo user:", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    initDemoUser();
  }, []);

  const filteredRides = useMemo(() => {
    if (!filterDate) return rides;
    return rides.filter(ride => {
      const rideDate = new Date(ride.departureTime).toISOString().split('T')[0];
      return rideDate === filterDate;
    });
  }, [rides, filterDate]);

  const handleSchedule = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("User not initialized");

    const sourceLoc = PREDEFINED_LOCATIONS.find(loc => loc.name === formData.source);
    const destLoc = PREDEFINED_LOCATIONS.find(loc => loc.name === formData.destination);

    if (!sourceLoc || !destLoc) {
      alert("Please select valid source and destination cities.");
      return;
    }

    const departureTime = new Date(`${formData.date}T${formData.time}`).toISOString();

    try {
      await axios.post(`${POOL_API_URL}/ready`, {
        driverId: currentUser._id,
        tripId: MY_TRIP_ID,
        originLat: sourceLoc.lat,
        originLng: sourceLoc.lng,
        destLat: destLoc.lat,
        destLng: destLoc.lng,
        departureTime,
        availableSeats: formData.seats,
        pricePerSeat: 0 // Free or negotiated later
      });
      alert('Ride scheduled successfully!');
      setIsScheduling(false);
      setFormData({ source: '', destination: '', date: '', time: '', seats: 3 });
      fetchPools(currentUser._id);
    } catch (err) {
      console.error(err);
      alert('Failed to schedule ride.');
    }
  };

  const handleJoinClick = (rideId) => {
    setShowContactModal(rideId);
  };

  const submitJoinRequest = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert("User not initialized");

    const ride = rides.find(r => r._id === showContactModal);
    if (!ride) return;

    try {
      await axios.post(`${POOL_API_URL}/request`, {
        poolId: ride._id,
        passengerId: currentUser._id,
        pickupLat: ride.origin.coordinates[1],
        pickupLng: ride.origin.coordinates[0],
        dropoffLat: ride.destination.coordinates[1],
        dropoffLng: ride.destination.coordinates[0]
      });
      alert(`Request sent! Your email will be shared if accepted.`);
      setShowContactModal(null);
      fetchPools(currentUser._id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to send request.');
      setShowContactModal(null);
    }
  };

  const handleAcceptRequest = async (poolId, passengerId) => {
    try {
      await axios.post(`${POOL_API_URL}/accept`, {
        poolId,
        passengerId
      });
      alert('Request accepted!');
      fetchPools(currentUser?._id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to accept request.');
    }
  };

  const handleDeclineRequest = async (poolId, passengerId) => {
    try {
      await axios.post(`${POOL_API_URL}/decline`, {
        poolId,
        passengerId
      });
      alert('Request declined.');
      fetchPools(currentUser?._id);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to decline request.');
    }
  };

  // Extract incoming requests from driver's pools
  const incomingRequests = [];
  myPools.forEach(pool => {
    if (pool.passengers && pool.passengers.length > 0) {
      pool.passengers.forEach(req => {
        incomingRequests.push({
          ...req,
          poolId: pool._id,
          // Since we don't store city names in DB, we'll just refer to it generally
          rideDetails: `Ride on ${new Date(pool.departureTime).toLocaleDateString()}`
        });
      });
    }
  });

  // Helper to reverse map coordinates to a known city name for display
  const getCityName = (coordinates) => {
    if (!coordinates || !coordinates.length) return "Unknown";
    const [lng, lat] = coordinates;
    let closest = "Unknown";
    let minDiff = Infinity;
    for (const loc of PREDEFINED_LOCATIONS) {
      const diff = Math.abs(loc.lat - lat) + Math.abs(loc.lng - lng);
      if (diff < minDiff && diff < 1.0) {
        minDiff = diff;
        closest = loc.name;
      }
    }
    return closest;
  };

  return (
    <div className="pool-container">
      <div className="pool-header">
        <h2>Ride Pool</h2>
        {currentUser && (
          <button
            className="schedule-toggle-btn"
            onClick={() => setIsScheduling(!isScheduling)}
          >
            {isScheduling ? 'Cancel' : 'Schedule Ride'}
          </button>
        )}
      </div>

      {isScheduling && (
        <form className="schedule-form panel" onSubmit={handleSchedule}>
          <div className="form-group">
            <label>Source</label>
            <select
              className="pool-input"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
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
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input
                type="time"
                className="pool-input"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, seats: parseInt(e.target.value) })}
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
            {incomingRequests.map(req => {
              const requesterName = req.userId?.fullName || "A User";
              const requesterEmail = req.userId?.email || "No email available";
              const passengerId = req.userId?._id || req.userId;

              return (
                <div key={req._id} className={`request-item ${req.status}`}>
                  <div className="request-info">
                    <span className="requester"><strong>{requesterName}</strong> wants to join your ride:</span>
                    <span className="ride-summary">{req.rideDetails}</span>
                  </div>
                  <div className="request-actions">
                    {req.status === 'pending' ? (
                      <>
                        <button onClick={() => handleAcceptRequest(req.poolId, passengerId)} className="accept-btn">Accept</button>
                        <button onClick={() => handleDeclineRequest(req.poolId, passengerId)} className="decline-btn">Decline</button>
                      </>
                    ) : req.status === 'accepted' ? (
                      <span className="status-badge accepted">Accepted - Email: {requesterEmail}</span>
                    ) : (
                      <span className="status-badge declined">{req.status}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showContactModal && (
        <div className="modal-overlay">
          <div className="modal-content panel">
            <h3>Confirm Request</h3>
            <p>Send a request to join this ride? Your profile email will be shared with the driver.</p>
            <form onSubmit={submitJoinRequest}>
              <div className="form-actions" style={{ marginTop: '20px' }}>
                <button type="submit" className="btn-primary">Send Request</button>
                <button type="button" className="btn-secondary" onClick={() => setShowContactModal(null)}>Cancel</button>
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
          style={{ padding: '4px 8px' }}
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
        {loading ? (
          <p>Loading rides...</p>
        ) : filteredRides.length > 0 ? (
          filteredRides.map(ride => {
            const ownerName = ride.driverId?.fullName || "Unknown Driver";
            const sourceName = getCityName(ride.origin?.coordinates);
            const destName = getCityName(ride.destination?.coordinates);
            const rideDate = new Date(ride.departureTime).toLocaleDateString();
            const rideTime = new Date(ride.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const isMyRide = currentUser && (ride.driverId?._id === currentUser._id || ride.driverId === currentUser._id);
            const myRequest = currentUser && ride.passengers?.find(p => p.userId?._id === currentUser._id || p.userId === currentUser._id);

            return (
              <div key={ride._id} className="ride-card">
                <div className="ride-card-top">
                  <div className="owner-info">
                    <div className="owner-avatar">
                      {ownerName.split(' ').map(n => n[0]).join('').substring(0, 2)}
                    </div>
                    <div>
                      <div className="owner-name">{ownerName}</div>
                      <div className="ride-detail-item" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        Vehicle
                      </div>
                    </div>
                  </div>
                  <div className="ride-seats">{ride.availableSeats} seats left</div>
                </div>

                <div className="ride-route">
                  <strong>{sourceName}</strong>
                  <span className="route-arrow">→</span>
                  <strong>{destName}</strong>
                </div>

                <div className="ride-details">
                  <div className="ride-detail-item">
                    <span>📅</span> {rideDate}
                  </div>
                  <div className="ride-detail-item">
                    <span>🕒</span> {rideTime}
                  </div>
                </div>

                {!isMyRide && (
                  !myRequest ? (
                    <button
                      className="contact-btn"
                      onClick={() => handleJoinClick(ride._id)}
                    >
                      Contact to Join
                    </button>
                  ) : (
                    <button className="contact-btn" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
                      {myRequest.status === 'pending' ? 'Request Sent' : `Status: ${myRequest.status}`}
                    </button>
                  )
                )}
              </div>
            );
          })
        ) : (
          <div className="empty-state panel">
            <p>No rides found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
