import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import DocumentSidebar from './components/DocumentSidebar';
import ChatInterface from './components/ChatInterface';
import { api } from './api/client';

export default function App() {
  const [health, setHealth] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [messages, setMessages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);

  // Initial load: health status and document list
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [healthData, docsData] = await Promise.all([
          api.getHealth().catch(() => ({ status: 'connecting', database_type: 'Offline' })),
          api.getDocuments().catch(() => ({ documents: [] })),
        ]);
        setHealth(healthData);
        setDocuments(docsData.documents || []);
      } catch (err) {
        console.error('Failed to initialize application state:', err);
      }
    };
    fetchData();

    // Periodic health check every 15 seconds
    const interval = setInterval(async () => {
      try {
        const h = await api.getHealth();
        setHealth(h);
      } catch {
        setHealth({ status: 'error', database_type: 'Unreachable' });
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const res = await api.uploadPdf(file);
      // Refresh documents list
      const docsData = await api.getDocuments();
      setDocuments(docsData.documents || []);
      // Refresh health stats
      const h = await api.getHealth();
      setHealth(h);

      // Add a system notification in the chat
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Indexed **${res.filename}** (${res.total_pages} pages, ${res.total_chunks} chunks). You can now ask questions about it!`,
          route: 'DIRECT',
          sources: [],
        },
      ]);
      return res;
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (filename) => {
    try {
      await api.deleteDocument(filename);
      setDocuments((prev) => prev.filter((d) => d.filename !== filename));
      const h = await api.getHealth();
      setHealth(h);
    } catch (err) {
      alert(`Failed to delete document: ${err.message}`);
    }
  };

  const handleSendMessage = async (text) => {
    const userMsg = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const response = await api.sendMessage(text);
      const assistantMsg = {
        role: 'assistant',
        content: response.answer,
        route: response.route,
        sources: response.sources || [],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message || 'Unable to process your request.'}`,
          route: 'DIRECT',
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setSelectedSource(null);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      <Header
        health={health}
        onClearChat={handleClearChat}
      />

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <DocumentSidebar
          documents={documents}
          onUpload={handleUpload}
          onDelete={handleDelete}
          uploading={uploading}
        />

        <ChatInterface
          messages={messages}
          onSendMessage={handleSendMessage}
          loading={loading}
          hasDocuments={documents.length > 0}
          selectedSource={selectedSource}
          onCloseSource={() => setSelectedSource(null)}
          onSelectSource={(source) => setSelectedSource(source)}
        />
      </main>

    </div>
  );
}
