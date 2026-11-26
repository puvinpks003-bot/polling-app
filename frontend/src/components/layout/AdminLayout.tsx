import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../lib/api';
import {
  LayoutDashboard, Users, Building2, Vote, PlusCircle,
  BarChart3, LineChart, Bell, FileSpreadsheet, Settings,
  LogOut, Menu, X, ShieldCheck, ChevronRight
} from 'lucide-react';

export const AdminLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationApi.list().then(items => {
      setUnreadCount(items.filter(n => !n.is_read).length);
    }).catch(() => {});
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard },
    { name: 'Employee Management', path: '/admin/employees', icon: Users },
    { name: 'Department Management', path: '/admin/departments', icon: Building2 },
    { name: 'Poll Management', path: '/admin/polls', icon: Vote },
    { name: 'Create Poll', path: '/admin/polls/create', icon: PlusCircle },
    { name: 'Voting Results', path: '/admin/results', icon: BarChart3 },
    { name: 'Analytics', path: '/admin/analytics', icon: LineChart },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell, badge: unreadCount },
    { name: 'Reports', path: '/admin/reports', icon: FileSpreadsheet },
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/30">
            SG
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white">SG ONE</h1>
            <p className="text-[10px] text-blue-400 font-medium">Admin Portal</p>
          </div>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar for Desktop & Mobile Overlay */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 border-r border-slate-800/80 flex flex-col transition-transform duration-200 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center font-extrabold text-white shadow-lg shadow-blue-500/20">
            SG
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-white">SG ONE</span>
              <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[10px] font-semibold rounded">PRO</span>
            </div>
            <p className="text-xs text-slate-400">Admin Control Center</p>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/admin'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                  }`
                }
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </div>
                {item.badge && item.badge > 0 ? (
                  <span className="px-1.5 py-0.5 text-xs font-bold bg-blue-400 text-slate-950 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>

        {/* User Footer & Logout */}
        <div className="p-4 border-t border-slate-800/80 bg-slate-950/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-slate-200 truncate">{(user as any)?.full_name || 'Administrator'}</p>
                <p className="text-[11px] text-slate-500 truncate">{(user as any)?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-slate-950 overflow-y-auto">
        {/* Top bar on desktop */}
        <div className="hidden md:flex items-center justify-between px-8 py-4 border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>SG ONE</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-blue-400 font-medium">Enterprise Management</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/admin/polls/create')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm shadow-blue-500/20 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Create Poll
            </button>
            <button
              onClick={() => navigate('/admin/notifications')}
              className="relative p-2 rounded-lg bg-slate-800/70 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {/* Child Views */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
