import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Trash2, CheckCircle2, AlertCircle, Loader2, Layers, BookOpen } from 'lucide-react';

export default function DocumentSidebar({ documents, onUpload, onDelete, uploading, uploadProgress }) {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    setErrorMsg('');
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndUpload(files[0]);
    }
  };

  const handleFileChange = (e) => {
    setErrorMsg('');
    if (e.target.files && e.target.files.length > 0) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Only PDF files are supported.');
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg('File size must be under 25MB.');
      return;
    }
    try {
      await onUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed');
    }
  };

  const totalPages = documents.reduce((acc, doc) => acc + (doc.total_pages || 0), 0);
  const totalChunks = documents.reduce((acc, doc) => acc + (doc.total_chunks || 0), 0);

  return (
    <aside className="w-full lg:w-84 border-r border-slate-800/80 bg-slate-900/30 flex flex-col h-[calc(100vh-61px)]">
      {/* Upload Box */}
      <div className="p-4 border-b border-slate-800/80">
        <h2 className="font-heading text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center justify-between">
          <span>Knowledge Ingestion</span>
          <span className="text-[11px] font-normal text-indigo-400">PDF Only</span>
        </h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-800/40 hover:bg-slate-800/60'
          } ${uploading ? 'opacity-70 pointer-events-none' : ''}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploading ? (
            <div className="py-2 flex flex-col items-center justify-center gap-2">
              <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
              <p className="text-xs font-medium text-slate-200">Extracting & Vectorizing...</p>
              <p className="text-[11px] text-slate-400">PyMuPDF parsing & Gemini embeddings</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div className="h-10 w-10 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <UploadCloud className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold text-slate-200">
                Click to upload <span className="font-normal text-slate-400">or drag & drop</span>
              </p>
              <p className="text-[11px] text-slate-500">PDF up to 25MB</p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* Document List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-slate-400">
            Indexed Documents ({documents.length})
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-xl border border-slate-800/50 bg-slate-800/20">
            <BookOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-400">No documents uploaded yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Upload a PDF to ground the agent in your documents. You can still ask general questions anytime!
            </p>
          </div>
        ) : (
          documents.map((doc) => (
            <div
              key={doc.filename}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 hover:border-slate-600/80 transition-all flex items-start justify-between gap-3 group"
            >
              <div className="flex items-start gap-2.5 overflow-hidden">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-medium text-slate-200 truncate" title={doc.filename}>
                    {doc.filename}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">
                      {doc.total_pages} {doc.total_pages === 1 ? 'page' : 'pages'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/60 text-indigo-300 border border-indigo-800/40">
                      {doc.total_chunks} chunks
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDelete(doc.filename)}
                className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all cursor-pointer"
                title="Delete document and embeddings"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Bottom Stats Footer */}
      <div className="p-4 border-t border-slate-800/80 bg-slate-900/50">
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <p className="text-[10px] uppercase text-slate-500 font-medium">Pages</p>
            <p className="text-sm font-semibold text-slate-200 mt-0.5">{totalPages}</p>
          </div>
          <div className="p-2 rounded-lg bg-slate-800/40 border border-slate-800">
            <p className="text-[10px] uppercase text-slate-500 font-medium">Vector Chunks</p>
            <p className="text-sm font-semibold text-indigo-300 mt-0.5">{totalChunks}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
