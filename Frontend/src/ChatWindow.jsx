import "./ChatWindow.css";
import Chat from "./Chat.jsx";
import { MyContext } from "./MyContext.jsx";
import { useContext, useState, useEffect } from "react";
import { ScaleLoader } from "react-spinners";
import KnowledgeBase from "./components/KnowledgeBase.jsx";
import AITools from "./components/AITools.jsx";
import Analytics from "./components/Analytics.jsx";
import Settings from "./components/Settings.jsx";
import { API_BASE_URL } from './config.js';

function ChatWindow() {
    const {
        prompt, setPrompt, 
        reply, setReply, 
        currThreadId, 
        setPrevChats, 
        setNewChat,
        darkMode, setDarkMode,
        sidebarOpen, setSidebarOpen,
        currentTab, setCurrentTab,
        token, logout
    } = useContext(MyContext);
    
    const [loading, setLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState(null);
    const [charCount, setCharCount] = useState(0);

    const getReply = async () => {
        if (!prompt.trim()) return;
        
        setLoading(true);
        setNewChat(false);
        setError(null);

        const options = {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                message: prompt,
                threadId: currThreadId
            })
        };

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat`, options);
            
            const res = await response.json();
            if (!response.ok || !res.success) {
                throw new Error(res.error || 'Failed to get response from server');
            }
            
            const assistantMsg = res.message;
            setPrevChats(prevChats => [
                ...prevChats,
                { role: "user", content: prompt },
                { role: "assistant", content: assistantMsg.content, isRag: assistantMsg.isRag, sources: assistantMsg.sources }
            ]);
            setReply(assistantMsg.content);
        } catch(err) {
            console.error("Error:", err);
            setError(err.message || "Failed to get response. Please check your connection and try again.");
        } finally {
            setLoading(false);
        }
    }

    // Clear prompt and count when reply is set
    useEffect(() => {
        if(reply) {
            setPrompt("");
            setCharCount(0);
        }
    }, [reply]);

    // Update character count
    useEffect(() => {
        setCharCount(prompt.length);
    }, [prompt]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (isOpen && !e.target.closest('.userIconDiv') && !e.target.closest('.dropDown')) {
                setIsOpen(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [isOpen]);

    const handleProfileClick = () => {
        setIsOpen(!isOpen);
    }

    const toggleTheme = () => {
        setDarkMode(!darkMode);
        setIsOpen(false);
    }

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    }

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            getReply();
        }
    }

    return (
        <div className="chatWindow">
            <div className="navbar">
                <div className="navLeft">
                    <button className="menuBtn" onClick={toggleSidebar}>
                        <i className="fa-solid fa-bars"></i>
                    </button>
                    <span className="appTitle" onClick={() => setCurrentTab('chat')} style={{ cursor: 'pointer' }}>
                        <i className="fa-solid fa-circle-dot"></i> Cognivault
                    </span>
                </div>
                
                <div className="navRight">
                    <button className="themeToggle" onClick={toggleTheme} title="Toggle theme">
                        <i className={`fa-solid fa-${darkMode ? 'sun' : 'moon'}`}></i>
                    </button>
                    <div className="userIconDiv" onClick={handleProfileClick}>
                        <span className="userIcon">
                            <i className="fa-solid fa-user"></i>
                        </span>
                    </div>
                </div>
            </div>

            {isOpen && 
                <div className="dropDown">
                    <div className="dropDownItem" onClick={toggleTheme}>
                        <i className={`fa-solid fa-${darkMode ? 'sun' : 'moon'}`}></i> 
                        {darkMode ? 'Light Mode' : 'Dark Mode'}
                    </div>
                    <div className="dropDownItem" onClick={() => { setCurrentTab('settings'); setIsOpen(false); }}>
                        <i className="fa-solid fa-gear"></i> Settings
                    </div>
                    <div className="dropDownItem" onClick={logout} style={{ color: '#ef4444' }}>
                        <i className="fa-solid fa-right-from-bracket" style={{ color: '#ef4444' }}></i> Log Out
                    </div>
                </div>
            }

            {currentTab === 'chat' && (
                <>
                    <Chat />

                    {loading && (
                        <div className="loadingContainer">
                            <ScaleLoader color={darkMode ? "#6366f1" : "#4f46e5"} loading={loading} />
                            <p className="loadingText">Thinking...</p>
                        </div>
                    )}

                    {error && (
                        <div className="errorMessage">
                            <i className="fa-solid fa-circle-exclamation"></i>
                            <span>{error}</span>
                            <button onClick={() => setError(null)}>
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    )}
                    
                    <div className="chatInput">
                        <div className="inputBox">
                            <textarea 
                                placeholder="Ask me anything..." 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                onKeyDown={handleKeyPress}
                                rows="1"
                                disabled={loading}
                            />
                            <div className="inputActions">
                                {charCount > 0 && (
                                    <span className="charCount">{charCount}</span>
                                )}
                                <button 
                                    id="submit" 
                                    onClick={getReply}
                                    disabled={loading || !prompt.trim()}
                                    title="Send message"
                                >
                                    <i className="fa-solid fa-paper-plane"></i>
                                </button>
                            </div>
                        </div>
                        <p className="info">
                            <i className="fa-solid fa-shield-halved"></i>
                            Cognivault may produce inaccurate information. Verify important details.
                        </p>
                    </div>
                </>
            )}

            {currentTab === 'knowledge' && <KnowledgeBase />}
            {currentTab === 'tools' && <AITools />}
            {currentTab === 'analytics' && <Analytics />}
            {currentTab === 'settings' && <Settings />}
        </div>
    );
}

export default ChatWindow;