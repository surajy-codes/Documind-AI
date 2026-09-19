import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { User, Sparkles, Database, GitBranch, Copy, Check, BookOpen } from 'lucide-react';
import SourceCard from './SourceCard';

export default function MessageBubble({ message, onSelectSource }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex items-start justify-end gap-3 mb-5 group">
        <div className="max-w-2xl bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-md shadow-indigo-500/10">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className="h-8 w-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-slate-300 shrink-0">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const isRAG = message.route === 'RAG';

  return (
    <div className="flex items-start gap-3 mb-6 group">
      <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-indigo-500/20">
        <Sparkles className="h-4 w-4" />
      </div>

      <div className="flex-1 max-w-3xl">
        {/* Route Badge */}
        {message.route && (
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                isRAG
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/25'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
              }`}
            >
              {isRAG ? (
                <>
                  <Database className="h-3 w-3" />
                  <span>Router: RAG Mode (Grounded in documents)</span>
                </>
              ) : (
                <>
                  <GitBranch className="h-3 w-3" />
                  <span>Router: Direct LLM (General Knowledge)</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Message Content Container */}
        <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl rounded-tl-sm p-4 relative">
          <div className="prose-dark font-sans text-sm">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>

          {/* Action Bar */}
          <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="font-mono text-[11px]">
                {isRAG ? 'Grounded with pgvector' : 'Zero doc retrieval'}
              </span>
            </div>

            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer"
              title="Copy message"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Source Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3.5 pl-1">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="h-3.5 w-3.5 text-indigo-400" />
              <h4 className="font-heading text-xs font-semibold uppercase tracking-wider text-slate-400">
                Sources & Citations ({message.sources.length})
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {message.sources.map((source, idx) => (
                <SourceCard
                  key={`${source.document}-${source.page}-${idx}`}
                  source={source}
                  index={idx}
                  onSelect={onSelectSource}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
