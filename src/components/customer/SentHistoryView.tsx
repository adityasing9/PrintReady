import React, { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Repeat,
  Share2,
  Trash2,
} from 'lucide-react';
import { usePrintReady } from '../../context/PrintReadyContext';
import { dispatchPrintJob } from '../../services/fileSharingService';

export function SentHistoryView() {
  const { sentHistory, clearSentHistory, notify } = usePrintReady();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleResend = async (job: typeof sentHistory[0]) => {
    notify('Dispatching...', `Re-sending print order to ${job.shopName}...`, 'info');
    try {
      const res = await dispatchPrintJob({
        documentIds: job.documentIds || [],
        documentNames: job.fileNames || [],
        text: job.message,
        target: job.method === 'email' ? 'email' : job.method === 'whatsapp' ? 'whatsapp' : 'chooser',
        phone: job.method === 'whatsapp' ? job.shopContact : undefined,
        email: job.method === 'email' ? job.shopContact : undefined,
        subject: `Print Request: ${job.totalFiles} files (${job.shopName})`,
      });
      notify('Re-sent', res.message || 'Dispatch completed.', 'success');
    } catch (err) {
      console.error('Re-send error:', err);
      notify('Re-send Failed', 'Could not dispatch order.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-2">
            <Clock className="w-3.5 h-3.5" />
            Sent Dispatches
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Sent Print History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Keep track of what documents you sent to which shop, with date and exact specifications.
          </p>
        </div>

        {sentHistory.length > 0 && (
          <button
            type="button"
            onClick={clearSentHistory}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear History
          </button>
        )}
      </div>

      {/* Empty State */}
      {sentHistory.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 sm:p-14 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              No sent print jobs yet
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              When you send documents from your Print Queue to a print shop via WhatsApp or Email, the record of the dispatch will be saved here.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sentHistory.map((job) => {
            const isExpanded = expandedId === job.id;
            const dateStr = new Date(job.sentAt).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={job.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        job.method === 'whatsapp'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600'
                          : job.method === 'email'
                          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600'
                          : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600'
                      }`}
                    >
                      {job.method === 'whatsapp' ? (
                        <MessageCircle className="w-5 h-5" />
                      ) : job.method === 'email' ? (
                        <Mail className="w-5 h-5" />
                      ) : (
                        <Share2 className="w-5 h-5" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          {job.shopName}
                        </h3>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            job.method === 'whatsapp'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          }`}
                        >
                          {job.method}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {dateStr} · {job.shopContact}
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        {job.totalFiles} document{job.totalFiles > 1 ? 's' : ''} ({job.totalCopies} copies)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => handleResend(job)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors"
                    >
                      <Repeat className="w-3.5 h-3.5" />
                      Re-send
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : job.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      {isExpanded ? 'Hide Brief' : 'View Brief'}
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* File tags */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {job.fileNames.map((fn, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    >
                      <FileText className="w-3 h-3 text-slate-400" />
                      {fn}
                    </span>
                  ))}
                </div>

                {/* Expandable Order Brief */}
                {isExpanded && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap border border-slate-200 dark:border-slate-700 mt-2">
                    {job.message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
