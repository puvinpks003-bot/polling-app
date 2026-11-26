import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { pollApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Poll } from '../../types';
import { Card, Badge, Button, Skeleton } from '../../components/ui';
import {
  Vote, CheckCircle2, Clock, Calendar,
  Lock, Sparkles, ArrowRight, BarChart3, MessageSquare
} from 'lucide-react';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const employee = user as any;

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<'active' | 'completed'>('active');

  const loadPolls = async () => {
    setLoading(true);
    try {
      const data = await pollApi.list();
      setPolls(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPolls();
  }, []);

  const activePolls = polls.filter(p => p.status === 'active' && !p.has_voted);
  const votedOrClosedPolls = polls.filter(p => p.has_voted || p.status === 'closed');

  const displayedPolls = filterTab === 'active' ? activePolls : votedOrClosedPolls;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="p-6 bg-gradient-to-r from-blue-900/40 via-slate-900 to-indigo-950/40 border-blue-500/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                {employee?.department || 'Department Unassigned'}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-xs font-mono text-slate-400">ID: {employee?.employee_id}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Welcome, {employee?.full_name || 'Team Member'}!
            </h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Your voice shapes our workplace. Participate in open surveys and company decisions below.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
              <span className="text-xs text-slate-400 block font-medium">Pending Polls</span>
              <span className="text-xl font-black text-blue-400">{activePolls.length}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setFilterTab('active')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filterTab === 'active'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Open for Voting ({activePolls.length})</span>
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
              filterTab === 'completed'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Polls ({votedOrClosedPolls.length})</span>
          </button>
        </div>
      </div>

      {/* Poll Cards List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : displayedPolls.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <Vote className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">
            {filterTab === 'active' ? 'No pending polls!' : 'No completed polls yet'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {filterTab === 'active'
              ? 'You have answered all available surveys. Check back later for new company polls.'
              : 'Polls you participate in will appear here.'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {displayedPolls.map((poll) => {
            const hasVoted = poll.has_voted;
            const isClosed = poll.status === 'closed';

            return (
              <Card
                key={poll.id}
                className="flex flex-col justify-between hover:border-slate-700 transition-all p-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      {poll.category_name && (
                        <span className="text-[11px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          {poll.category_name}
                        </span>
                      )}
                      {poll.anonymous_voting && (
                        <span className="text-[11px] font-semibold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Anonymous
                        </span>
                      )}
                    </div>
                    {hasVoted ? (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Voted
                      </span>
                    ) : isClosed ? (
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                        Closed
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        Active
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                      {poll.title}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {poll.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Ends {formatIndiaDateTime(poll.end_datetime, true)}</span>
                  </div>

                  {hasVoted || isClosed ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/employee/polls/${poll.id}`)}
                      className="gap-1.5"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>View Details</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => navigate(`/employee/polls/${poll.id}`)}
                      className="gap-1.5 shadow-sm shadow-blue-500/30"
                    >
                      <span>Vote Now</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
