import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../lib/api';
import { AdminUser, Employee, UserRole } from '../types';

interface AuthContextType {
  user: AdminUser | Employee | null;
  role: UserRole | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginAdmin: (credentials: { username: string; password: string }) => Promise<void>;
  loginEmployee: (data: { full_name: string; mobile_number: string }) => Promise<any>;
  requestEmployeeOtp: (data: { full_name: string; mobile_number: string }) => Promise<any>;
  verifyEmployeeOtp: (data: { mobile_number: string; otp: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cp_access_token'));
  const [role, setRole] = useState<UserRole | null>(() => (localStorage.getItem('cp_user_role') as UserRole) || null);
  const [user, setUser] = useState<AdminUser | Employee | null>(() => {
    const raw = localStorage.getItem('cp_user_data');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const syncSessionWithServer = async () => {
      const storedToken = localStorage.getItem('cp_access_token');
      if (!storedToken) return;

      try {
        const res = await authApi.getMe();
        if (res.role === 'admin') {
          setUser(res.user);
          setRole('admin');
          localStorage.setItem('cp_user_data', JSON.stringify(res.user));
        } else if (res.role === 'employee') {
          setUser(res.employee);
          setRole('employee');
          localStorage.setItem('cp_user_data', JSON.stringify(res.employee));
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          localStorage.removeItem('cp_access_token');
          localStorage.removeItem('cp_refresh_token');
          localStorage.removeItem('cp_user_role');
          localStorage.removeItem('cp_user_data');
          setUser(null);
          setRole(null);
          setToken(null);
        }
      }
    };

    syncSessionWithServer();
  }, []);

  const loginAdmin = async (credentials: { username: string; password: string }) => {
    const data = await authApi.adminLogin(credentials);
    localStorage.setItem('cp_access_token', data.access);
    localStorage.setItem('cp_refresh_token', data.refresh);
    localStorage.setItem('cp_user_role', 'admin');
    localStorage.setItem('cp_user_data', JSON.stringify(data.user));
    setToken(data.access);
    setRole('admin');
    setUser(data.user);
  };

  const requestEmployeeOtp = async (data: { full_name: string; mobile_number: string }) => {
    const res = await authApi.employeeRequestOtp(data);
    if (res.access) {
      localStorage.setItem('cp_access_token', res.access);
      localStorage.setItem('cp_refresh_token', res.refresh);
      localStorage.setItem('cp_user_role', 'employee');
      localStorage.setItem('cp_user_data', JSON.stringify(res.employee));
      setToken(res.access);
      setRole('employee');
      setUser(res.employee);
    }
    return res;
  };

  const loginEmployee = async (data: { full_name: string; mobile_number: string }) => {
    return await requestEmployeeOtp(data);
  };

  const verifyEmployeeOtp = async (data: { mobile_number: string; otp: string }) => {
    const res = await authApi.employeeVerifyOtp(data);
    localStorage.setItem('cp_access_token', res.access);
    localStorage.setItem('cp_refresh_token', res.refresh);
    localStorage.setItem('cp_user_role', 'employee');
    localStorage.setItem('cp_user_data', JSON.stringify(res.employee));
    setToken(res.access);
    setRole('employee');
    setUser(res.employee);
  };

  const logout = () => {
    localStorage.removeItem('cp_access_token');
    localStorage.removeItem('cp_refresh_token');
    localStorage.removeItem('cp_user_role');
    localStorage.removeItem('cp_user_data');
    setToken(null);
    setRole(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        loginAdmin,
        loginEmployee,
        requestEmployeeOtp,
        verifyEmployeeOtp,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
