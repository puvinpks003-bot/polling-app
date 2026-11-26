import axios from 'axios';
import {
  AdminUser, Employee, Department, PollCategory, Poll,
  PollResults, PollComment, Notification, AuditLog,
  DashboardAnalytics
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to append JWT token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('cp_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle session expiration
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('cp_access_token');
      localStorage.removeItem('cp_refresh_token');
      localStorage.removeItem('cp_user_role');
      localStorage.removeItem('cp_user_data');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth Services
export const authApi = {
  adminLogin: async (data: { username: string; password: string }) => {
    const res = await apiClient.post('/auth/admin/login/', data);
    return res.data;
  },
  employeeRequestOtp: async (data: { full_name: string; mobile_number: string }) => {
    const res = await apiClient.post('/auth/employee/request-otp/', data);
    return res.data;
  },
  employeeVerifyOtp: async (data: { mobile_number: string; otp: string }) => {
    const res = await apiClient.post('/auth/employee/verify-otp/', data);
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me/');
    return res.data;
  },
};

// Employee Management Services
export const employeeApi = {
  list: async (params?: { department?: number | string; is_active?: boolean | string; search?: string }) => {
    const res = await apiClient.get<Employee[] | { results: Employee[] }>('/employees/', { params });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  get: async (id: number) => {
    const res = await apiClient.get<Employee>(`/employees/${id}/`);
    return res.data;
  },
  create: async (data: Partial<Employee>) => {
    const res = await apiClient.post<Employee>('/employees/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Employee>) => {
    const res = await apiClient.put<Employee>(`/employees/${id}/`, data);
    return res.data;
  },
  toggleStatus: async (id: number, is_active?: boolean) => {
    const res = await apiClient.patch<Employee>(`/employees/${id}/status/`, { is_active });
    return res.data;
  },
  delete: async (id: number) => {
    const res = await apiClient.delete(`/employees/${id}/`);
    return res.data;
  },
  bulkImport: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{ message: string; created_count: number; errors: string[] }>('/employees/bulk-import/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  getExportUrl: () => `${API_BASE}/employees/export/`,
};

// Department Services
export const departmentApi = {
  list: async () => {
    const res = await apiClient.get<Department[] | { results: Department[] }>('/departments/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  create: async (data: Partial<Department>) => {
    const res = await apiClient.post<Department>('/departments/', data);
    return res.data;
  },
  update: async (id: number, data: Partial<Department>) => {
    const res = await apiClient.put<Department>(`/departments/${id}/`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await apiClient.delete(`/departments/${id}/`);
    return res.data;
  },
};

// Category Services
export const categoryApi = {
  list: async () => {
    const res = await apiClient.get<PollCategory[] | { results: PollCategory[] }>('/categories/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  create: async (data: Partial<PollCategory>) => {
    const res = await apiClient.post<PollCategory>('/categories/', data);
    return res.data;
  },
};

// Poll Services
export const pollApi = {
  list: async (params?: { status?: string; category?: number | string; search?: string; filter?: string }) => {
    const res = await apiClient.get<Poll[] | { results: Poll[] }>('/polls/', { params });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  get: async (id: number) => {
    const res = await apiClient.get<Poll>(`/polls/${id}/`);
    return res.data;
  },
  create: async (data: any) => {
    const res = await apiClient.post<Poll>('/polls/', data);
    return res.data;
  },
  update: async (id: number, data: any) => {
    const res = await apiClient.put<Poll>(`/polls/${id}/`, data);
    return res.data;
  },
  delete: async (id: number) => {
    const res = await apiClient.delete(`/polls/${id}/`);
    return res.data;
  },
  publish: async (id: number) => {
    const res = await apiClient.post<Poll>(`/polls/${id}/publish/`);
    return res.data;
  },
  close: async (id: number) => {
    const res = await apiClient.post<Poll>(`/polls/${id}/close/`);
    return res.data;
  },
  reopen: async (id: number, end_datetime?: string) => {
    const res = await apiClient.post<Poll>(`/polls/${id}/reopen/`, { end_datetime });
    return res.data;
  },
  duplicate: async (id: number) => {
    const res = await apiClient.post<Poll>(`/polls/${id}/duplicate/`);
    return res.data;
  },
  resetVote: async (id: number, employeeId: number) => {
    const res = await apiClient.post<{ message: string; employee_id: number; deleted_count: number }>(`/polls/${id}/reset-vote/`, { employee_id: employeeId });
    return res.data;
  },
  vote: async (id: number, payload: { option_ids?: number[]; option_id?: number; rating_value?: number }) => {
    const res = await apiClient.post(`/polls/${id}/vote/`, payload);
    return res.data;
  },
  getResults: async (id: number) => {
    const res = await apiClient.get<PollResults>(`/polls/${id}/results/`);
    return res.data;
  },
  getVotingHistory: async () => {
    const res = await apiClient.get<Poll[]>('/voting/history/');
    return res.data;
  },
};

// Comment Services
export const commentApi = {
  list: async (pollId: number) => {
    const res = await apiClient.get<PollComment[] | { results: PollComment[] }>('/comments/', { params: { poll: pollId } });
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  create: async (data: { poll: number; comment: string; is_anonymous?: boolean }) => {
    const res = await apiClient.post<PollComment>('/comments/', data);
    return res.data;
  },
};

// Analytics Services
export const analyticsApi = {
  getDashboard: async () => {
    const res = await apiClient.get<DashboardAnalytics>('/analytics/dashboard/');
    return res.data;
  },
  getReportExportUrl: (pollId?: number, format: 'excel' | 'pdf' = 'excel') => {
    const token = localStorage.getItem('cp_access_token') || '';
    const params = new URLSearchParams();
    if (pollId) params.append('poll_id', String(pollId));
    if (format) params.append('format', format);
    if (token) params.append('token', token);
    return `${API_BASE}/reports/export/?${params.toString()}`;
  },
  downloadReport: async (pollId?: number, format: 'excel' | 'pdf' = 'excel') => {
    const params: Record<string, any> = { format };
    if (pollId) params.poll_id = pollId;
    const res = await apiClient.get('/reports/export/', {
      params,
      responseType: 'blob',
    });
    const extension = format === 'pdf' ? 'pdf' : 'xlsx';
    const defaultFilename = pollId
      ? `Poll_${pollId}_Report.${extension}`
      : `SG_ONE_System_Report.${extension}`;

    const blob = new Blob([res.data], {
      type: format === 'pdf'
        ? 'application/pdf'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

// Notification Services
export const notificationApi = {
  list: async () => {
    const res = await apiClient.get<Notification[] | { results: Notification[] }>('/notifications/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
  markRead: async (id: number) => {
    const res = await apiClient.post(`/notifications/${id}/mark_read/`);
    return res.data;
  },
  markAllRead: async () => {
    const res = await apiClient.post('/notifications/mark-all-read/');
    return res.data;
  },
};

// Audit Log Services
export const auditLogApi = {
  list: async () => {
    const res = await apiClient.get<AuditLog[] | { results: AuditLog[] }>('/audit-logs/');
    return Array.isArray(res.data) ? res.data : (res.data.results || []);
  },
};
