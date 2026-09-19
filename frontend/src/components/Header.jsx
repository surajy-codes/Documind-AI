import React from 'react';
import { Sparkles, Database, Trash2, Cpu } from 'lucide-react';

export default function Header({ health, onClearChat }) {
  const isHealthy = health?.status === 'healthy';
  const isPostgres = health?.database_type?.toLowerCase().includes('postgres');

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 px-6 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-heading font-bold text-lg tracking-tight text-white">DocuMind AI</h1>
            <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Agentic RAG
            </span>
          </div>
          <p className="text-xs text-slate-400 hidden sm:block">
            LangGraph Router + Gemini Embeddings + PyMuPDF + pgvector
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Vector DB status indicator */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs">
          <Database className={`h-3.5 w-3.5 ${isHealthy ? (isPostgres ? 'text-emerald-400' : 'text-amber-400') : 'text-rose-400'}`} />
          <span className="text-slate-300 font-medium">
            {health?.database_type || 'Checking DB...'}
          </span>
          <span className={`inline-block h-2 w-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        </div>

        {/* Gemini Model indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs text-slate-300">
          <Cpu className="h-3.5 w-3.5 text-indigo-400" />
          <span>Gemini 2.5 Flash</span>
        </div>


        {/* Clear chat */}
        <button
          onClick={onClearChat}
          className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          title="Clear Conversation"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
