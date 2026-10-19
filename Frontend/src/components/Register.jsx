import React, { useState, useContext } from 'react';
import { MyContext } from '../MyContext';
import './Auth.css';
import { API_BASE_URL } from '../config.js';

function Register({ onSwitchToLogin }) {
    const { login } = useContext(MyContext);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !email || !password || !confirmPassword) {
            return setError('Please fill in all fields.');
        }

        if (password !== confirmPassword) {
            return setError('Passwords do not match.');
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to register.');
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
                    <h1>Create Account</h1>
                    <p>Register to start using Cognivault</p>
                </div>

                {error && (
                    <div className="authError">
                        <i className="fa-solid fa-circle-exclamation"></i>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="authForm">
                    <div className="formGroup">
                        <label>Username</label>
                        <div className="inputWrapper">
                            <i className="fa-solid fa-user"></i>
                            <input 
                                type="text" 
                                placeholder="Ritesh Chopade" 
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

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

                    <div className="formGroup">
                        <label>Confirm Password</label>
                        <div className="inputWrapper">
                            <i className="fa-solid fa-lock"></i>
                            <input 
                                type="password" 
                                placeholder="••••••••" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="submitBtn" disabled={loading}>
                        {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Sign Up'}
                    </button>
                </form>

                <div className="authFooter">
                    <p>Already have an account? <span onClick={onSwitchToLogin}>Log In</span></p>
                </div>
            </div>
        </div>
    );
}

export default Register;
