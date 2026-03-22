import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../lib/api';
import './Auth.css';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (name && email && password) {
        // Backend requires a username. Let's create one from the email.
        const username = email.split('@')[0];
        await registerUser({ fullName: name, username, email, password });
        // After successful registration, navigate to signin so they can log in
        navigate('/signin');
      }
    } catch (err) {
      alert(err.message || 'Registration failed');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-brand-logo">
          <div className="auth-brand-icon">🌱</div>
        </div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">Join us for seamless eco-route planning</p>
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-input-group">
            <label htmlFor="name">Full Name</label>
            <div className="auth-input-wrapper">
              <input 
                type="text" 
                id="name" 
                className="auth-input" 
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
              <span className="auth-input-icon">👤</span>
            </div>
          </div>

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
                placeholder="Create a strong password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
              <span className="auth-input-icon">🔒</span>
            </div>
          </div>
          
          <button type="submit" className="auth-button">Sign Up</button>
        </form>
        
        <div className="auth-links">
          Already have an account? <Link to="/signin">Sign in</Link>
        </div>
      </div>
    </div>
  );
}

