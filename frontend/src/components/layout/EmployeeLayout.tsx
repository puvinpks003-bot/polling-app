import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { notificationApi } from '../../lib/api';
import {
  Vote, History, Bell, User, LogOut,
  Sparkles, CheckCircle2
} from 'lucide-react';

export const EmployeeLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    notificationApi.list().then(items => {
      setUnreadCount(items.filter(n => !n.is_read).length);
    }).catch(() => {});
  }, []);

  const employee = user as any;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 border-b border-slate-800/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo & Greeting */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-bold text-white shadow-md shadow-blue-500/20">
              <Vote className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">SG ONE</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> Active Voter
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                {employee?.department || 'Employee'} • ID: {employee?.employee_id}
              </p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink
              to="/employee"
              end
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              Active Polls
            </NavLink>
            <NavLink
              to="/employee/history"
              className={({ isActive }) =>
                `px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              Voting History
            </NavLink>
            <NavLink
              to="/employee/notifications"
              className={({ isActive }) =>
                `relative px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  isActive ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <Bell className="w-4 h-4" />
              <span>Notifications</span>
              {unreadCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-blue-500" />
              )}
            </NavLink>
          </nav>

          {/* User profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-slate-200">{employee?.full_name}</p>
              <p className="text-[11px] text-slate-400">{employee?.mobile_number}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 pb-20 md:pb-8">
        <Outlet />
      </main>

      {/* Bottom Navigation for Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 border-t border-slate-800 backdrop-blur-md px-6 py-2 flex items-center justify-around">
        <NavLink
          to="/employee"
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs py-1 ${isActive ? 'text-blue-400 font-semibold' : 'text-slate-400'}`
          }
        >
          <Vote className="w-5 h-5" />
          <span>Polls</span>
        </NavLink>
        <NavLink
          to="/employee/history"
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs py-1 ${isActive ? 'text-blue-400 font-semibold' : 'text-slate-400'}`
          }
        >
          <History className="w-5 h-5" />
          <span>History</span>
        </NavLink>
        <NavLink
          to="/employee/notifications"
          className={({ isActive }) =>
            `relative flex flex-col items-center gap-1 text-xs py-1 ${isActive ? 'text-blue-400 font-semibold' : 'text-slate-400'}`
          }
        >
          <Bell className="w-5 h-5" />
          <span>Alerts</span>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-blue-500" />
          )}
        </NavLink>
      </div>
    </div>
  );
};
