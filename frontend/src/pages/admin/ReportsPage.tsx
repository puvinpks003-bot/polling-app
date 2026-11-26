import React, { useState, useEffect } from 'react';
import { pollApi, analyticsApi } from '../../lib/api';
import { formatIndiaDate } from '../../lib/date';
import { Poll } from '../../types';
import { Card, Button, Badge } from '../../components/ui';
import { FileSpreadsheet, Download, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    pollApi.list().then(res => setPolls(res));
  }, []);

  const handleDownload = async (pollId?: number, format: 'excel' | 'pdf' = 'excel') => {
    const key = `${pollId ?? 'master'}-${format}`;
    setErrorMsg(null);
    setSuccessMsg(null);
    setDownloadingKey(key);
    try {
      await analyticsApi.downloadReport(pollId, format);
      setSuccessMsg(`Report successfully downloaded as ${format.toUpperCase()}.`);
    } catch (err: any) {
      console.error('Export error:', err);
      setErrorMsg(err.response?.data?.error || `Failed to download ${format.toUpperCase()} report. Please ensure you are logged in as admin.`);
    } finally {
      setDownloadingKey(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Reports & Data Exports</h1>
        <p className="text-sm text-slate-400">Download comprehensive Excel spreadsheets and PDF audit summaries of organizational polling results</p>
      </div>

      {/* Notification banners */}
      {successMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-300 hover:text-white text-xs cursor-pointer">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-300 hover:text-white text-xs cursor-pointer">✕</button>
        </div>
      )}

      {/* Primary System Report */}
      <Card className="p-6 bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border-blue-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <Badge variant="blue">SYSTEM WIDE</Badge>
            <h3 className="text-lg font-bold text-white">Full SG ONE Comprehensive Overview</h3>
            <p className="text-xs text-slate-300">
              Includes total active and inactive employees, total polls, overall participation rates, and department counts.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleDownload(undefined, 'excel')}
              disabled={downloadingKey === 'master-excel'}
              className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg text-xs font-bold gap-2 shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
            >
              {downloadingKey === 'master-excel' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              <span>Master Excel</span>
            </button>
            <button
              onClick={() => handleDownload(undefined, 'pdf')}
              disabled={downloadingKey === 'master-pdf'}
              className="inline-flex items-center justify-center px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 disabled:opacity-60 text-slate-200 rounded-lg text-xs font-bold gap-1.5 transition-all cursor-pointer"
            >
              {downloadingKey === 'master-pdf' ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
              ) : (
                <FileText className="w-4 h-4 text-rose-400" />
              )}
              <span>Master PDF</span>
            </button>
          </div>
        </div>
      </Card>

      {/* Individual Poll Reports */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Individual Poll Result Exports</h3>
        <p className="text-xs text-slate-400">Export detailed ballot breakdowns, option tallies, and participation percentages</p>

        <div className="divide-y divide-slate-800">
          {polls.map((poll) => (
            <div key={poll.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{poll.title}</h4>
                  <Badge variant={poll.status === 'active' ? 'emerald' : 'slate'}>{poll.status}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {poll.total_votes || 0} votes cast • {poll.options.length} options • Created {formatIndiaDate(poll.created_at)}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(poll.id, 'excel')}
                  disabled={downloadingKey === `${poll.id}-excel`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {downloadingKey === `${poll.id}-excel` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span>Export XLSX</span>
                </button>
                <button
                  onClick={() => handleDownload(poll.id, 'pdf')}
                  disabled={downloadingKey === `${poll.id}-pdf`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                >
                  {downloadingKey === `${poll.id}-pdf` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-rose-400" />
                  )}
                  <span>Export PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
