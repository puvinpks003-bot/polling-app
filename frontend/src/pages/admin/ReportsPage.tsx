import React, { useState, useEffect } from 'react';
import { pollApi, analyticsApi } from '../../lib/api';
import { formatIndiaDate } from '../../lib/date';
import { Poll } from '../../types';
import { Card, Button, Badge } from '../../components/ui';
import { FileSpreadsheet, Download, FileText, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [polls, setPolls] = useState<Poll[]>([]);

  useEffect(() => {
    pollApi.list().then(res => setPolls(res));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Reports & Data Exports</h1>
        <p className="text-sm text-slate-400">Download comprehensive Excel spreadsheets of organizational polling results</p>
      </div>

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
          <a
            href={analyticsApi.getReportExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold gap-2 shadow-sm shadow-blue-500/25 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download Master Report</span>
          </a>
        </div>
      </Card>

      {/* Individual Poll Reports */}
      <Card className="p-6 space-y-4">
        <h3 className="text-base font-bold text-white">Individual Poll Result Exports</h3>
        <p className="text-xs text-slate-400">Export detailed ballot breakdowns, option tallies, and participation percentages</p>

        <div className="divide-y divide-slate-800">
          {polls.map((poll) => (
            <div key={poll.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">{poll.title}</h4>
                  <Badge variant={poll.status === 'active' ? 'emerald' : 'slate'}>{poll.status}</Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {poll.total_votes || 0} votes cast • {poll.options.length} options • Created {formatIndiaDate(poll.created_at)}
                </p>
              </div>

              <a
                href={analyticsApi.getReportExportUrl(poll.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export XLSX</span>
              </a>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
