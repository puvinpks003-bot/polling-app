import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pollApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Poll } from '../../types';
import { Card, Badge, Button, Skeleton } from '../../components/ui';
import { History, CheckCircle2, ArrowRight, Lock, Calendar } from 'lucide-react';

export const EmployeeVotingHistory: React.FC = () => {
  const navigate = useNavigate();
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pollApi.getVotingHistory()
      .then(res => setPolls(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Your Voting History</h1>
        <p className="text-sm text-slate-400">All surveys and company ballots you have participated in</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : polls.length === 0 ? (
        <Card className="p-12 text-center text-slate-400">
          <History className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No voting history yet</p>
          <p className="text-xs text-slate-500 mt-1">Vote in active polls to build your participation history.</p>
          <Button onClick={() => navigate('/employee')} className="mt-4">
            View Open Polls
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => (
            <Card key={poll.id} className="p-5 hover:border-slate-700 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Vote Recorded
                    </span>
                    {poll.anonymous_voting && (
                      <span className="text-[11px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Anonymous
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-white">{poll.title}</h3>
                  <p className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Closed {formatIndiaDateTime(poll.end_datetime, true)}
                  </p>
                </div>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/employee/polls/${poll.id}`)}
                  className="gap-1.5"
                >
                  <span>View Ballot</span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
