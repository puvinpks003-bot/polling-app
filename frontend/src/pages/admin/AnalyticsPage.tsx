import React, { useEffect, useState } from 'react';
import { analyticsApi, pollApi } from '../../lib/api';
import { DashboardAnalytics, Poll } from '../../types';
import { Card, Badge, Skeleton } from '../../components/ui';
import {
  TrendingUp, Users, Vote, CheckCircle2,
  PieChart as PieIcon, BarChart2, ShieldCheck
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid
} from 'recharts';

export const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.getDashboard().then(res => setData(res)).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Skeleton className="h-96 w-full" />;
  }

  if (!data) return null;

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Organizational Polling Analytics</h1>
        <p className="text-sm text-slate-400">Deep engagement metrics, turnout patterns, and survey participation trends</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card className="p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Overall Engagement</p>
          <p className="text-3xl font-extrabold text-blue-400 mt-1">{data.overall_participation}%</p>
          <p className="text-xs text-slate-500 mt-1">Average voter turnout across all company departments</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total Ballots Cast</p>
          <p className="text-3xl font-extrabold text-white mt-1">{data.total_votes}</p>
          <p className="text-xs text-slate-500 mt-1">Both regular and anonymous votes recorded</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Active Polling Campaigns</p>
          <p className="text-3xl font-extrabold text-emerald-400 mt-1">{data.active_polls}</p>
          <p className="text-xs text-slate-500 mt-1">{data.closed_polls} completed surveys archived</p>
        </Card>
      </div>

      {/* Participation by Department */}
      <Card className="p-6">
        <h3 className="text-base font-bold text-white mb-2">Department Participation Rates</h3>
        <p className="text-xs text-slate-400 mb-4">Total ballots submitted per registered organizational unit</p>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.department_analytics}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', color: '#fff' }} />
              <Bar dataKey="vote_count" fill="#3b82f6" name="Total Votes" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
};
