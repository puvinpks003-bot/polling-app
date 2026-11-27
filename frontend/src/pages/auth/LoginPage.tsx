import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Card, Badge, Modal } from '../../components/ui';
import {
  Vote, ShieldCheck, UserCheck, KeyRound, Phone,
  User, ArrowRight, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginAdmin, loginEmployee, requestEmployeeOtp, verifyEmployeeOtp } = useAuth();

  const [activeTab, setActiveTab] = useState<'employee' | 'admin'>('employee');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Admin form
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('Admin@123456');
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Employee form
  const [employeeName, setEmployeeName] = useState('');
  const [employeeMobile, setEmployeeMobile] = useState('+91');
  const [otpStep, setOtpStep] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleEmployeeMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw || raw === '+' || raw === '+9') {
      setEmployeeMobile('+91');
      return;
    }
    if (!raw.startsWith('+')) {
      const digitsOnly = raw.replace(/\D/g, '');
      if (digitsOnly.startsWith('91') && digitsOnly.length > 10) {
        setEmployeeMobile(`+${digitsOnly}`);
      } else {
        setEmployeeMobile(`+91${digitsOnly}`);
      }
      return;
    }
    const prefix = raw.startsWith('+91') ? '+91' : '+';
    const rest = raw.slice(prefix.length).replace(/\D/g, '');
    setEmployeeMobile(`${prefix}${rest}`);
  };

  // Admin Login Submission
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginAdmin({ username: adminUsername, password: adminPassword });
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid administrator credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Employee Login (Direct Employee Identification or OTP if re-enabled)
  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const trimmedMobile = employeeMobile.trim();
      const finalMobile = trimmedMobile.startsWith('+') ? trimmedMobile : `+91${trimmedMobile.replace(/\D/g, '')}`;
      const res = await loginEmployee({
        full_name: employeeName.trim(),
        mobile_number: finalMobile,
      });

      // Direct login when OTP is disabled
      if (res.access) {
        navigate('/employee');
        return;
      }

      // If OTP required (when re-enabled later)
      setOtpStep(true);
      setSuccessMsg(res.message);
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtpValue(res.dev_otp); // Auto-fill for convenience during review
      }
      setResendCooldown(60);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication failed. Please verify your employee details.');
    } finally {
      setLoading(false);
    }
  };

  // Employee Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await verifyEmployeeOtp({
        mobile_number: employeeMobile,
        otp: otpValue,
      });
      navigate('/employee');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Verification failed. Please re-check code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Brand Header */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 shadow-xl shadow-blue-500/25 mb-3 text-white">
          <Vote className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">SG ONE</h1>
        <p className="text-slate-400 text-sm mt-1">Enterprise Employee Polling & Voting Management</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md relative z-10">
        <Card className="border-slate-800/90 shadow-2xl p-6 sm:p-8 bg-slate-900/95 backdrop-blur-xl">
          {/* Visual Login Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('employee');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'employee'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Employee Portal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Admin Access</span>
            </button>
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: EMPLOYEE LOGIN */}
          {activeTab === 'employee' && (
            <div>
              {!otpStep ? (
                <form onSubmit={handleEmployeeLogin} className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-base font-semibold text-white">Employee Identification</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Enter your registered details to access the portal</p>
                  </div>

                  <Input
                    label="Full Name or Employee ID"
                    placeholder="e.g. Dinesh or EMP01"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    required
                  />

                  <Input
                    label="Registered Mobile Number (E.164)"
                    placeholder="+919876543210"
                    value={employeeMobile}
                    onChange={handleEmployeeMobileChange}
                    onFocus={(e) => {
                      if (e.target.value === '+91') {
                        const len = e.target.value.length;
                        e.target.setSelectionRange(len, len);
                      }
                    }}
                    helperText="+91 country code pre-filled. Enter your 10-digit mobile number."
                    required
                  />

                  <Button type="submit" className="w-full mt-2" size="lg" isLoading={loading}>
                    <span>Sign In to Employee Portal</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>

                  <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 text-center">
                    <p className="text-slate-400">
                      Employees must be registered by an administrator with their authorized name/ID and mobile number to access polls.
                    </p>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="text-center mb-4">
                    <h2 className="text-base font-semibold text-white">Enter Verification Code</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Code dispatched to <span className="text-blue-400 font-medium">{employeeMobile}</span>
                    </p>
                  </div>

                  {devOtp && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                      <span className="text-[11px] uppercase tracking-wider text-blue-300 font-bold block mb-1">
                        Development Testing OTP
                      </span>
                      <span className="text-2xl font-mono tracking-widest font-black text-blue-400 bg-slate-950/80 px-3 py-1 rounded border border-blue-500/20">
                        {devOtp}
                      </span>
                    </div>
                  )}

                  <Input
                    label="6-Digit OTP"
                    placeholder="••••••"
                    value={otpValue}
                    onChange={(e) => setOtpValue(e.target.value)}
                    maxLength={6}
                    className="text-center tracking-widest text-lg font-mono font-bold"
                    required
                  />

                  <Button type="submit" className="w-full mt-2" size="lg" isLoading={loading}>
                    Verify Code & Login
                  </Button>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setOtpStep(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      Change Details
                    </button>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || loading}
                      onClick={handleEmployeeLogin}
                      className="text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: ADMIN LOGIN */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="text-center mb-4">
                <h2 className="text-base font-semibold text-white">System Administrator</h2>
                <p className="text-xs text-slate-400 mt-0.5">Restricted portal for authorized management only</p>
              </div>

              <Input
                label="Admin Username or Email"
                placeholder="admin or admin@sgone.com"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="••••••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <Button type="submit" className="w-full" size="lg" isLoading={loading}>
                Access Management Console
              </Button>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Default Administrator Credentials:</p>
                <p>Username: <span className="text-blue-400 font-mono">admin</span></p>
                <p>Password: <span className="text-blue-400 font-mono">Admin@123456</span></p>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Admin Password Recovery"
        description="Secure password reset procedure"
      >
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            For enterprise security compliance, administrator credentials can only be reset by a root infrastructure operator or via the secure CLI command:
          </p>
          <div className="p-3 bg-slate-950 font-mono text-[11px] text-blue-300 rounded border border-slate-800">
            python manage.py setup_admin --password &lt;new_password&gt;
          </div>
          <p className="text-slate-400">
            Employees are strictly prohibited from self-elevating or registering as administrators.
          </p>
          <div className="pt-2 flex justify-end">
            <Button variant="outline" onClick={() => setShowForgotModal(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 relative z-10">
        <p>&copy; {new Date().getFullYear()} SG ONE System. Internal Enterprise Deployment.</p>
      </footer>
    </div>
  );
};
