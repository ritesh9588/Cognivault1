import React, { useState, useEffect, useContext } from 'react';
import { MyContext } from '../MyContext';
import './DashboardViews.css';
import { API_BASE_URL } from '../config.js';

function Analytics() {
    const { token } = useContext(MyContext);
    
    // Sub-tab: 'usage' or 'evaluation'
    const [subTab, setSubTab] = useState('usage');
    
    // Usage Data States
    const [usageData, setUsageData] = useState(null);
    const [usageLoading, setUsageLoading] = useState(true);
    const [usageError, setUsageError] = useState('');

    // Evaluation Data States
    const [evalStats, setEvalStats] = useState(null);
    const [evalHistory, setEvalHistory] = useState([]);
    const [evalLoading, setEvalLoading] = useState(true);
    const [evalError, setEvalError] = useState('');

    // Query Runner States
    const [question, setQuestion] = useState('');
    const [groundTruth, setGroundTruth] = useState('');
    const [evaluating, setEvaluating] = useState(false);
    const [compareResult, setCompareResult] = useState(null);
    const [runnerError, setRunnerError] = useState('');

    // Expended history item ID
    const [expandedRunId, setExpandedRunId] = useState(null);

    // Fetch Usage Analytics
    const fetchUsageAnalytics = async () => {
        if (!token) return;
        setUsageLoading(true);
        setUsageError('');
        try {
            const response = await fetch(`${API_BASE_URL}/api/analytics`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const json = await response.json();
                setUsageData(json);
            } else {
                throw new Error('Failed to retrieve usage analytics payload.');
            }
        } catch (err) {
            console.error(err);
            setUsageError('Could not sync usage activity dashboards.');
        } finally {
            setUsageLoading(false);
        }
    };

    // Fetch Evaluation Stats & History
    const fetchEvalData = async () => {
        if (!token) return;
        setEvalLoading(true);
        setEvalError('');
        try {
            // Fetch stats
            const statsRes = await fetch(`${API_BASE_URL}/api/evaluation/stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            let statsJson = null;
            if (statsRes.ok) {
                statsJson = await statsRes.json();
                setEvalStats(statsJson);
            } else {
                throw new Error('Failed to retrieve evaluation stats.');
            }

            // Fetch history
            const histRes = await fetch(`${API_BASE_URL}/api/evaluation/history`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (histRes.ok) {
                const histJson = await histRes.json();
                setEvalHistory(histJson);
            } else {
                throw new Error('Failed to retrieve evaluation history.');
            }
        } catch (err) {
            console.error(err);
            setEvalError('Could not sync RAG evaluation statistics.');
        } finally {
            setEvalLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchUsageAnalytics();
            fetchEvalData();
        }
    }, [token]);

    // Handle running a comparison evaluation
    const handleRunEvaluation = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        setEvaluating(true);
        setRunnerError('');
        setCompareResult(null);

        try {
            const response = await fetch(`${API_BASE_URL}/api/evaluation/compare`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    question: question.trim(),
                    groundTruthAnswer: groundTruth.trim()
                })
            });

            if (response.ok) {
                const data = await response.json();
                setCompareResult(data);
                // Refresh statistics and history
                await fetchEvalData();
                setQuestion('');
                setGroundTruth('');
            } else {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to complete evaluation run.');
            }
        } catch (err) {
            console.error(err);
            setRunnerError(err.message || 'Error occurred during evaluation execution.');
        } finally {
            setEvaluating(false);
        }
    };

    const renderUsageTab = () => {
        if (usageLoading) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#818cf8', marginBottom: '1rem' }}></i>
                    <h3>Compiling workspace statistics...</h3>
                </div>
            );
        }

        if (usageError) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <p style={{ color: '#f87171' }}>{usageError}</p>
                    <button className="primaryBtn" onClick={fetchUsageAnalytics} style={{ marginTop: '1rem' }}>Retry Load</button>
                </div>
            );
        }

        const { summary, charts, recentActivity } = usageData || {};
        if (!summary) return null;

        // Time series data formatting
        const sortedMsgDates = Object.keys(charts.msgsOverTime || {}).sort();
        const maxMessagesInADay = sortedMsgDates.length > 0 
            ? Math.max(...Object.values(charts.msgsOverTime)) 
            : 1;

        // RAG percentage
        const totalAssistantChats = (charts.ragSplit?.rag || 0) + (charts.ragSplit?.normal || 0);
        const ragPercent = totalAssistantChats > 0 
            ? Math.round((charts.ragSplit.rag / totalAssistantChats) * 100) 
            : 0;
        const normalPercent = totalAssistantChats > 0 ? 100 - ragPercent : 0;

        const maxToolRuns = Math.max(...Object.values(charts.toolUsageBreakdown || {}), 1);

        return (
            <>
                {/* Counters Row */}
                <div className="metricsGrid">
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Total Conversations</span>
                            <i className="fa-solid fa-comments"></i>
                        </div>
                        <h2>{summary.totalConversations}</h2>
                        <span className="trend">{summary.totalMessages} total message exchanges</span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Knowledge Base Syncs</span>
                            <i className="fa-solid fa-folder-open"></i>
                        </div>
                        <h2>{summary.syncedDocs} / {summary.totalDocs}</h2>
                        <span className="trend">{summary.totalDocs - summary.syncedDocs} document uploads pending</span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>RAG Queries Run</span>
                            <i className="fa-solid fa-file-invoice"></i>
                        </div>
                        <h2>{summary.ragQuestionsCount}</h2>
                        <span className="trend">Similarity document lookups</span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Total API Calls</span>
                            <i className="fa-solid fa-bolt"></i>
                        </div>
                        <h2>{summary.totalGeminiCalls}</h2>
                        <span className="trend">Gemini execution transactions</span>
                    </div>
                </div>

                <div className="analyticsLayout">
                    {/* Time Series Activity Bar Chart */}
                    <div className="chartSection" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'auto' }}>
                        <div className="chartHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3>Messages Activity over Time</h3>
                            <span className="timeframe">Daily volume</span>
                        </div>
                        {sortedMsgDates.length > 0 ? (
                            <div className="barChartContainer" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', minHeight: '200px', paddingTop: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                {sortedMsgDates.map(dateStr => {
                                    const count = charts.msgsOverTime[dateStr];
                                    const heightPercent = Math.max(10, Math.round((count / maxMessagesInADay) * 100));
                                    return (
                                        <div key={dateStr} className="barGroup" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#a78bfa' }}>{count}</span>
                                            <div 
                                                className="bar" 
                                                style={{ 
                                                    height: `${heightPercent}px`, 
                                                    width: '24px', 
                                                    background: 'linear-gradient(to top, #818cf8, #a78bfa)', 
                                                    borderRadius: '4px 4px 0 0',
                                                    transition: 'height 0.3s ease'
                                                }}
                                            ></div>
                                            <span className="barLabel" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                                {dateStr.slice(5)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No message timestamp metrics recorded.
                            </div>
                        )}
                    </div>

                    {/* RAG vs Normal & AI Tools splits */}
                    <div className="tableSection" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: 'auto' }}>
                        <h3>Workspace Distribution</h3>
                        
                        {/* RAG vs Normal split */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: '600' }}>
                                <span>RAG vs Normal Chat</span>
                                <span>{ragPercent}% RAG</span>
                            </div>
                            <div style={{ height: '10px', background: '#374151', borderRadius: '5px', overflow: 'hidden', display: 'flex' }}>
                                <div style={{ width: `${ragPercent}%`, background: '#8b5cf6', transition: 'width 0.3s' }}></div>
                                <div style={{ width: `${normalPercent}%`, background: '#4b5563', transition: 'width 0.3s' }}></div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><i className="fa-solid fa-circle" style={{ color: '#8b5cf6', fontSize: '0.6rem' }}></i> RAG Queries ({charts.ragSplit.rag})</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}><i className="fa-solid fa-circle" style={{ color: '#4b5563', fontSize: '0.6rem' }}></i> Chat Messages ({charts.ragSplit.normal})</span>
                            </div>
                        </div>

                        {/* AI Tool Usage splits */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'rgba(0,0,0,0.15)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>AI Tools Frequencies</span>
                            {Object.entries(charts.toolUsageBreakdown || {}).map(([toolId, count]) => {
                                const percent = Math.round((count / maxToolRuns) * 100);
                                const friendlyName = {
                                    "doc-summarizer": "Document Summarizer",
                                    "text-summarizer": "Text Summarizer",
                                    "code-explainer": "Code Explainer",
                                    "info-extractor": "Structured Extractor"
                                }[toolId] || toolId;

                                return (
                                    <div key={toolId} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                            <span>{friendlyName}</span>
                                            <span>{count} runs</span>
                                        </div>
                                        <div style={{ height: '6px', background: '#374151', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${percent}%`, background: '#a78bfa', height: '100%', transition: 'width 0.3s' }}></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Recent Activity Section */}
                <div className="chartSection" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'auto', background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
                    <h3>Recent Activity Log</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {recentActivity.length > 0 ? (
                            recentActivity.map((activity, aIdx) => (
                                <div key={aIdx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: aIdx < recentActivity.length - 1 ? '1px solid var(--border-color)' : 'none', paddingBottom: '0.75rem' }}>
                                    <div style={{ 
                                        width: '32px', 
                                        height: '32px', 
                                        borderRadius: '50%', 
                                        background: 'rgba(139, 92, 246, 0.12)', 
                                        border: '1px solid rgba(139, 92, 246, 0.2)',
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'center',
                                        color: '#a78bfa'
                                    }}>
                                        <i className={`fa-solid ${activity.icon}`}></i>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{activity.desc}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(activity.time).toLocaleString()}</span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No activity events captured yet.
                            </div>
                        )}
                    </div>
                </div>
            </>
        );
    };

    const renderEvaluationTab = () => {
        if (evalLoading) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '2rem', color: '#818cf8', marginBottom: '1rem' }}></i>
                    <h3>Compiling RAG evaluation metrics...</h3>
                </div>
            );
        }

        if (evalError) {
            return (
                <div style={{ padding: '4rem', textAlign: 'center' }}>
                    <p style={{ color: '#f87171' }}>{evalError}</p>
                    <button className="primaryBtn" onClick={fetchEvalData} style={{ marginTop: '1rem' }}>Retry Load</button>
                </div>
            );
        }

        const formatPercent = (val) => {
            if (val === null || val === undefined) return "N/A";
            return `${Math.round(val * 100)}%`;
        };

        const formatMs = (val) => {
            if (val === null || val === undefined) return "N/A";
            return `${Math.round(val)} ms`;
        };

        const formatLatencySec = (val) => {
            if (val === null || val === undefined) return "N/A";
            return `${(val / 1000).toFixed(2)}s`;
        };

        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                {/* Summary Cards */}
                <div className="metricsGrid">
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Questions Evaluated</span>
                            <i className="fa-solid fa-clipboard-question" style={{ color: '#818cf8' }}></i>
                        </div>
                        <h2>{evalStats.questionsEvaluated}</h2>
                        <span className="trend">{evalStats.totalDocuments} documents active in index</span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>RAG Success Rate</span>
                            <i className="fa-solid fa-shield-check" style={{ color: '#34d399' }}></i>
                        </div>
                        <h2>{Math.round(evalStats.successRate)}%</h2>
                        <span className="trend">Grounded & relevant replies</span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Avg Latency (Total)</span>
                            <i className="fa-solid fa-gauge-high" style={{ color: '#fb7185' }}></i>
                        </div>
                        <h2>{formatLatencySec(evalStats.avgTotalLatency)}</h2>
                        <span className="trend">
                            Retrieval: {formatMs(evalStats.avgRetrievalLatency)} | Rerank: {formatMs(evalStats.avgRerankLatency)}
                        </span>
                    </div>
                    <div className="metricCard">
                        <div className="metricHeader">
                            <span>Judges Accuracy Summary</span>
                            <i className="fa-solid fa-square-poll-vertical" style={{ color: '#a78bfa' }}></i>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Relevance:</span>
                                <span style={{ fontWeight: '700', color: '#a78bfa' }}>{formatPercent(evalStats.avgRetrievalRelevance)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Faithfulness:</span>
                                <span style={{ fontWeight: '700', color: '#a78bfa' }}>{formatPercent(evalStats.avgFaithfulness)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Precision / Recall:</span>
                                <span style={{ fontWeight: '700', color: '#a78bfa' }}>
                                    {formatPercent(evalStats.avgContextPrecision)} / {formatPercent(evalStats.avgContextRecall)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Strategy Comparison Row */}
                <div className="chartSection" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', height: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0 }}>RAG Retrieval Strategy Side-by-Side Comparison</h3>
                            <p className="trend" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                                Aggregated scores calculated directly from historical test runs.
                            </p>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(139, 92, 246, 0.2)', padding: '0.25rem 0.75rem', borderRadius: '12px', color: '#a78bfa', fontWeight: '600' }}>
                            Real-time Data
                        </span>
                    </div>

                    <table className="analyticsTable" style={{ margin: '0', width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px' }}>Retrieval Pipeline Strategy</th>
                                <th>Test Runs</th>
                                <th>Retrieval Relevance</th>
                                <th>Faithfulness</th>
                                <th>End-to-End Latency</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style={{ fontWeight: '600', padding: '12px' }}>
                                    <i className="fa-solid fa-arrow-right-to-bracket" style={{ marginRight: '8px', color: '#818cf8' }}></i>
                                    Vector-only RAG
                                </td>
                                <td style={{ textAlign: 'center' }}>{evalStats.byStrategy.vector.count} runs</td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#818cf8' }}>
                                    {formatPercent(evalStats.byStrategy.vector.avgRelevance)}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#818cf8' }}>
                                    {formatPercent(evalStats.byStrategy.vector.avgFaithfulness)}
                                </td>
                                <td style={{ textAlign: 'center' }}>{formatMs(evalStats.byStrategy.vector.avgLatency)}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: '600', padding: '12px' }}>
                                    <i className="fa-solid fa-arrows-split-up-and-left" style={{ marginRight: '8px', color: '#c084fc' }}></i>
                                    Hybrid RAG (Vector + BM25 + RRF)
                                </td>
                                <td style={{ textAlign: 'center' }}>{evalStats.byStrategy.hybrid.count} runs</td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#c084fc' }}>
                                    {formatPercent(evalStats.byStrategy.hybrid.avgRelevance)}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#c084fc' }}>
                                    {formatPercent(evalStats.byStrategy.hybrid.avgFaithfulness)}
                                </td>
                                <td style={{ textAlign: 'center' }}>{formatMs(evalStats.byStrategy.hybrid.avgLatency)}</td>
                            </tr>
                            <tr>
                                <td style={{ fontWeight: '600', padding: '12px' }}>
                                    <i className="fa-solid fa-bolt" style={{ marginRight: '8px', color: '#f472b6' }}></i>
                                    Hybrid + Reranking (Cross-Encoder)
                                </td>
                                <td style={{ textAlign: 'center' }}>{evalStats.byStrategy.rerank.count} runs</td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#f472b6' }}>
                                    {formatPercent(evalStats.byStrategy.rerank.avgRelevance)}
                                </td>
                                <td style={{ textAlign: 'center', fontWeight: '700', color: '#f472b6' }}>
                                    {formatPercent(evalStats.byStrategy.rerank.avgFaithfulness)}
                                </td>
                                <td style={{ textAlign: 'center' }}>{formatMs(evalStats.byStrategy.rerank.avgLatency)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Query Runner / Tester Form */}
                <div className="chartSection" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', height: 'auto' }}>
                    <h3>RAG Pipeline Evaluator & Runner</h3>
                    <form onSubmit={handleRunEvaluation} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Test Question</label>
                            <input 
                                type="text"
                                value={question}
                                onChange={(e) => setQuestion(e.target.value)}
                                placeholder="Enter a query to run against the current indexed knowledge base..."
                                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', padding: '0.8rem 1rem', borderRadius: '8px', color: 'var(--text-main)', outline: 'none' }}
                                required
                            />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>Ground Truth Answer (Optional)</label>
                            <textarea 
                                value={groundTruth}
                                onChange={(e) => setGroundTruth(e.target.value)}
                                placeholder="Enter the reference/ground truth answer to measure Context Recall (Optional)..."
                                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', padding: '0.8rem 1rem', borderRadius: '8px', color: 'var(--text-main)', outline: 'none', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                            <button 
                                type="submit" 
                                className="primaryBtn" 
                                disabled={evaluating || !question.trim()}
                                style={{ opacity: evaluating || !question.trim() ? 0.6 : 1, cursor: evaluating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                            >
                                {evaluating ? (
                                    <>
                                        <i className="fa-solid fa-circle-notch fa-spin"></i>
                                        Evaluating Pipeline Strategies...
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-play"></i>
                                        Run Evaluation Comparison
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {runnerError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '0.8rem 1rem', borderRadius: '8px', color: '#f87171', fontSize: '0.85rem' }}>
                            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '8px' }}></i>
                            {runnerError}
                        </div>
                    )}

                    {/* Compare Result Viewer */}
                    {compareResult && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                            <h4 style={{ margin: '0', fontSize: '1.1rem', color: '#c084fc' }}>Evaluation Comparison Results</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {['vector', 'hybrid', 'rerank'].map(strat => {
                                    const run = compareResult[strat];
                                    if (!run) return null;
                                    const stratLabel = {
                                        vector: "Vector RAG (Strategy A)",
                                        hybrid: "Hybrid RAG (Strategy B)",
                                        rerank: "Hybrid + Reranking (Strategy C)"
                                    }[strat];

                                    const themeColor = {
                                        vector: "#818cf8",
                                        hybrid: "#c084fc",
                                        rerank: "#f472b6"
                                    }[strat];

                                    return (
                                        <div key={strat} style={{ background: 'rgba(0,0,0,0.2)', border: `1px solid ${themeColor}40`, borderRadius: '12px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${themeColor}20`, paddingBottom: '0.5rem' }}>
                                                <span style={{ fontWeight: '700', color: themeColor }}>{stratLabel}</span>
                                                <span style={{ fontSize: '0.75rem', background: run.metrics.success ? 'rgba(52, 211, 153, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: `1px solid ${run.metrics.success ? '#34d39930' : '#ef444430'}`, padding: '0.15rem 0.5rem', borderRadius: '8px', color: run.metrics.success ? '#34d399' : '#f87171' }}>
                                                    {run.metrics.success ? 'Pass' : 'Weak'}
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Retrieval Latency:</span>
                                                    <span>{formatMs(run.latency.retrieval)}</span>
                                                </div>
                                                {strat === 'rerank' && (
                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>Reranking Latency:</span>
                                                        <span>{formatMs(run.latency.reranking)}</span>
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>LLM Answer Latency:</span>
                                                    <span>{formatMs(run.latency.llm)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: '700' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Total Latency:</span>
                                                    <span style={{ color: themeColor }}>{formatMs(run.latency.total)}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', background: 'rgba(0,0,0,0.15)', padding: '0.6rem', borderRadius: '8px' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 70px', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Relevance</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: themeColor }}>{formatPercent(run.metrics.retrievalRelevance)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 70px', alignItems: 'center', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Faithful</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: themeColor }}>{formatPercent(run.metrics.faithfulness)}</span>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 70px', alignItems: 'center' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>Recall</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: '700', color: themeColor }}>{formatPercent(run.metrics.contextRecall)}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                                                <span style={{ fontWeight: '600' }}>Answer:</span>
                                                <p style={{ margin: '0', background: 'rgba(0,0,0,0.1)', padding: '0.5rem', borderRadius: '6px', fontSize: '0.75rem', minHeight: '50px', maxHeight: '100px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
                                                    {run.generatedAnswer}
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
                                                <span style={{ fontWeight: '600' }}>Retrieved Documents:</span>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {run.retrievedContext.map((c, cIdx) => (
                                                        <div key={cIdx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span>• {c.sourceName} {c.pageNumber ? `(p. ${c.pageNumber})` : ""}</span>
                                                            <span style={{ fontStyle: 'italic' }}>({c.similarity.toFixed(3)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* History Table */}
                <div className="chartSection" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1.5rem', background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', height: 'auto' }}>
                    <h3>RAG Evaluation Query History Log</h3>
                    
                    {evalHistory.length === 0 ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No evaluation test history found. Perform evaluations above.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {evalHistory.map((run) => {
                                const isExpanded = expandedRunId === run._id;
                                const dateStr = new Date(run.timestamp).toLocaleString();
                                const themeColor = {
                                    vector: "#818cf8",
                                    hybrid: "#c084fc",
                                    rerank: "#f472b6"
                                }[run.strategy] || "#a78bfa";

                                return (
                                    <div key={run._id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                        {/* Summary Row */}
                                        <div 
                                            onClick={() => setExpandedRunId(isExpanded ? null : run._id)}
                                            style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', padding: '1rem', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', hover: { background: 'rgba(255,255,255,0.05)' } }}
                                        >
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flex: 1, minWidth: '200px' }}>
                                                <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-main)' }}>Q: "{run.question}"</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{dateStr}</span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '0.75rem', textTransform: 'capitalize', padding: '0.2rem 0.5rem', borderRadius: '8px', color: themeColor, background: `${themeColor}20`, border: `1px solid ${themeColor}40`, fontWeight: '600' }}>
                                                    {run.strategy} RAG
                                                </span>

                                                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem' }}>
                                                    <div>
                                                        <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Relevance:</span>
                                                        <span style={{ fontWeight: '700' }}>{formatPercent(run.metrics.retrievalRelevance)}</span>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Faithfulness:</span>
                                                        <span style={{ fontWeight: '700' }}>{formatPercent(run.metrics.faithfulness)}</span>
                                                    </div>
                                                    {run.metrics.contextRecall !== null && (
                                                        <div>
                                                            <span style={{ color: 'var(--text-muted)', marginRight: '4px' }}>Recall:</span>
                                                            <span style={{ fontWeight: '700' }}>{formatPercent(run.metrics.contextRecall)}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                    <i className="fa-solid fa-clock" style={{ marginRight: '4px' }}></i>
                                                    {formatMs(run.latency.total)}
                                                </span>

                                                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ color: 'var(--text-muted)' }}></i>
                                            </div>
                                        </div>

                                        {/* Expanded Details Panel */}
                                        {isExpanded && (
                                            <div style={{ padding: '1rem', borderTop: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                                {run.groundTruthAnswer && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                                                        <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Ground Truth Answer:</span>
                                                        <p style={{ margin: '0', background: 'rgba(0,0,0,0.15)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                            {run.groundTruthAnswer}
                                                        </p>
                                                    </div>
                                                )}

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Generated RAG Answer:</span>
                                                    <p style={{ margin: '0', background: 'rgba(0,0,0,0.15)', padding: '0.6rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                        {run.generatedAnswer}
                                                    </p>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                                                    <span style={{ fontWeight: '700', color: 'var(--text-muted)' }}>Retrieved Context Chunks:</span>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                        {run.retrievedContext.map((c, idx) => (
                                                            <div key={idx} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.15)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600', color: '#a78bfa', marginBottom: '0.25rem' }}>
                                                                    <span>Chunk {idx + 1}: {c.sourceName} {c.pageNumber ? `(Page ${c.pageNumber})` : ""}</span>
                                                                    <span>Score: {c.similarity.toFixed(4)}</span>
                                                                </div>
                                                                <p style={{ margin: '0', fontSize: '0.8rem', color: 'var(--text-main)', fontStyle: 'italic' }}>
                                                                    "{c.text}"
                                                                </p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="dashboardView">
            {/* Tab Header */}
            <div className="viewHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                    <h1>System Analytics & RAG Evaluation</h1>
                    <p className="subtitle">Track workspace transaction counts and measure retrieval relevance or generated answer quality.</p>
                </div>
                
                {/* Tab Switcher */}
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '0.25rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
                    <button 
                        onClick={() => setSubTab('usage')}
                        style={{ 
                            padding: '0.5rem 1.25rem', 
                            borderRadius: '8px', 
                            border: 'none', 
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                            color: subTab === 'usage' ? 'var(--text-main)' : 'var(--text-muted)',
                            background: subTab === 'usage' ? 'var(--border-color)' : 'transparent'
                        }}
                    >
                        <i className="fa-solid fa-chart-line" style={{ marginRight: '6px' }}></i>
                        Usage Overview
                    </button>
                    <button 
                        onClick={() => setSubTab('evaluation')}
                        style={{ 
                            padding: '0.5rem 1.25rem', 
                            borderRadius: '8px', 
                            border: 'none', 
                            outline: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            transition: 'all 0.2s',
                            color: subTab === 'evaluation' ? 'var(--text-main)' : 'var(--text-muted)',
                            background: subTab === 'evaluation' ? 'var(--border-color)' : 'transparent'
                        }}
                    >
                        <i className="fa-solid fa-vial-virus" style={{ marginRight: '6px' }}></i>
                        RAG Evaluation
                    </button>
                </div>
            </div>

            {subTab === 'usage' ? renderUsageTab() : renderEvaluationTab()}
        </div>
    );
}

export default Analytics;
