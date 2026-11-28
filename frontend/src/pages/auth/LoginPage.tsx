import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Input, Card } from '../../components/ui';
import {
  Vote, UserCheck, ArrowRight, CheckCircle2, AlertCircle, RefreshCw
} from 'lucide-react';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { loginEmployee, verifyEmployeeOtp } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Single Portal Form
  const [employeeName, setEmployeeName] = useState('');
  const [employeeMobile, setEmployeeMobile] = useState('');
  const [otpStep, setOtpStep] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const handleEmployeeMobileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 10);
    setEmployeeMobile(digitsOnly);
  };

  // Unified Portal Login Submission
  const handlePortalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const digits = employeeMobile.replace(/\D/g, '');
    if (!employeeName.trim()) {
      setError('Please enter your Full Name or Employee ID.');
      return;
    }
    if (!digits) {
      setError('Please enter your 10-digit registered mobile number.');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(digits)) {
      setError('Please enter a valid 10-digit mobile number (starts with 6, 7, 8, or 9).');
      return;
    }

    setLoading(true);
    try {
      const finalMobile = `+91${digits}`;
      const res = await loginEmployee({
        full_name: employeeName.trim(),
        mobile_number: finalMobile,
      });

      // Direct login when OTP is disabled: route based on resolved role
      if (res.access) {
        if (res.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/employee');
        }
        return;
      }

      // If OTP required (when enabled)
      setOtpStep(true);
      setSuccessMsg(res.message);
      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtpValue(res.dev_otp);
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
      setError(err.response?.data?.error || 'Authentication failed. Please verify your details.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res: any = await verifyEmployeeOtp({
        mobile_number: employeeMobile,
        otp: otpValue,
      });
      if (res?.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/employee');
      }
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
          {/* Header Title */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-3">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Employee Portal</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Portal Identification</h2>
            <p className="text-xs text-slate-400 mt-1">Enter your registered details to access the portal</p>
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

          {/* Form */}
          {!otpStep ? (
            <form onSubmit={handlePortalLogin} className="space-y-4">
              <Input
                label="Full Name or Employee ID"
                placeholder="e.g. HR or Employee ID"
                value={employeeName}
                onChange={(e) => setEmployeeName(e.target.value)}
                required
              />

              <Input
                label="Registered Mobile Number"
                placeholder="e.g. 9876543210 (10 digits)"
                value={employeeMobile}
                onChange={handleEmployeeMobileChange}
                maxLength={10}
                helperText="Enter your 10-digit registered mobile number."
                required
              />

              <Button type="submit" className="w-full mt-2" size="lg" isLoading={loading}>
                <span>Sign In to Portal</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>

              <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 text-center">
                <p className="text-slate-400">
                  Access is automatically routed based on your authorized credentials.
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
                  onClick={handlePortalLogin}
                  className="text-blue-400 hover:text-blue-300 disabled:text-slate-600 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-8 text-center text-xs text-slate-500 relative z-10">
        <p>&copy; {new Date().getFullYear()} SG ONE System. Internal Enterprise Deployment.</p>
      </footer>
    </div>
  );
};
