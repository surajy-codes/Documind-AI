import React from 'react';
import { FileText, Bookmark, ExternalLink, Hash } from 'lucide-react';

export default function SourceCard({ source, index, onSelect }) {
  return (
    <div
      onClick={() => onSelect && onSelect(source)}
      className="p-3 rounded-xl bg-slate-900/80 border border-indigo-500/20 hover:border-indigo-500/40 transition-all text-left group cursor-pointer"
    >
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 truncate">
          <FileText className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200 truncate" title={source.document}>
            {source.document}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
            Page {source.page}
          </span>
          {source.score !== null && source.score !== undefined && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
              {(1 - source.score > 0 ? (1 - source.score).toFixed(2) : source.score.toFixed(2))} rel
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed font-sans italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
        "{source.snippet}"
      </p>
    </div>
  );
}
