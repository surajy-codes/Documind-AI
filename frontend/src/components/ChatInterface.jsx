import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, BookOpen, AlertCircle, X, ExternalLink } from 'lucide-react';
import MessageBubble from './MessageBubble';

export default function ChatInterface({
  messages,
  onSendMessage,
  loading,
  hasDocuments,
  selectedSource,
  onCloseSource,
  onSelectSource
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const msg = input.trim();
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    onSendMessage(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTextareaChange = (e) => {
    setInput(e.target.value);
    // Auto-adjust height
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const suggestions = hasDocuments
    ? [
        "What are the main topics discussed in the uploaded document?",
        "Summarize the key takeaways and conclusions.",
        "Are there any specific protocols, requirements, or numbers mentioned?",
      ]
    : [
        "What is Retrieval-Augmented Generation (RAG)?",
        "How does the LangGraph router decide between RAG and Direct LLM?",
        "Upload a PDF on the left to start asking document-specific questions!",
      ];

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-61px)] bg-slate-950/70 relative overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-xl mx-auto py-12">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 mb-5">
              <Sparkles className="h-7 w-7" />
            </div>

            <h2 className="font-heading text-2xl font-bold text-white tracking-tight">
              Ask anything about your documents
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Upload PDF files to start semantic retrieval with pgvector, or ask general questions directly handled by Gemini.
            </p>

            {/* Quick Suggestions */}
            <div className="mt-8 w-full space-y-2">
              <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold text-left mb-3">
                Suggested questions:
              </p>
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setInput(s);
                    textareaRef.current?.focus();
                  }}
                  className="w-full text-left p-3 rounded-xl bg-slate-900/80 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/40 text-xs text-slate-300 hover:text-white transition-all shadow-sm flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{s}</span>
                  <span className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 shrink-0">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <MessageBubble
                key={index}
                message={msg}
                onSelectSource={onSelectSource}
              />
            ))}

            {loading && (
              <div className="flex items-start gap-3 mb-6">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  <span className="text-xs text-slate-300 font-medium">
                    LangGraph is routing and reasoning...
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Source Detail Drawer / Modal */}
      {selectedSource && (
        <div className="absolute inset-y-0 right-0 w-full sm:w-96 bg-slate-900/95 backdrop-blur-lg border-l border-slate-700/80 shadow-2xl p-5 flex flex-col z-30 animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <h3 className="font-heading text-sm font-semibold text-white">Source Citation</h3>
            </div>
            <button
              onClick={onCloseSource}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3 flex-1 overflow-y-auto">
            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-500">Document</p>
              <p className="text-xs font-medium text-slate-200 mt-0.5 break-all">
                {selectedSource.document}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-800">
                <p className="text-[10px] uppercase font-semibold text-slate-500">Page Number</p>
                <p className="text-xs font-semibold text-indigo-300 mt-0.5">
                  Page {selectedSource.page}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-800">
                <p className="text-[10px] uppercase font-semibold text-slate-500">Chunk Index</p>
                <p className="text-xs font-mono text-slate-300 mt-0.5">
                  #{selectedSource.chunk_index}
                </p>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1.5">
                Exact Retrieved Text
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
                {selectedSource.snippet}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Input Container */}
      <div className="p-4 md:px-8 border-t border-slate-800/80 bg-slate-900/40">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto flex items-end gap-2">
          <div className="relative flex-1 rounded-2xl bg-slate-900/90 border border-slate-700/80 focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={
                hasDocuments
                  ? "Ask about the document, or say hi..."
                  : "Upload a PDF or ask general questions..."
              }
              className="w-full bg-transparent text-sm text-slate-100 placeholder-slate-500 px-4 py-3 resize-none focus:outline-none max-h-40 leading-relaxed"
            />
          </div>

          <button
            type="submit"
            disabled={!input.trim() || loading}
            className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-all cursor-pointer ${
              input.trim() && !loading
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
            title="Send Message"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 mt-2">
          Answers generated with Google Gemini and grounded with pgvector similarity search.
        </p>
      </div>
    </div>
  );
}
