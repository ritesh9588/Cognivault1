import React, { useContext } from 'react';
import { MyContext } from '../MyContext';
import './DashboardViews.css';

function Settings() {
    const { darkMode, setDarkMode } = useContext(MyContext);

    return (
        <div className="dashboardView">
            <div className="viewHeader">
                <div>
                    <h1>Settings</h1>
                    <p className="subtitle">Manage your platform preferences, API configurations, and account profiles.</p>
                </div>
            </div>

            <div className="settingsGrid">
                <div className="settingsSection">
                    <h2><i className="fa-solid fa-palette"></i> Appearance & Theme</h2>
                    <p className="sectionDesc">Customize the look and feel of the platform.</p>
                    <div className="settingItem">
                        <div className="settingLabel">
                            <span>Dark Mode</span>
                            <span className="subLabel">Enable dark theme style layout.</span>
                        </div>
                        <button 
                            className={`toggleBtn ${darkMode ? 'active' : ''}`}
                            onClick={() => setDarkMode(!darkMode)}
                        >
                            <span className="toggleKnob"></span>
                        </button>
                    </div>
                </div>

                <div className="settingsSection">
                    <h2><i className="fa-solid fa-robot"></i> AI Model Configuration</h2>
                    <p className="sectionDesc">Select which model backend powers the chat completions.</p>
                    <div className="settingItem">
                        <div className="settingLabel">
                            <span>Default Chat Model</span>
                            <span className="subLabel">Currently powered by Gemini Flash API</span>
                        </div>
                        <select className="selectBox" defaultValue="gemini-flash">
                            <option value="gemini-flash">Gemini 2.5 Flash (Recommended)</option>
                            <option value="gemini-pro" disabled>Gemini 2.5 Pro (Enterprise)</option>
                        </select>
                    </div>
                </div>

                <div className="settingsSection">
                    <h2><i className="fa-solid fa-server"></i> System Environment</h2>
                    <p className="sectionDesc">Active backend and database parameters.</p>
                    <div className="sysInfo">
                        <div className="sysItem">
                            <span>Backend Server Status:</span>
                            <span className="statusVal green"><i className="fa-solid fa-circle"></i> Connected (8080)</span>
                        </div>
                        <div className="sysItem">
                            <span>Database State:</span>
                            <span className="statusVal green"><i className="fa-solid fa-circle"></i> Connected (MongoDB)</span>
                        </div>
                        <div className="sysItem">
                            <span>Platform Version:</span>
                            <span className="statusVal">v2.0.0-Beta</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;
