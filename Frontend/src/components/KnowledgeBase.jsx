import React, { useState, useEffect, useContext } from 'react';
import { MyContext } from '../MyContext';
import './DashboardViews.css';
import { API_BASE_URL } from '../config.js';

function KnowledgeBase() {
    const { token } = useContext(MyContext);
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const fetchDocuments = async () => {
        if (!token) return;
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/documents`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to fetch documents.');
            const data = await response.json();
            setDocuments(data);
        } catch (err) {
            console.error(err);
            setError('Could not load documents.');
        } finally {
            setLoading(false);
        }
    };

    // Poll document list if there are any documents in "processing" state
    useEffect(() => {
        fetchDocuments();
    }, [token]);

    useEffect(() => {
        const hasProcessing = documents.some(doc => doc.status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/documents`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setDocuments(data);
                }
            } catch (err) {
                console.error(err);
            }
        }, 3000);

        return () => clearInterval(interval);
    }, [documents, token]);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/api/documents/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Upload failed.');

            setSuccess(`Document "${file.name}" is now processing...`);
            fetchDocuments();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
            e.target.value = ''; // clear input
        }
    };

    const handleDelete = async (docId, docName) => {
        const confirmDelete = window.confirm(`Are you sure you want to delete "${docName}"? This will delete all its vector embeddings.`);
        if (!confirmDelete) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Failed to delete document.');
            setSuccess('Document deleted.');
            setDocuments(prev => prev.filter(doc => doc._id !== docId));
        } catch (err) {
            setError(err.message);
        }
    };

    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    return (
        <div className="dashboardView">
            <div className="viewHeader">
                <div>
                    <h1>Knowledge Base</h1>
                    <p className="subtitle">Sync your PDF and DOCX documents to generate vector embeddings for RAG search context.</p>
                </div>
                <div className="uploadBtnWrapper">
                    <label className="primaryBtn uploadLabel">
                        {uploading ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin"></i>
                                <span>Uploading...</span>
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-arrow-up-from-bracket"></i>
                                <span>Upload Document</span>
                            </>
                        )}
                        <input 
                            type="file" 
                            accept=".pdf,.docx" 
                            onChange={handleFileUpload} 
                            disabled={uploading} 
                            style={{ display: 'none' }}
                        />
                    </label>
                </div>
            </div>

            {error && (
                <div className="authError" style={{ margin: '0' }}>
                    <i className="fa-solid fa-circle-exclamation"></i>
                    <span>{error}</span>
                </div>
            )}

            {success && (
                <div className="errorMessage" style={{ margin: '0', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)', color: '#22c55e' }}>
                    <i className="fa-solid fa-circle-check"></i>
                    <span>{success}</span>
                    <button onClick={() => setSuccess('')} style={{ color: '#22c55e' }}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}

            <div className="metricsGrid">
                <div className="metricCard">
                    <div className="metricHeader">
                        <span>Total Documents</span>
                        <i className="fa-solid fa-file-invoice"></i>
                    </div>
                    <h2>{documents.length}</h2>
                    <span className="trend">Successfully stored sources</span>
                </div>
                <div className="metricCard">
                    <div className="metricHeader">
                        <span>Synced Docs</span>
                        <i className="fa-solid fa-circle-check"></i>
                    </div>
                    <h2>{documents.filter(d => d.status === 'synced').length}</h2>
                    <span className="trend positive">Ready for AI context search</span>
                </div>
                <div className="metricCard">
                    <div className="metricHeader">
                        <span>Processing / Failed</span>
                        <i className="fa-solid fa-clock-rotate-left"></i>
                    </div>
                    <h2>{documents.filter(d => d.status !== 'synced').length}</h2>
                    <span className="trend">Pending sync jobs</span>
                </div>
            </div>

            <div className="sectionContent">
                <div className="sectionTitle">
                    <h2>Connected Data Sources</h2>
                </div>

                <div className="tableSection" style={{ padding: '0', overflowX: 'auto' }}>
                    {loading && documents.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.5rem' }}></i>
                            Loading your Knowledge Base...
                        </div>
                    ) : documents.length > 0 ? (
                        <table className="analyticsTable" style={{ margin: '0' }}>
                            <thead>
                                <tr>
                                    <th style={{ paddingLeft: '1.5rem' }}>Document Name</th>
                                    <th>Type</th>
                                    <th>Size</th>
                                    <th>Upload Date</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {documents.map((doc) => (
                                    <tr key={doc._id}>
                                        <td style={{ paddingLeft: '1.5rem', fontWeight: '500' }}>
                                            <i className={`fa-solid ${doc.type === 'PDF' ? 'fa-file-pdf' : 'fa-file-word'}`} style={{ color: doc.type === 'PDF' ? '#ef4444' : '#3b82f6', marginRight: '0.5rem' }}></i>
                                            {doc.name}
                                        </td>
                                        <td>{doc.type}</td>
                                        <td>{formatBytes(doc.fileSize)}</td>
                                        <td>{formatDate(doc.uploadDate)}</td>
                                        <td>
                                            <span className={`statusTag ${
                                                doc.status === 'synced' ? 'active' : 
                                                doc.status === 'processing' ? 'processing' : 'failed'
                                            }`} style={{ 
                                                background: doc.status === 'synced' ? 'rgba(34, 197, 94, 0.15)' : 
                                                            doc.status === 'processing' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                color: doc.status === 'synced' ? '#34d399' : 
                                                       doc.status === 'processing' ? '#fbbf24' : '#f87171'
                                            }}>
                                                {doc.status === 'processing' && <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '0.25rem', color: '#fbbf24' }}></i>}
                                                {doc.status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                            <button 
                                                onClick={() => handleDelete(doc._id, doc.name)} 
                                                style={{ color: '#ef4444', opacity: '0.8', transition: 'opacity 0.2s' }}
                                                title="Delete document and embeddings"
                                            >
                                                <i className="fa-solid fa-trash" style={{ color: '#ef4444' }}></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
                            <i className="fa-solid fa-box-open" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'block' }}></i>
                            <p style={{ color: 'var(--text-muted)' }}>No documents synced yet. Upload your first PDF or DOCX file to build a custom Knowledge Base!</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default KnowledgeBase;
