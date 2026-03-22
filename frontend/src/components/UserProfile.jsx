import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentUser, getUserCredits } from '../lib/api';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchData() {
      try {
        console.log("fetchin user ")
        const userRes = await getCurrentUser();
        console.log(userRes)
        if (userRes && userRes.data) {
          setUser(userRes.data);
        }

        const creditsRes = await getUserCredits();
        if (creditsRes && creditsRes.data) {
          setCredits(creditsRes.data);
        }
      } catch (err) {
        // Silently navigate to signin so the user console isn't cluttered
        navigate('/signin');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleLogout = () => {
    // Basic logout logic to clear cookie redirect
    document.cookie = "accessToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    navigate('/signin');
  };

  if (loading) {
    return null; // hide while loading
  }

  if (!user) {
    return null;
  }

  return (
    <div className="user-profile-widget">
      <div className="user-profile-header">
        <div className="user-avatar">
          {user.fullName ? user.fullName.charAt(0).toUpperCase() : 'U'}
        </div>
        <div className="user-info">
          <h4>{user.fullName || user.username}</h4>
          <span className="user-email">{user.email}</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          ⏻
        </button>
      </div>

      <div className="user-credits-panel">
        <div className="credit-item">
          <span className="credit-icon">🌱</span>
          <div className="credit-text">
            <span className="credit-value">{credits?.co2EmissionSaved || 40} kg</span>
            <span className="credit-label">CO₂ Saved</span>
          </div>
        </div>
        <div className="credit-divider"></div>
        <div className="credit-item">
          <span className="credit-icon">⭐</span>
          <div className="credit-text">
            <span className="credit-value">{credits?.points || 10}</span>
            <span className="credit-label">Points</span>
          </div>
        </div>
      </div>
    </div>
  );
}
