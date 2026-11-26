import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { pollApi, analyticsApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Poll, PollResults } from '../../types';
import { Card, Badge, Button, Modal, Skeleton } from '../../components/ui';
import {
  BarChart3, Award, Users, CheckCircle2,
  FileSpreadsheet, ArrowLeft, Lock, Star, ChevronDown,
  RotateCcw, Search, AlertCircle
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export const PollResultsPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const pollIdParam = searchParams.get('poll_id');

  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPollId, setSelectedPollId] = useState<number | null>(pollIdParam ? Number(pollIdParam) : null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-submit state
  const [selectedVoterForReset, setSelectedVoterForReset] = useState<any | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [voterSearch, setVoterSearch] = useState('');

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#6366f1'];

  const fetchResults = (pollId: number) => {
    setLoading(true);
    pollApi.getResults(pollId)
      .then(res => setResults(res))
      .catch(err => {
        console.error(err);
        setResults(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    pollApi.list().then(list => {
      setPolls(list);
      if (!selectedPollId && list.length > 0) {
        setSelectedPollId(list[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedPollId) return;
    setResetSuccessMsg(null);
    fetchResults(selectedPollId);
  }, [selectedPollId]);

  const handleOpenResetModal = (voter: any) => {
    setSelectedVoterForReset(voter);
    setResetErrorMsg(null);
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    if (!selectedPollId || !selectedVoterForReset) return;
    setResetLoading(true);
    setResetErrorMsg(null);
    try {
      const res = await pollApi.resetVote(selectedPollId, selectedVoterForReset.employee_pk);
      setResetSuccessMsg(res.message);
      setIsResetModalOpen(false);
      setSelectedVoterForReset(null);
      fetchResults(selectedPollId);
    } catch (err: any) {
      setResetErrorMsg(err.response?.data?.error || 'Failed to reset vote.');
    } finally {
      setResetLoading(false);
    }
  };

  const filteredVoters = (results?.voters || []).filter(v => {
    const q = voterSearch.toLowerCase();
    return (
      v.employee_name.toLowerCase().includes(q) ||
      v.employee_id.toLowerCase().includes(q) ||
      v.department.toLowerCase().includes(q) ||
      v.selections.some(s => s.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Voting Results & Analytics</h1>
          <p className="text-sm text-slate-400">Detailed option distribution, voter choices, and participation audits</p>
        </div>
        <div className="flex items-center gap-3">
          {selectedPollId && (
            <a
              href={analyticsApi.getReportExportUrl(selectedPollId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg text-xs font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 gap-1.5 transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Export Excel</span>
            </a>
          )}
        </div>
      </div>

      {/* Success alert */}
      {resetSuccessMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{resetSuccessMsg}</span>
          </div>
          <button
            onClick={() => setResetSuccessMsg(null)}
            className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Poll Selector Dropdown */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
            Select Poll to Analyze:
          </label>
          <select
            value={selectedPollId || ''}
            onChange={(e) => setSelectedPollId(Number(e.target.value))}
            className="w-full sm:flex-1 px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-sm text-slate-100 font-medium focus:outline-none focus:border-blue-500"
          >
            {polls.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.status.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Main Results View */}
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      ) : !results ? (
        <Card className="p-12 text-center text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto text-slate-600 mb-3" />
          <p className="text-base font-semibold text-slate-300">No results available</p>
          <p className="text-xs text-slate-500 mt-1">This poll may not have received any votes yet.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Header Summary Banner */}
          <Card className="p-6 bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={results.anonymous_voting ? 'purple' : 'blue'}>
                    {results.anonymous_voting ? 'ANONYMOUS BALLOT' : 'STANDARD BALLOT'}
                  </Badge>
                  <span className="text-xs text-slate-400 capitalize">
                    {results.voting_type.replace('_', ' ')}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">{results.title}</h2>
              </div>

              {/* Stats highlights */}
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 font-medium">Turnout</p>
                  <p className="text-2xl font-black text-blue-400 mt-0.5">{results.participation_rate}%</p>
                </div>
                <div className="text-center border-l border-slate-800 pl-6">
                  <p className="text-xs text-slate-400 font-medium">Participants</p>
                  <p className="text-2xl font-black text-white mt-0.5">
                    {results.total_participants} <span className="text-xs text-slate-500">/ {results.total_eligible}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Winner Banner if available */}
            {results.winner && results.winner.vote_count > 0 && (
              <div className="mt-5 p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Winning Choice</span>
                    <h4 className="text-sm font-bold text-white">{results.winner.text}</h4>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-mono font-bold text-blue-400">{results.winner.vote_count} votes</span>
                  <span className="text-xs text-slate-400 ml-1.5">({results.winner.percentage}%)</span>
                </div>
              </div>
            )}
          </Card>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Options Bar Chart */}
            <Card className="p-6">
              <h3 className="text-base font-bold text-white mb-4">Option Vote Counts</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.options} layout="vertical" margin={{ left: 20 }}>
                    <XAxis type="number" stroke="#64748b" fontSize={12} />
                    <YAxis dataKey="text" type="category" stroke="#94a3b8" fontSize={11} width={120} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    />
                    <Bar dataKey="vote_count" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Votes" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Options Pie / Donut Chart */}
            <Card className="p-6">
              <h3 className="text-base font-bold text-white mb-4">Vote Percentage Distribution</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={results.options}
                      dataKey="vote_count"
                      nameKey="text"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      label={({ name, percent }: any) => `${(percent * 100).toFixed(0)}%`}
                    >
                      {results.options.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Option Wise Breakdown Table */}
          <Card className="p-6">
            <h3 className="text-base font-bold text-white mb-4">Detailed Options Breakdown</h3>
            <div className="space-y-4">
              {results.options.map((opt, idx) => (
                <div key={opt.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-slate-200">
                      {idx + 1}. {opt.text}
                    </span>
                    <span className="font-mono text-xs text-blue-400 font-bold">
                      {opt.vote_count} votes ({opt.percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${opt.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* NEW SECTION: EMPLOYEE VOTER DETAILS & SELECTIONS + RE-SUBMIT */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  <span>Employee Voter Records & Selections</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Detailed roster of employees who voted in this poll and their recorded choices
                </p>
              </div>

              {/* Search voter */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search voter, ID, or selection..."
                  value={voterSearch}
                  onChange={(e) => setVoterSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {(!results.voters || results.voters.length === 0) ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No individual voter records found for this poll.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-800/80">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="uppercase bg-slate-950/90 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-4 py-3">Department</th>
                      <th className="px-4 py-3">Recorded Selection(s)</th>
                      <th className="px-4 py-3">Voted Timestamp (IST)</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                    {filteredVoters.map((voter) => (
                      <tr key={voter.employee_pk} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{voter.employee_name}</div>
                          <div className="font-mono text-[11px] text-blue-400">ID: {voter.employee_id}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-300">
                          {voter.department}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1.5 max-w-sm">
                            {voter.selections.map((sel, sIdx) => (
                              <span
                                key={sIdx}
                                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-500/10 border border-blue-500/25 text-blue-300 inline-block"
                              >
                                {sel}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                          {formatIndiaDateTime(voter.voted_at, true)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenResetModal(voter)}
                            className="gap-1.5 text-xs text-amber-400 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-300"
                            title="Reset this employee's vote to allow re-submission"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Re-submit</span>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Non-anonymous Department Breakdown (If applicable) */}
          {results.department_breakdown && results.department_breakdown.length > 0 && (
            <Card className="p-6">
              <h3 className="text-base font-bold text-white mb-3">Voter Turnout by Department</h3>
              <p className="text-xs text-slate-400 mb-4">Department breakdown for verified ballot</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {results.department_breakdown.map((dept, idx) => (
                  <div key={idx} className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg">
                    <p className="text-xs text-slate-400">{dept.department}</p>
                    <p className="text-lg font-bold text-white mt-0.5">{dept.count} votes</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Anonymous Privacy Assurance Note */}
          {results.anonymous_voting && (
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-3 text-xs text-purple-300">
              <Lock className="w-5 h-5 shrink-0 text-purple-400" />
              <span>
                <strong>Confidential Anonymous Ballot:</strong> Individual voter names and option selections are decoupled at the database schema level. Admin can reset participation to permit re-submission, while the ballot answers remain confidential.
              </span>
            </div>
          )}
        </div>
      )}

      {/* RE-SUBMIT CONFIRMATION MODAL */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => { setIsResetModalOpen(false); setSelectedVoterForReset(null); }}
        title="Allow Employee to Re-Submit Vote"
        description="Prior voting record will be deleted"
      >
        {selectedVoterForReset && (
          <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
            <p>
              Are you sure you want to allow <span className="font-bold text-white">{selectedVoterForReset.employee_name}</span> (<span className="text-blue-400 font-mono">{selectedVoterForReset.employee_id}</span>) to re-submit their vote for this poll?
            </p>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-1">
              <span className="text-slate-400 text-xs block">Current Selection to be Deleted:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {selectedVoterForReset.selections.map((s: string, idx: number) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-white font-medium text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>What happens next:</strong> The prior vote record and selections will be permanently deleted from the database. The employee will receive an instant notification enabling them to log in and cast their vote again.
              </span>
            </div>

            {resetErrorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{resetErrorMsg}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
              <Button
                variant="outline"
                onClick={() => { setIsResetModalOpen(false); setSelectedVoterForReset(null); }}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleConfirmReset}
                isLoading={resetLoading}
                className="gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm & Delete Record</span>
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
