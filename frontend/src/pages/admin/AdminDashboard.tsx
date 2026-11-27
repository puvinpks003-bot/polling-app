import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyticsApi, pollApi } from '../../lib/api';
import { DashboardAnalytics, Poll } from '../../types';
import { Card, Badge, Button, Skeleton } from '../../components/ui';
import {
  Users, UserCheck, Vote, CheckCircle2, XCircle,
  TrendingUp, BarChart2, PlusCircle, FileSpreadsheet,
  ArrowRight, ShieldAlert, Award
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';

export const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getDashboard()
      .then(res => setData(res))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (!data) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
  const activeCategories = (data.categories || []).filter(c => (c.count || 0) > 0);

  const stats = [
    { label: 'Total Employees', value: data.total_employees, icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Active Employees', value: data.active_employees, icon: UserCheck, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Inactive Employees', value: data.inactive_employees, icon: XCircle, color: 'text-slate-400', bg: 'bg-slate-500/10' },
    { label: 'Total Polls', value: data.total_polls, icon: Vote, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Active Polls', value: data.active_polls, icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Closed Polls', value: data.closed_polls, icon: BarChart2, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Total Votes Cast', value: data.total_votes, icon: Award, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    { label: 'Overall Participation', value: `${data.overall_participation}%`, icon: TrendingUp, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">System Dashboard</h1>
          <p className="text-sm text-slate-400">Real-time participation metrics and voting operations</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button onClick={() => navigate('/admin/polls/create')} size="md" className="gap-2">
            <PlusCircle className="w-4 h-4" />
            <span>Create Poll</span>
          </Button>
          <Button onClick={() => navigate('/admin/employees')} variant="secondary" size="md" className="gap-2">
            <Users className="w-4 h-4" />
            <span>Manage Employees</span>
          </Button>
          <a
            href={analyticsApi.getReportExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export Report</span>
          </a>
        </div>
      </div>

      {/* 8 Stats Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, idx) => {
          const Icon = s.icon;
          return (
            <Card key={idx} className="flex items-center gap-4 hover:border-slate-700 transition-colors">
              <div className={`p-3 rounded-xl ${s.bg} ${s.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight text-white mt-0.5">{s.value}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Interactive Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Participation Bar Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Department Participation</h3>
              <p className="text-xs text-slate-400">Total votes recorded per department</p>
            </div>
            <Badge variant="blue">Live Records</Badge>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.department_analytics}>
                <XAxis dataKey="code" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="vote_count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Votes Cast" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Distribution Pie Chart */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Polls by Category</h3>
              <p className="text-xs text-slate-400">Distribution of company survey topics</p>
            </div>
            <Badge variant="purple">Categories</Badge>
          </div>
          <div className="h-64 w-full">
            {activeCategories.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <span>No active poll categories yet</span>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activeCategories}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    label={({ percent }: any) => (percent >= 0.08 ? `${(percent * 100).toFixed(0)}%` : '')}
                    labelLine={false}
                  >
                    {activeCategories.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    formatter={(value: any, name: any) => {
                      const total = activeCategories.reduce((acc, curr) => acc + (curr.count || 0), 0);
                      const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                      return [`${value} polls (${pct}%)`, name];
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(value) => <span className="text-slate-300 font-medium">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* Recent Polls Monitor */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Recent Polls</h3>
            <p className="text-xs text-slate-400">Overview of recent polling activity</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/polls')} className="gap-1">
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="text-xs uppercase bg-slate-950/70 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Poll Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Votes</th>
                <th className="px-4 py-3">Participation</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {data.recent_polls.map((poll) => (
                <tr key={poll.id} className="hover:bg-slate-800/40 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-white max-w-xs truncate">
                    {poll.title}
                  </td>
                  <td className="px-4 py-3.5 capitalize text-xs text-slate-400">
                    {poll.voting_type.replace('_', ' ')}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge variant={poll.status === 'active' ? 'emerald' : poll.status === 'closed' ? 'amber' : 'slate'}>
                      {poll.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">
                    {poll.total_votes || 0}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${poll.participation_rate || 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-mono">{poll.participation_rate || 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigate(`/admin/results?poll_id=${poll.id}`)}
                    >
                      Results
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
