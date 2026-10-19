import "./Sidebar.css";
import { useContext, useEffect, useState } from "react";
import { MyContext } from "./MyContext.jsx";
import { v4 as uuidv4 } from "uuid";
import { API_BASE_URL } from './config.js';

function Sidebar() {
    const {
        allThreads, setAllThreads, 
        currThreadId, 
        setNewChat, 
        setPrompt, 
        setReply, 
        setCurrThreadId, 
        setPrevChats,
        sidebarOpen, 
        setSidebarOpen,
        currentTab,
        setCurrentTab,
        token
    } = useContext(MyContext);

    const [searchQuery, setSearchQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const getAllThreads = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/thread`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch threads');
            
            const res = await response.json();
            const filteredData = res.map(thread => ({
                threadId: thread.threadId, 
                title: thread.title,
                updatedAt: thread.updatedAt
            }));
            setAllThreads(filteredData);
        } catch(err) {
            console.error("Error fetching threads:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getAllThreads();
    }, [currThreadId]);

    // Debounced semantic search
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const response = await fetch(`${API_BASE_URL}/api/thread/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { "Authorization": `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setSearchResults(data);
                }
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 400);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, token]);

    const createNewChat = () => {
        setNewChat(true);
        setPrompt("");
        setReply(null);
        setCurrThreadId(uuidv4());
        setPrevChats([]);
        setCurrentTab("chat");
        
        // Close sidebar on mobile after creating new chat
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    }

    const changeThread = async (newThreadId) => {
        setCurrThreadId(newThreadId);
        setCurrentTab("chat");

        try {
            const response = await fetch(`${API_BASE_URL}/api/thread/${newThreadId}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch thread');
            
            const res = await response.json();
            setPrevChats(res);
            setNewChat(false);
            setReply(null);

            // Close sidebar on mobile after selecting thread
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            }
        } catch(err) {
            console.error("Error fetching thread:", err);
        }
    }   

    const deleteThread = async (threadId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this conversation?");
        if (!confirmDelete) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/thread/${threadId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error('Failed to delete thread');

            // Update threads - remove deleted thread
            setAllThreads(prev => prev.filter(thread => thread.threadId !== threadId));

            // If deleted thread was current, create new chat
            if(threadId === currThreadId) {
                createNewChat();
            }
        } catch(err) {
            console.error("Error deleting thread:", err);
            alert("Failed to delete conversation. Please try again.");
        }
    }

    // Filter threads based on search query
    const filteredThreads = allThreads?.filter(thread => 
        thread.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Format date for display
    const formatDate = (date) => {
        if (!date) return '';
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        // Less than 24 hours
        if (diff < 86400000) {
            return 'Today';
        }
        // Less than 48 hours
        if (diff < 172800000) {
            return 'Yesterday';
        }
        // Less than 7 days
        if (diff < 604800000) {
            return d.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    return (
        <section className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
            <div className="sidebarHeader">
                <button className="newChatBtn" onClick={createNewChat} title="New chat">
                    <i className="fa-solid fa-plus"></i>
                    <span>New Chat</span>
                </button>
                
                <button 
                    className="closeSidebarBtn" 
                    onClick={() => setSidebarOpen(false)}
                    title="Close sidebar"
                >
                    <i className="fa-solid fa-xmark"></i>
                </button>
            </div>

            <div className="navSection">
                <button className={`navItem ${currentTab === 'chat' ? 'active' : ''}`} onClick={() => setCurrentTab('chat')}>
                    <i className="fa-solid fa-comments"></i>
                    <span>Chat</span>
                </button>
                <button className={`navItem ${currentTab === 'knowledge' ? 'active' : ''}`} onClick={() => setCurrentTab('knowledge')}>
                    <i className="fa-solid fa-book"></i>
                    <span>Knowledge Base</span>
                </button>
                <button className={`navItem ${currentTab === 'tools' ? 'active' : ''}`} onClick={() => setCurrentTab('tools')}>
                    <i className="fa-solid fa-screwdriver-wrench"></i>
                    <span>AI Tools</span>
                </button>
                <button className={`navItem ${currentTab === 'analytics' ? 'active' : ''}`} onClick={() => setCurrentTab('analytics')}>
                    <i className="fa-solid fa-chart-line"></i>
                    <span>Analytics</span>
                </button>
                <button className={`navItem ${currentTab === 'settings' ? 'active' : ''}`} onClick={() => setCurrentTab('settings')}>
                    <i className="fa-solid fa-gear"></i>
                    <span>Settings</span>
                </button>
            </div>

            <div className="searchBox">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input 
                    type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                    <button onClick={() => setSearchQuery("")} className="clearSearch">
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                )}
            </div>

            <div className="historySection">
                <h3 className="historyTitle">
                    <i className="fa-solid fa-clock-rotate-left"></i>
                    {searchQuery ? "Search Results" : "Recent Chats"}
                </h3>
                
                {isSearching ? (
                    <div className="loadingThreads">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Searching...</span>
                    </div>
                ) : searchQuery ? (
                    searchResults.length > 0 ? (
                        <ul className="history searchHistory">
                            {searchResults.map((thread, idx) => (
                                <li 
                                    key={idx} 
                                    onClick={() => changeThread(thread.threadId)}
                                    className={thread.threadId === currThreadId ? "highlighted" : ""}
                                    title={thread.title}
                                >
                                    <div className="threadContent">
                                        <i className="fa-solid fa-message"></i>
                                        <div className="threadInfo">
                                            <div className="threadTitleRow" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                                                <span className="threadTitle">{thread.title}</span>
                                                {thread.isSemantic && (
                                                    <span className="semanticBadge" title="Semantic Match" style={{ fontSize: '0.75rem', color: '#a78bfa' }}>
                                                        <i className="fa-solid fa-brain"></i>
                                                    </span>
                                                )}
                                            </div>
                                            {thread.snippet && (
                                                <span className="threadSnippet" style={{ fontSize: '0.75rem', color: 'var(--text-muted, #9ca3af)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>
                                                    {thread.snippet}
                                                </span>
                                            )}
                                            <span className="threadDate" style={{ marginTop: '0.15rem', display: 'block' }}>{formatDate(thread.updatedAt)}</span>
                                        </div>
                                    </div>
                                    <button
                                        className="deleteBtn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteThread(thread.threadId);
                                        }}
                                        title="Delete conversation"
                                    >
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="noThreads">
                            <i className="fa-solid fa-magnifying-glass"></i>
                            <p>No matches found</p>
                        </div>
                    )
                ) : loading ? (
                    <div className="loadingThreads">
                        <i className="fa-solid fa-spinner fa-spin"></i>
                        <span>Loading...</span>
                    </div>
                ) : filteredThreads?.length > 0 ? (
                    <ul className="history">
                        {filteredThreads.map((thread, idx) => (
                            <li 
                                key={idx} 
                                onClick={() => changeThread(thread.threadId)}
                                className={thread.threadId === currThreadId ? "highlighted" : ""}
                                title={thread.title}
                            >
                                <div className="threadContent">
                                    <i className="fa-solid fa-message"></i>
                                    <div className="threadInfo">
                                        <span className="threadTitle">{thread.title}</span>
                                        <span className="threadDate">{formatDate(thread.updatedAt)}</span>
                                    </div>
                                </div>
                                <button
                                    className="deleteBtn"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        deleteThread(thread.threadId);
                                    }}
                                    title="Delete conversation"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="noThreads">
                        <i className="fa-solid fa-inbox"></i>
                        <p>No conversations yet</p>
                    </div>
                )}
            </div>
 
            <div className="sidebarFooter">
                <div className="statsCard">
                    <div className="statItem">
                        <i className="fa-solid fa-comments"></i>
                        <span>{allThreads?.length || 0} Chats</span>
                    </div>
                </div>
                <p className="brandTag">
                    Built with <i className="fa-solid fa-heart"></i> by <strong>Ritesh Chopade</strong>
                </p>
            </div>
        </section>
    )
}

export default Sidebar;