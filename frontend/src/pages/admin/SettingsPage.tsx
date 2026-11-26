import React, { useState, useEffect } from 'react';
import { auditLogApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { AuditLog } from '../../types';
import { Card, Badge, Skeleton } from '../../components/ui';
import { Settings as SettingsIcon, ShieldCheck, Database, Lock, Clock } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditLogApi.list()
      .then(res => setLogs(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">System Settings & Security Audit</h1>
        <p className="text-sm text-slate-400">Configuration overview, compliance, and tamper-resistant audit logs</p>
      </div>

      {/* Security Policies */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-sm">
            <ShieldCheck className="w-4 h-4" />
            <span>Two User Types</span>
          </div>
          <p className="text-xs text-slate-400">
            Strict separation: Only Administrator and Employee roles. Self-registration is strictly blocked.
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
            <Lock className="w-4 h-4" />
            <span>Anonymous Decoupling</span>
          </div>
          <p className="text-xs text-slate-400">
            Anonymous ballots store participation tokens independently from answer choices.
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
            <Database className="w-4 h-4" />
            <span>Cryptographic OTP</span>
          </div>
          <p className="text-xs text-slate-400">
            OTPs are hashed with salted SHA-256 before storage, enforcing a 3-attempt limit and 5-min expiry.
          </p>
        </Card>
      </div>

      {/* Audit Log Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">System Audit Trail</h3>
            <p className="text-xs text-slate-400">Timestamped record of administrative actions and voting sessions</p>
          </div>
          <Badge variant="blue">Immutable Trail</Badge>
        </div>

        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : logs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">No audit logs recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp (IST)</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">User Role</th>
                  <th className="px-4 py-3">Actor</th>
                  <th className="px-4 py-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                      {formatIndiaDateTime(log.timestamp, true)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">
                      <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-blue-400">
                      {log.user_type}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {log.actor_name || 'System'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-[11px] max-w-xs truncate">
                      {JSON.stringify(log.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
