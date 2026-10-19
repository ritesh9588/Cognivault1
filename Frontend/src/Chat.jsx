import "./Chat.css";
import React, { useContext, useState, useEffect, useRef } from "react";
import { MyContext } from "./MyContext";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css";
import remarkGfm from 'remark-gfm';

function Chat() {
    const { newChat, prevChats, reply } = useContext(MyContext);
    const [latestReply, setLatestReply] = useState(null);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [prevChats, latestReply]);

    useEffect(() => {
        if (reply === null) {
            setLatestReply(null);
            return;
        }

        if (!prevChats?.length) return;

        const content = reply.split(" ");
        let idx = 0;
        
        const interval = setInterval(() => {
            setLatestReply(content.slice(0, idx + 1).join(" "));
            idx++;
            if (idx >= content.length) clearInterval(interval);
        }, 40);

        return () => clearInterval(interval);
    }, [prevChats, reply]);

    const copyToClipboard = (text, index) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        });
    };

    const getCurrentTime = () => {
        return new Date().toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    };

    const getWordCount = (text) => {
        return text.trim().split(/\s+/).length;
    };

    return (
        <div className="chatContainer">
            {newChat ? (
                <div className="welcomeScreen">
                    <div className="welcomeContent">
                        <h1>Welcome to Cognivault</h1>
                        <p className="welcomeSubtitle">RAG-Powered AI Knowledge & Productivity Platform</p>
                        <div className="platformIndicator">
                            <span>Powered by Gemini • RAG Enabled</span>
                        </div>
                        
                        <div className="suggestionCards">
                            <div className="suggestionCard">
                                <i className="fa-solid fa-code"></i>
                                <h3>Code Assistant</h3>
                                <p>Get help with programming and debugging</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-lightbulb"></i>
                                <h3>Creative Ideas</h3>
                                <p>Brainstorm and generate creative content</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-book"></i>
                                <h3>Learn Anything</h3>
                                <p>Ask questions and expand your knowledge</p>
                            </div>
                            <div className="suggestionCard">
                                <i className="fa-solid fa-pen"></i>
                                <h3>Write Better</h3>
                                <p>Improve your writing and communication</p>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="chats">
                    {prevChats?.slice(0, -1).map((chat, idx) => (
                        <div 
                            className={`messageWrapper ${chat.role === "user" ? "userWrapper" : "assistantWrapper"}`} 
                            key={idx}
                        >
                            <div className={chat.role === "user" ? "userDiv" : "gptDiv"}>
                                <div className="messageHeader">
                                    <span className="roleName">
                                        {chat.role === "user" ? "You" : "Cognivault"}
                                    </span>
                                    <span className="timestamp">{getCurrentTime()}</span>
                                </div>
                                
                                <div className="messageContent">
                                    {chat.role === "user" ? (
                                        <p className="userMessage">{chat.content}</p>
                                    ) : (
                                        <>
                                            <ReactMarkdown 
                                                remarkPlugins={[remarkGfm]}
                                                rehypePlugins={[rehypeHighlight]}
                                            >
                                                {chat.content}
                                            </ReactMarkdown>
                                            {chat.isRag && chat.sources && chat.sources.length > 0 && (
                                                <div className="ragSources">
                                                    <div className="ragHeader">Sources</div>
                                                    <div className="sourcesList">
                                                        {chat.sources.map((src, sIdx) => (
                                                            <span key={sIdx} className="sourceTag">
                                                                📄 {src}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="messageActions">
                                                <button 
                                                    className="actionBtn"
                                                    onClick={() => copyToClipboard(chat.content, idx)}
                                                    title="Copy to clipboard"
                                                >
                                                    <i className={`fa-solid fa-${copiedIndex === idx ? 'check' : 'copy'}`}></i>
                                                    {copiedIndex === idx && <span>Copied!</span>}
                                                </button>
                                                <span className="wordCount">
                                                    {getWordCount(chat.content)} words
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {prevChats.length > 0 && (
                        <div className="messageWrapper assistantWrapper">
                            <div className="gptDiv" key={latestReply === null ? "non-typing" : "typing"}>
                                <div className="messageHeader">
                                    <span className="roleName">Cognivault</span>
                                    <span className="timestamp">{getCurrentTime()}</span>
                                    {latestReply && latestReply !== reply && (
                                        <span className="typingIndicator">
                                            <i className="fa-solid fa-ellipsis"></i>
                                        </span>
                                    )}
                                </div>
                                
                                <div className="messageContent">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeHighlight]}
                                    >
                                        {latestReply === null 
                                            ? prevChats[prevChats.length - 1].content 
                                            : latestReply
                                        }
                                    </ReactMarkdown>
                                    
                                    {latestReply === reply && prevChats[prevChats.length - 1].isRag && prevChats[prevChats.length - 1].sources && prevChats[prevChats.length - 1].sources.length > 0 && (
                                        <div className="ragSources">
                                            <div className="ragHeader">Sources</div>
                                            <div className="sourcesList">
                                                {prevChats[prevChats.length - 1].sources.map((src, sIdx) => (
                                                    <span key={sIdx} className="sourceTag">
                                                        📄 {src}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    {latestReply === reply && (
                                        <div className="messageActions">
                                            <button 
                                                className="actionBtn"
                                                onClick={() => copyToClipboard(
                                                    prevChats[prevChats.length - 1].content, 
                                                    'latest'
                                                )}
                                                title="Copy to clipboard"
                                            >
                                                <i className={`fa-solid fa-${copiedIndex === 'latest' ? 'check' : 'copy'}`}></i>
                                                {copiedIndex === 'latest' && <span>Copied!</span>}
                                            </button>
                                            <span className="wordCount">
                                                {getWordCount(prevChats[prevChats.length - 1].content)} words
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div ref={chatEndRef} />
                </div>
            )}
        </div>
    );
}

export default Chat;