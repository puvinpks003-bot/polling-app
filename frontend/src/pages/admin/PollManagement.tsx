import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pollApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Poll } from '../../types';
import { Button, Card, Badge, Skeleton, ConfirmModal } from '../../components/ui';
import {
  Vote, PlusCircle, Search, Filter, Eye,
  Play, StopCircle, Copy, BarChart3, Calendar,
  Users, CheckCircle2, Clock, Lock, RotateCcw, AlertCircle,
  Trash2
} from 'lucide-react';

export const PollManagement: React.FC = () => {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Premium Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText: string;
    variant: 'danger' | 'warning' | 'primary' | 'success';
    itemName?: string;
    itemBadge?: string;
    infoCallout?: string;
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirm',
    variant: 'warning',
    onConfirm: async () => {},
  });

  const [actionLoading, setActionLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 4000);
  };

  const loadPolls = async () => {
    setLoading(true);
    try {
      const data = await pollApi.list({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        search: search || undefined,
      });
      setPolls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, [statusFilter]);

  const triggerPublish = (poll: Poll) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Publish Poll to Eligible Voters?',
      description: 'This poll will become immediately active and eligible employees will be notified to cast their votes.',
      confirmText: 'Publish Poll Now',
      variant: 'primary',
      itemName: poll.title,
      itemBadge: poll.target_audience === 'all' ? 'All Employees' : 'Targeted',
      infoCallout: 'Important: Ballot options cannot be edited once voting begins.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await pollApi.publish(poll.id);
          showToast(`"${poll.title}" has been published and is now active!`, 'success');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          loadPolls();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to publish poll.', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const triggerClose = (poll: Poll) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Close Voting for this Poll Immediately?',
      description: 'Voting will be stopped right now. Employees will no longer be able to cast ballots in this poll.',
      confirmText: 'Close Poll Immediately',
      variant: 'warning',
      itemName: poll.title,
      itemBadge: `${poll.voting_type.replace('_', ' ')} • ${poll.total_votes || 0} votes recorded`,
      infoCallout: 'Notice: You can re-open or extend this poll anytime from the Closed tab.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await pollApi.close(poll.id);
          showToast(`"${poll.title}" has been closed.`, 'success');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          loadPolls();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to close poll.', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const triggerReopen = (poll: Poll) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Re-open Poll for Voting?',
      description: 'This poll will be re-activated with a 7-day extension so eligible employees can cast their votes.',
      confirmText: 'Re-open Poll Now',
      variant: 'primary',
      itemName: poll.title,
      itemBadge: '7 Days Extension',
      infoCallout: 'Eligible employees will immediately be able to access the ballot again.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await pollApi.reopen(poll.id);
          showToast(`"${poll.title}" has been re-opened and is now active!`, 'success');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          loadPolls();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to re-open poll.', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const triggerDuplicate = async (poll: Poll) => {
    try {
      await pollApi.duplicate(poll.id);
      showToast(`Copy of "${poll.title}" created as draft.`, 'success');
      loadPolls();
    } catch (err: any) {
      showToast('Failed to duplicate poll.', 'error');
    }
  };

  const triggerDelete = (poll: Poll) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Poll Permanently?',
      description: `Are you sure you want to delete "${poll.title}"? All configured options, participant votes, and results will be permanently removed. This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      variant: 'danger',
      itemName: poll.title,
      itemBadge: `${poll.status.toUpperCase()} Poll`,
      infoCallout: 'Warning: This will permanently purge the poll and all related voting records from the system.',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await pollApi.delete(poll.id);
          showToast(`Poll "${poll.title}" was successfully deleted.`, 'success');
          setConfirmConfig((prev) => ({ ...prev, isOpen: false }));
          loadPolls();
        } catch (err: any) {
          showToast(err.response?.data?.error || 'Failed to delete poll.', 'error');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const tabs = [
    { label: 'All Polls', value: 'all' },
    { label: 'Active', value: 'active' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Drafts', value: 'draft' },
    { label: 'Closed', value: 'closed' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Poll Management</h1>
          <p className="text-sm text-slate-400">Create, schedule, publish, and oversee company polls</p>
        </div>
        <Button onClick={() => navigate('/admin/polls/create')} className="gap-2">
          <PlusCircle className="w-4 h-4" />
          <span>Create Poll</span>
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto w-full md:w-auto">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.value
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search polls..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadPolls()}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Polls List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Vote className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No polls found</p>
          <p className="text-xs text-slate-500 mt-1">Create your first poll or adjust your status filter.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((poll) => (
            <Card key={poll.id} className="p-5 hover:border-slate-700 transition-colors">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={poll.status === 'active' ? 'emerald' : poll.status === 'draft' ? 'slate' : poll.status === 'scheduled' ? 'purple' : 'amber'}>
                      {poll.status.toUpperCase()}
                    </Badge>
                    {poll.category_name && (
                      <span className="text-[11px] font-medium text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                        {poll.category_name}
                      </span>
                    )}
                    {poll.anonymous_voting && (
                      <span className="text-[11px] font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Anonymous
                      </span>
                    )}
                    <span className="text-[11px] font-mono text-slate-400">
                      Type: {poll.voting_type.replace('_', ' ')}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white hover:text-blue-400 transition-colors">
                    {poll.title}
                  </h3>
                  <p className="text-xs text-slate-400 line-clamp-1">{poll.description}</p>

                  <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Closes: {formatIndiaDateTime(poll.end_datetime, true)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-400" />
                      Target: {poll.target_audience === 'all' ? 'All Employees' : poll.target_department_names?.join(', ') || 'Restricted'}
                    </span>
                    <span className="font-mono text-blue-400">
                      {poll.total_votes || 0} Votes ({poll.participation_rate || 0}% Participation)
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap md:self-center">
                  {poll.status === 'draft' && (
                    <Button size="sm" onClick={() => triggerPublish(poll)} className="gap-1.5">
                      <Play className="w-3.5 h-3.5" />
                      Publish
                    </Button>
                  )}
                  {poll.status === 'active' && (
                    <Button size="sm" variant="outline" onClick={() => triggerClose(poll)} className="gap-1.5 text-amber-400 hover:text-amber-300">
                      <StopCircle className="w-3.5 h-3.5" />
                      Close
                    </Button>
                  )}
                  {poll.status === 'closed' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => triggerReopen(poll)}
                      className="gap-1.5 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-300"
                      title="Re-open poll with 7 days extension for employee voting"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Re-open
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/admin/results?poll_id=${poll.id}`)}
                    className="gap-1.5"
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                    Results
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => triggerDuplicate(poll)}
                    title="Duplicate Poll"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => triggerDelete(poll)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors gap-1.5"
                    title="Delete Poll Permanently"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Premium Confirm Modal */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => !actionLoading && setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        description={confirmConfig.description}
        confirmText={confirmConfig.confirmText}
        variant={confirmConfig.variant}
        itemName={confirmConfig.itemName}
        itemBadge={confirmConfig.itemBadge}
        infoCallout={confirmConfig.infoCallout}
        isLoading={actionLoading}
      />

      {/* Floating Enterprise Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md ${
              toastMsg.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-500/10'
                : 'bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-500/10'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMsg.text}</span>
          </div>
        </div>
      )}
    </div>
  );
};
