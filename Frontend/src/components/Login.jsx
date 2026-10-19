import React, { useState, useContext } from 'react';
import { MyContext } from '../MyContext';
import './Auth.css';
import { API_BASE_URL } from '../config.js';

function Login({ onSwitchToRegister }) {
    const { login } = useContext(MyContext);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email || !password) {
            return setError('Please fill in all fields.');
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to log in.');
            }

            login(data.token, data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="authContainer">
            <div className="authCard">
                <div className="authHeader">
                    <div className="logoIcon">
                        <i className="fa-solid fa-circle-dot"></i>
                    </div>
                    <h1>Welcome Back</h1>
                    <p>Log in to access your Cognivault workspace</p>
                </div>

                {error && (
                    <div className="authError">
                        <i className="fa-solid fa-circle-exclamation"></i>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="authForm">
                    <div className="formGroup">
                        <label>Email Address</label>
                        <div className="inputWrapper">
                            <i className="fa-solid fa-envelope"></i>
                            <input 
                                type="email" 
                                placeholder="name@company.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="formGroup">
                        <label>Password</label>
                        <div className="inputWrapper">
                            <i className="fa-solid fa-lock"></i>
                            <input 
                                type="password" 
                                placeholder="••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="submitBtn" disabled={loading}>
                        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Log In'}
                    </button>
                </form>

                <div className="authFooter">
                    <p>Don't have an account? <span onClick={onSwitchToRegister}>Sign Up</span></p>
                </div>
            </div>
        </div>
    );
}

export default Login;
