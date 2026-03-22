import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { loginUser } from '../lib/api';
import './Auth.css';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (email && password) {
        await loginUser({ email, password });
        navigate('/dashboard');
      }
    } catch (err) {
      alert(err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon">🌱</div>
        </div>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to plan your smart eco-routes</p>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="email">Email Address</label>
            <div className="auth-input-wrapper">
              <input 
                type="email" 
                id="email" 
                className="auth-input" 
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
              <span className="auth-input-icon">✉️</span>
            </div>
          </div>
          
          <div className="auth-input-group">
            <label htmlFor="password">Password</label>
            <div className="auth-input-wrapper">
              <input 
                type="password" 
                id="password" 
                className="auth-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <span className="auth-input-icon">🔒</span>
            </div>
          </div>
          
          <button type="submit" className="auth-button">Sign In</button>
        </form>
        
        <div className="auth-links">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}

