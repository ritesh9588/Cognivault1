import React, { useState, useEffect, useContext } from 'react';
import { MyContext } from '../MyContext';
import ReactMarkdown from 'react-markdown';
import './DashboardViews.css';
import { API_BASE_URL } from '../config.js';

function AITools() {
    const { token } = useContext(MyContext);
    const [activeTool, setActiveTool] = useState(null); // 'doc-summarizer' | 'text-summarizer' | 'code-explainer' | 'info-extractor'
    const [documents, setDocuments] = useState([]);
    const [selectedDocId, setSelectedDocId] = useState('');
    const [inputText, setInputText] = useState('');
    const [schemaDescription, setSchemaDescription] = useState('');
    const [codeLanguage, setCodeLanguage] = useState('javascript');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [copySuccess, setCopySuccess] = useState(false);

    const fetchDocuments = async () => {
        if (!token) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setDocuments(data.filter(d => d.status === 'synced'));
            }
        } catch (err) {
            console.error("Failed to load documents:", err);
        }
    };

    useEffect(() => {
        if (activeTool === 'doc-summarizer') {
            fetchDocuments();
        }
        // Reset states on tool switch
        setResult(null);
        setError('');
        setInputText('');
        setSchemaDescription('');
        setSelectedDocId('');
        setCopySuccess(false);
    }, [activeTool]);

    const handleRunTool = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResult(null);
        setCopySuccess(false);

        let endpoint = '';
        let payload = {};

        if (activeTool === 'doc-summarizer') {
            if (!selectedDocId) {
                setLoading(false);
                return setError('Please select a document.');
            }
            endpoint = 'summarize-doc';
            payload = { documentId: selectedDocId };
        } else if (activeTool === 'text-summarizer') {
            if (!inputText.trim()) {
                setLoading(false);
                return setError('Please paste some text.');
            }
            endpoint = 'summarize-text';
            payload = { text: inputText };
        } else if (activeTool === 'code-explainer') {
            if (!inputText.trim()) {
                setLoading(false);
                return setError('Please paste your code.');
            }
            endpoint = 'code-explainer';
            payload = { code: inputText, language: codeLanguage };
        } else if (activeTool === 'info-extractor') {
            if (!inputText.trim() || !schemaDescription.trim()) {
                setLoading(false);
                return setError('Please fill in both fields.');
            }
            endpoint = 'extract-info';
            payload = { text: inputText, schemaDescription };
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/tools/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to execute tool.');
            setResult(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = () => {
        if (!result) return;
        let textToCopy = '';
        if (activeTool === 'doc-summarizer' || activeTool === 'text-summarizer') {
            textToCopy = result.summary;
        } else if (activeTool === 'code-explainer') {
            textToCopy = `EXPLANATION:\n${result.explanation}\n\nISSUES:\n${(result.issues || []).join('\n')}\n\nSUGGESTIONS:\n${(result.improvements || []).join('\n')}`;
        } else if (activeTool === 'info-extractor') {
            textToCopy = JSON.stringify(result.extractedData, null, 2);
        }
        
        navigator.clipboard.writeText(textToCopy);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleDownload = () => {
        if (!result) return;
        let textContent = '';
        let filename = `${activeTool}-analysis.md`;
        
        if (activeTool === 'doc-summarizer' || activeTool === 'text-summarizer') {
            textContent = `# Summary\n\n${result.summary}`;
        } else if (activeTool === 'code-explainer') {
            textContent = `# Code Analysis\n\n## Explanation\n${result.explanation}\n\n## Potential Issues\n${(result.issues || []).map(i => `- ${i}`).join('\n')}\n\n## Suggestions\n${(result.improvements || []).map(i => `- ${i}`).join('\n')}`;
        } else if (activeTool === 'info-extractor') {
            textContent = JSON.stringify(result.extractedData, null, 2);
            filename = 'extracted-data.json';
        }
        
        const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    };

    if (activeTool) {
        return (
            <div className="dashboardView">
                <div className="viewHeader" style={{ borderBottom: 'none', paddingBottom: '0.5rem' }}>
                    <div>
                        <button className="secondaryBtn" onClick={() => setActiveTool(null)} style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <i className="fa-solid fa-arrow-left"></i> Back to Tools
                        </button>
                        <h1 style={{ margin: 0 }}>
                            {activeTool === 'doc-summarizer' && 'Document Summarizer'}
                            {activeTool === 'text-summarizer' && 'Text Summarizer'}
                            {activeTool === 'code-explainer' && 'Code Explainer'}
                            {activeTool === 'info-extractor' && 'Structured Extractor'}
                        </h1>
                        <p className="subtitle" style={{ marginTop: '0.25rem' }}>
                            {activeTool === 'doc-summarizer' && 'Extract a structured summary of any document in your Knowledge Base.'}
                            {activeTool === 'text-summarizer' && 'Summarize pasted articles, transcripts, or notes instantly.'}
                            {activeTool === 'code-explainer' && 'Analyze code structure, find security vulnerabilities, and get optimization suggestions.'}
                            {activeTool === 'info-extractor' && 'Extract structured JSON entities like tables, lists, emails, or names from unstructured text.'}
                        </p>
                    </div>
                </div>

                <div className="twoColumnLayout">
                    {/* Left Column: Tool Input */}
                    <div className="inputPanel">
                        <div className="panelHeader">
                            <h3><i className="fa-solid fa-sliders"></i> Tool Input</h3>
                        </div>
                        <div className="panelBody">
                            <form onSubmit={handleRunTool} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {activeTool === 'doc-summarizer' && (
                                    <div className="formGroup">
                                        <label>Select Knowledge Base Document</label>
                                        <select 
                                            className="selectBox" 
                                            value={selectedDocId} 
                                            onChange={(e) => setSelectedDocId(e.target.value)}
                                            required
                                        >
                                            <option value="">-- Choose Document --</option>
                                            {documents.map(doc => (
                                                <option key={doc._id} value={doc._id}>{doc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {activeTool === 'code-explainer' && (
                                    <div className="formGroup">
                                        <label>Programming Language</label>
                                        <select 
                                            className="selectBox" 
                                            value={codeLanguage} 
                                            onChange={(e) => setCodeLanguage(e.target.value)}
                                        >
                                            <option value="javascript">JavaScript / TypeScript</option>
                                            <option value="python">Python</option>
                                            <option value="java">Java</option>
                                            <option value="cpp">C++ / C</option>
                                            <option value="go">Go</option>
                                            <option value="rust">Rust</option>
                                            <option value="html-css">HTML & CSS</option>
                                        </select>
                                    </div>
                                )}

                                {activeTool !== 'doc-summarizer' && (
                                    <div className="formGroup">
                                        <label>
                                            {activeTool === 'code-explainer' ? 'Paste Code' : 'Paste Text'}
                                        </label>
                                        <textarea
                                            className="selectBox textInputArea"
                                            placeholder={activeTool === 'code-explainer' ? 'function calculateAverage(arr) {\n  return arr.reduce((a, b) => a + b, 0) / arr.length;\n}' : 'Paste raw text contents here...'}
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                            rows="10"
                                            style={{ fontFamily: activeTool === 'code-explainer' ? 'monospace' : 'inherit' }}
                                            required
                                        />
                                    </div>
                                )}

                                {activeTool === 'info-extractor' && (
                                    <div className="formGroup">
                                        <label>Extraction Schema / Instructions</label>
                                        <input
                                            type="text"
                                            className="selectBox"
                                            placeholder="e.g. Extract name, email, and phone number of each contact"
                                            value={schemaDescription}
                                            onChange={(e) => setSchemaDescription(e.target.value)}
                                            required
                                        />
                                    </div>
                                )}

                                {error && (
                                    <div className="authError" style={{ margin: '0' }}>
                                        <i className="fa-solid fa-circle-exclamation"></i>
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button type="submit" className="primaryBtn" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
                                    {loading ? (
                                        <>
                                            <i className="fa-solid fa-spinner fa-spin"></i>
                                            <span>Running Tool...</span>
                                        </>
                                    ) : (
                                        <>
                                            <i className="fa-solid fa-bolt"></i>
                                            <span>Run Analysis</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Right Column: Tool Output */}
                    <div className="outputPanel">
                        <div className="panelHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3><i className="fa-solid fa-square-poll-horizontal"></i> Tool Output</h3>
                            {result && (
                                <div className="outputActions" style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="secondaryBtn actionBtn" onClick={handleCopy} title="Copy to clipboard">
                                        <i className={`fa-solid ${copySuccess ? 'fa-check' : 'fa-copy'}`}></i>
                                        <span>{copySuccess ? 'Copied!' : 'Copy'}</span>
                                    </button>
                                    <button className="secondaryBtn actionBtn" onClick={handleDownload} title="Download analysis">
                                        <i className="fa-solid fa-download"></i>
                                        <span>Export</span>
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="panelBody scrollableOutput">
                            {loading ? (
                                <div className="toolStateContainer">
                                    <i className="fa-solid fa-circle-notch fa-spin spinnerIcon"></i>
                                    <strong>Generating structured analysis...</strong>
                                    <p>Gemini is compiling your response. This may take several seconds.</p>
                                </div>
                            ) : result ? (
                                <div className="toolResultWrapper">
                                    
                                    {/* Markdown Output */}
                                    {(activeTool === 'doc-summarizer' || activeTool === 'text-summarizer') && (
                                        <div className="resultDocCard">
                                            <div className="docCardSectionHeader">
                                                <i className="fa-solid fa-rectangle-list"></i> Executive Summary
                                            </div>
                                            <div className="markdownOutput">
                                                <ReactMarkdown>{result.summary}</ReactMarkdown>
                                            </div>
                                        </div>
                                    )}

                                    {/* Code Explainer Output */}
                                    {activeTool === 'code-explainer' && (
                                        <div className="codeExplainerResults">
                                            <div className="resultDocCard explanationCard">
                                                <div className="docCardSectionHeader">
                                                    <i className="fa-solid fa-circle-info"></i> Explanation
                                                </div>
                                                <div className="markdownOutput">
                                                    <ReactMarkdown>{result.explanation}</ReactMarkdown>
                                                </div>
                                            </div>

                                            {result.issues && result.issues.length > 0 && (
                                                <div className="resultDocCard issuesCard">
                                                    <div className="docCardSectionHeader" style={{ color: '#f87171' }}>
                                                        <i className="fa-solid fa-triangle-exclamation"></i> Potential Issues
                                                    </div>
                                                    <ul className="resultsList">
                                                        {result.issues.map((iss, iIdx) => (
                                                            <li key={iIdx}>{iss}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            {result.improvements && result.improvements.length > 0 && (
                                                <div className="resultDocCard improvementsCard">
                                                    <div className="docCardSectionHeader" style={{ color: '#34d399' }}>
                                                        <i className="fa-solid fa-circle-check"></i> Suggestions & Improvements
                                                    </div>
                                                    <ul className="resultsList">
                                                        {result.improvements.map((imp, iIdx) => (
                                                            <li key={iIdx}>{imp}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Structured Data Output */}
                                    {activeTool === 'info-extractor' && (
                                        <div className="resultDocCard jsonCard">
                                            <div className="docCardSectionHeader">
                                                <i className="fa-solid fa-database"></i> Extracted Schema JSON
                                            </div>
                                            <pre className="jsonOutputBlock">
                                                {JSON.stringify(result.extractedData, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="toolStateContainer">
                                    <i className="fa-solid fa-keyboard emptyIcon"></i>
                                    <p>Input your parameters on the left and click <strong>Run Analysis</strong> to see results here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const tools = [
        {
            id: "doc-summarizer",
            title: "Document Summarizer",
            desc: "Extract a structured summarization of documents saved to your Knowledge Base.",
            icon: "fa-compress",
            badge: "Knowledge Base"
        },
        {
            id: "text-summarizer",
            title: "Text Summarizer",
            desc: "Condense long articles, messages, transcripts, or notes instantly.",
            icon: "fa-align-left",
            badge: "Text"
        },
        {
            id: "code-explainer",
            title: "Code Explainer",
            desc: "Deconstruct complex code blocks, identify optimization issues, and review security.",
            icon: "fa-terminal",
            badge: "Developer"
        },
        {
            id: "info-extractor",
            title: "Structured Extractor",
            desc: "Convert text descriptions or documents into structured format values (JSON).",
            icon: "fa-database",
            badge: "Data Structuring"
        }
    ];

    return (
        <div className="dashboardView">
            <div className="viewHeader">
                <div>
                    <h1>AI Tools & Workflows</h1>
                    <p className="subtitle">Execute specialized structuring and summarization tasks using Gemini's logic engine.</p>
                </div>
            </div>

            <div className="sectionContent">
                <div className="cardsGrid">
                    {tools.map((tool, idx) => (
                        <div key={idx} className="toolCard">
                            <div className="toolCardHeader">
                                <div className="toolIcon">
                                    <i className={`fa-solid ${tool.icon}`}></i>
                                </div>
                                <span className="categoryBadge">{tool.badge}</span>
                            </div>
                            <h3>{tool.title}</h3>
                            <p>{tool.desc}</p>
                            <button className="secondaryBtn" onClick={() => setActiveTool(tool.id)} style={{ alignSelf: 'flex-start', marginTop: 'auto' }}>
                                Launch Tool <i className="fa-solid fa-arrow-right"></i>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default AITools;
