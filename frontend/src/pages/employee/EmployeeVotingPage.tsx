import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pollApi, commentApi } from '../../lib/api';
import { formatIndiaDateTime } from '../../lib/date';
import { Poll, PollComment } from '../../types';
import { Button, Card, Badge, Modal, Skeleton } from '../../components/ui';
import {
  Vote, CheckCircle2, Lock, ArrowLeft, Star,
  ShieldCheck, AlertCircle, MessageSquare, Send, Calendar,
  Award, Clock, BarChart3, Info
} from 'lucide-react';

export const EmployeeVotingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [poll, setPoll] = useState<Poll | null>(null);
  const [comments, setComments] = useState<PollComment[]>([]);
  const [loading, setLoading] = useState(true);

  // Voting state
  const [selectedOptionIds, setSelectedOptionIds] = useState<number[]>([]);
  const [ratingValue, setRatingValue] = useState<number>(8);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [voteSuccess, setVoteSuccess] = useState(false);

  // Real-time live second-by-second clock for auto-closure without reload
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const endMs = poll?.end_datetime ? new Date(poll.end_datetime).getTime() : 0;
  const remainingMs = Math.max(0, endMs - nowMs);
  const isTimeExpired = endMs > 0 && nowMs >= endMs;
  const hasVoted = poll ? (poll.has_voted || voteSuccess) : false;
  const isClosed = poll ? (poll.status === 'closed' || isTimeExpired) : false;

  const canViewResults = Boolean(
    poll?.results_visibility !== 'admin_only' && (
      poll?.can_view_results ||
      (poll?.results_visibility === 'always') ||
      (poll?.results_visibility === 'after_closing' && isClosed) ||
      (poll?.results_visibility === 'after_voting' && (hasVoted || isClosed))
    )
  );

  // Auto-close confirmation modal if time expires while modal is open
  useEffect(() => {
    if (isTimeExpired && isConfirmModalOpen) {
      setIsConfirmModalOpen(false);
      setVoteError('Voting deadline has ended. Ballots are no longer accepting submissions.');
    }
  }, [isTimeExpired, isConfirmModalOpen]);

  const formatCountdown = (ms: number) => {
    if (ms <= 0) return 'Concluded';
    const totalSecs = Math.floor(ms / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    if (days > 0) {
      return `${days}d ${hours}h left`;
    }
    if (hours > 0) {
      return `${hours}h ${String(mins).padStart(2, '0')}m left`;
    }
    return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s left`;
  };

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [isAnonComment, setIsAnonComment] = useState(false);
  const [commentLoading, setCommentLoading] = useState(false);

  const loadPollData = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const pollData = await pollApi.get(Number(id));
      setPoll(pollData);

      if (pollData.allow_comments) {
        const cList = await commentApi.list(Number(id));
        setComments(cList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPollData();
  }, [id]);

  const handleOptionToggle = (optionId: number) => {
    if (!poll) return;

    if (poll.voting_type === 'single_choice' || poll.voting_type === 'yes_no') {
      setSelectedOptionIds([optionId]);
    } else if (poll.voting_type === 'multiple_choice') {
      if (selectedOptionIds.includes(optionId)) {
        setSelectedOptionIds(selectedOptionIds.filter(o => o !== optionId));
      } else {
        setSelectedOptionIds([...selectedOptionIds, optionId]);
      }
    }
  };

  const handleVoteSubmit = async () => {
    if (!poll) return;

    // Strict last-minute client-side expiration check
    if (isClosed || isTimeExpired || (endMs > 0 && Date.now() >= endMs)) {
      setIsConfirmModalOpen(false);
      setVoteError('Voting deadline has passed. This poll has closed and your vote could not be submitted.');
      loadPollData();
      return;
    }

    setVoteError(null);
    setVoteLoading(true);

    try {
      const payload: any = {
        option_ids: poll.voting_type !== 'rating' ? selectedOptionIds : [],
        rating_value: poll.voting_type === 'rating' ? ratingValue : undefined,
      };

      await pollApi.vote(poll.id, payload);
      setIsConfirmModalOpen(false);
      setVoteSuccess(true);
      loadPollData();
    } catch (err: any) {
      setVoteError(err.response?.data?.error || 'Failed to submit vote. Please try again.');
      if (err.response?.status === 400 && String(err.response?.data?.error).includes('closed')) {
        loadPollData();
      }
    } finally {
      setVoteLoading(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!poll || !newComment.trim()) return;
    setCommentLoading(true);
    try {
      await commentApi.create({
        poll: poll.id,
        comment: newComment.trim(),
        is_anonymous: isAnonComment,
      });
      setNewComment('');
      const cList = await commentApi.list(poll.id);
      setComments(cList);
    } catch (err) {
      console.error(err);
    } finally {
      setCommentLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!poll) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <p className="text-slate-400">Poll not found or access restricted.</p>
        <Button onClick={() => navigate('/employee')} className="mt-4">Back to Dashboard</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/employee')}
        className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Polls</span>
      </button>

      {/* Main Ballot Card */}
      <Card className="p-6 space-y-6 border-slate-800 bg-slate-900/90 shadow-2xl">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            {poll.category_name && (
              <Badge variant="blue">{poll.category_name}</Badge>
            )}
            {poll.anonymous_voting && (
              <Badge variant="purple" className="flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Anonymous Ballot
              </Badge>
            )}
          </div>
          <span className="text-xs text-slate-400 capitalize">
            {poll.voting_type.replace('_', ' ')}
          </span>
        </div>

        {/* Title & Description */}
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
            {poll.title}
          </h1>
          {poll.description && (
            <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
              {poll.description}
            </p>
          )}
        </div>

        {/* Voting Deadline in IST + Real-Time Live Countdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              Voting Deadline: <strong className="text-white font-mono">{formatIndiaDateTime(poll.end_datetime, true)}</strong>
            </span>
          </div>

          {/* Live Dynamic Countdown Status */}
          <div className="shrink-0">
            {isClosed ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                Voting Closed
              </span>
            ) : remainingMs < 120000 ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-rose-500/20 border border-rose-500/40 text-rose-300 animate-pulse">
                <Clock className="w-3.5 h-3.5 text-rose-400 animate-spin" />
                Closes in: {formatCountdown(remainingMs)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold font-mono bg-blue-500/15 border border-blue-500/30 text-blue-300">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Time Remaining: {formatCountdown(remainingMs)}
              </span>
            )}
          </div>
        </div>

        {/* Feedback / Alerts */}
        {hasVoted && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-3 text-emerald-400 text-xs font-medium">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-emerald-300">Your Vote Has Been Counted</p>
              <p className="text-slate-300 mt-0.5">Thank you for participating! Your ballot for this poll has been securely recorded.</p>
            </div>
          </div>
        )}

        {isClosed && !hasVoted && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-amber-300 text-xs font-medium">
            <AlertCircle className="w-5 h-5 shrink-0 text-amber-400" />
            <div>
              <p className="font-semibold text-sm text-white">Voting Period Has Concluded</p>
              <p className="text-slate-300 mt-0.5">
                This poll closed on <strong className="text-amber-200">{formatIndiaDateTime(poll.end_datetime, true)}</strong>. Ballots are no longer accepting submissions.
              </p>
            </div>
          </div>
        )}

        {voteError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{voteError}</span>
          </div>
        )}

        {/* RESULTS SECTION (Displayed dynamically based on admin's visibility setting) */}
        {canViewResults && (
          <div className="p-5 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-4 shadow-inner">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {isClosed ? 'Final Poll Results' : 'Live Poll Results'}
                    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                      isClosed
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {isClosed ? 'Final Tally' : 'Live Standings'}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {poll.results_visibility === 'always'
                      ? 'Real-time voting tally updated dynamically'
                      : isClosed
                      ? 'Official verified tally for this concluded ballot'
                      : 'Live vote distribution and percentages'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-white">
                  {poll.total_votes ?? 0} {poll.total_votes === 1 ? 'Vote' : 'Votes'}
                </span>
                {typeof poll.participation_rate === 'number' && (
                  <span className="text-[11px] text-slate-400 ml-1.5 font-mono">
                    ({poll.participation_rate}% Turnout)
                  </span>
                )}
              </div>
            </div>

            {/* Rating Poll Results */}
            {poll.voting_type === 'rating' ? (
              <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-xl text-center space-y-2">
                <div className="text-3xl font-black text-blue-400 font-mono">
                  {poll.rating_stats?.average ?? 0} <span className="text-sm text-slate-400 font-normal">/ 10</span>
                </div>
                <p className="text-xs text-slate-400">
                  Average Rating Score across {poll.rating_stats?.total ?? poll.total_votes ?? 0} submission(s)
                </p>
              </div>
            ) : (
              /* Option Breakdown with Progress Bars */
              <div className="space-y-2.5 pt-1">
                {poll.options.map((opt) => {
                  const isMyChoice = (poll.my_selections || []).includes(opt.id) || selectedOptionIds.includes(opt.id);
                  const pct = opt.percentage ?? 0;
                  const votes = opt.vote_count ?? 0;

                  return (
                    <div
                      key={opt.id}
                      className={`space-y-1.5 p-3.5 rounded-xl border transition-all ${
                        isMyChoice
                          ? 'bg-blue-600/10 border-blue-500/40 shadow-sm shadow-blue-500/10'
                          : 'bg-slate-900/60 border-slate-800/80'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`font-semibold truncate ${isMyChoice ? 'text-white' : 'text-slate-200'}`}>
                            {opt.text}
                          </span>
                          {isMyChoice && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0 flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5 text-blue-400" />
                              Your Vote
                            </span>
                          )}
                        </div>
                        <div className="text-right shrink-0 font-mono text-xs">
                          <span className="text-white font-bold">{votes} {votes === 1 ? 'vote' : 'votes'}</span>
                          <span className="text-slate-400 ml-1.5 font-semibold">({pct}%)</span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            isMyChoice
                              ? 'bg-gradient-to-r from-blue-500 via-blue-400 to-indigo-500 shadow-sm shadow-blue-500/50'
                              : 'bg-gradient-to-r from-blue-700 to-blue-500'
                          }`}
                          style={{ width: `${Math.max(pct, votes > 0 ? 3 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE VOTING OPTIONS SELECTOR (If eligible and poll is currently open) */}
        {!hasVoted && !isClosed && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                {poll.voting_type === 'multiple_choice' ? 'Select all that apply:' : 'Select your choice:'}
              </div>

              {/* Informative Hint on when results will become visible */}
              {!canViewResults && (
                <div className="text-[11px] flex items-center gap-1.5">
                  {poll.results_visibility === 'after_voting' && (
                    <span className="text-blue-400 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5" /> Results will appear after voting
                    </span>
                  )}
                  {poll.results_visibility === 'after_closing' && (
                    <span className="text-amber-400/90 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Results revealed after deadline closes
                    </span>
                  )}
                  {poll.results_visibility === 'admin_only' && (
                    <span className="text-slate-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Results confidential (admin only)
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Rating Type */}
            {poll.voting_type === 'rating' ? (
              <div className="p-6 bg-slate-950/70 border border-slate-800 rounded-xl text-center space-y-4">
                <div className="text-4xl font-black text-blue-400 font-mono">{ratingValue} / 10</div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={ratingValue}
                  onChange={(e) => setRatingValue(Number(e.target.value))}
                  className="w-full accent-blue-600 h-2 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-slate-500 font-bold px-1">
                  <span>1 (Lowest)</span>
                  <span>5 (Neutral)</span>
                  <span>10 (Highest)</span>
                </div>
              </div>
            ) : (
              /* Single Choice / Multiple Choice / Yes-No */
              <div className="space-y-2.5">
                {poll.options.map((opt) => {
                  const isSelected = selectedOptionIds.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleOptionToggle(opt.id)}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                        isSelected
                          ? 'border-blue-500 bg-blue-600/15 shadow-sm shadow-blue-500/20 text-white font-semibold'
                          : 'border-slate-800 bg-slate-950/60 text-slate-200 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <span className="text-sm">{opt.text}</span>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-700 bg-slate-900'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-4 font-bold tracking-wide shadow-lg shadow-blue-500/25"
              disabled={poll.voting_type !== 'rating' && selectedOptionIds.length === 0}
              onClick={() => setIsConfirmModalOpen(true)}
            >
              Submit My Vote
            </Button>
          </div>
        )}

        {/* READ-ONLY OPTIONS WITH CONFIDENTIAL/PENDING CALLOUT (When results are NOT visible to employee) */}
        {(hasVoted || isClosed) && !canViewResults && (
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ballot Options ({poll.options.length}):
              </span>
              <Badge variant={hasVoted ? 'emerald' : 'amber'}>
                {hasVoted ? 'Submitted' : 'Voting Closed'}
              </Badge>
            </div>

            <div className="space-y-2.5">
              {poll.options.map((opt) => {
                const isMyChoice = (poll.my_selections || []).includes(opt.id) || selectedOptionIds.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    className={`w-full p-4 rounded-xl border flex items-center justify-between transition-colors ${
                      isMyChoice
                        ? 'border-blue-500/60 bg-blue-500/15 text-white shadow-sm shadow-blue-500/10'
                        : 'border-slate-800 bg-slate-950/50 text-slate-300'
                    }`}
                  >
                    <span className="text-sm font-medium">{opt.text}</span>
                    {isMyChoice ? (
                      <span className="flex items-center gap-1.5 text-xs text-blue-300 font-semibold bg-blue-500/20 px-2.5 py-1 rounded-md border border-blue-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
                        Your Vote
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">Ballot Choice</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Notice why results are not shown */}
            {poll.results_visibility === 'admin_only' && (
              <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl flex items-center gap-3 text-xs text-slate-400">
                <Lock className="w-4 h-4 text-slate-500 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-300">Confidential Ballot Results</span>
                  <p className="text-slate-400 mt-0.5">
                    As per administrator poll settings, results are confidential and restricted to admin review only.
                  </p>
                </div>
              </div>
            )}

            {poll.results_visibility === 'after_closing' && !isClosed && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center gap-3 text-xs text-blue-300">
                <Clock className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <span className="font-semibold text-white">Results Pending Poll Conclusion</span>
                  <p className="text-slate-300 mt-0.5">
                    Results are hidden while voting is underway. The official results will be revealed automatically once this poll closes on <strong className="text-blue-200">{formatIndiaDateTime(poll.end_datetime, true)}</strong>.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confidential Anonymous Guarantee Note */}
        {poll.anonymous_voting && (
          <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-2.5 text-xs text-purple-300">
            <ShieldCheck className="w-4 h-4 shrink-0 text-purple-400" />
            <span>Anonymous Voting Enabled: Your response is encrypted and completely dissociated from your employee profile.</span>
          </div>
        )}
      </Card>

      {/* COMMENTS SECTION */}
      {poll.allow_comments && (
        <Card className="p-6 space-y-4 border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-400" />
              <span>Discussion & Feedback ({comments.length})</span>
            </h3>
          </div>

          {/* New Comment Input */}
          <form onSubmit={handleAddComment} className="space-y-3">
            <textarea
              rows={2}
              placeholder="Share your perspective or thoughts on this topic..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isAnonComment}
                  onChange={(e) => setIsAnonComment(e.target.checked)}
                  className="rounded border-slate-700 text-blue-600 focus:ring-0"
                />
                <span>Post anonymously</span>
              </label>
              <Button type="submit" size="sm" isLoading={commentLoading} disabled={!newComment.trim()}>
                <Send className="w-3.5 h-3.5 mr-1" />
                Post
              </Button>
            </div>
          </form>

          {/* Comments List */}
          <div className="divide-y divide-slate-800/80 pt-2">
            {comments.map((c) => (
              <div key={c.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200">
                    {c.author_name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {formatIndiaDateTime(c.created_at)}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{c.comment}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        title="Confirm Vote Submission"
        description="Please confirm your selection"
      >
        <div className="space-y-4 text-sm text-slate-300">
          <p>
            Are you sure you want to submit your vote for:
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg font-bold text-white">
            {poll.title}
          </div>
          <p className="text-xs text-slate-400">
            Note: You can only vote once per poll. Once confirmed, your ballot cannot be altered.
          </p>
          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <Button variant="outline" onClick={() => setIsConfirmModalOpen(false)}>
              Review Choice
            </Button>
            <Button onClick={handleVoteSubmit} isLoading={voteLoading}>
              Confirm & Submit
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
