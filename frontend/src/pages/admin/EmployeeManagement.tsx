import React, { useState, useEffect } from 'react';
import { employeeApi, departmentApi } from '../../lib/api';
import { formatIndiaDate, getKolkataDateInputString } from '../../lib/date';
import { Employee, Department } from '../../types';
import { Button, Input, Card, Badge, Modal, Skeleton, ConfirmModal, DepartmentCombobox } from '../../components/ui';
import {
  Users, UserPlus, FileSpreadsheet, Upload, Download,
  Search, Filter, CheckCircle2, XCircle, Edit, Trash2,
  Phone, Mail, Building, Briefcase, Calendar, AlertCircle
} from 'lucide-react';

export const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{ message: string; created_count: number; errors: string[] } | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form Fields
  const [formData, setFormData] = useState({
    employee_id: '',
    full_name: '',
    mobile_number: '',
    email: '',
    department: '',
    designation: '',
    joining_date: getKolkataDateInputString(),
    is_active: true,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.allSettled([
        employeeApi.list({
          search: search || undefined,
          department: selectedDept || undefined,
          is_active: selectedStatus !== '' ? selectedStatus : undefined,
        }),
        departmentApi.list(),
      ]);
      if (empRes.status === 'fulfilled') {
        setEmployees(empRes.value);
      }
      if (deptRes.status === 'fulfilled') {
        setDepartments(deptRes.value);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDept, selectedStatus]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenAdd = () => {
    setFormData({
      employee_id: `EMP${Math.floor(100 + Math.random() * 900)}`,
      full_name: '',
      mobile_number: '+91',
      email: '',
      department: departments[0]?.id ? String(departments[0].id) : '',
      designation: '',
      joining_date: getKolkataDateInputString(),
      is_active: true,
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setSelectedEmployee(emp);
    setFormData({
      employee_id: emp.employee_id,
      full_name: emp.full_name,
      mobile_number: emp.mobile_number,
      email: emp.email || '',
      department: emp.department ? String(emp.department) : '',
      designation: emp.designation || '',
      joining_date: emp.joining_date || getKolkataDateInputString(),
      is_active: emp.is_active,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  const handleCreateDepartment = async (newDeptName: string) => {
    try {
      const created = await departmentApi.create({ name: newDeptName });
      setDepartments((prev) => {
        if (prev.some((d) => d.id === created.id)) return prev;
        return [...prev, created];
      });
      setFormData((prev) => ({ ...prev, department: String(created.id) }));
      return created;
    } catch (err: any) {
      console.error('Failed to create department:', err);
      throw err;
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);

    try {
      const payload: any = {
        ...formData,
        email: formData.email && formData.email.trim() ? formData.email.trim() : null,
        department: formData.department ? Number(formData.department) : null,
      };

      if (isEditModalOpen && selectedEmployee) {
        await employeeApi.update(selectedEmployee.id, payload);
        setIsEditModalOpen(false);
      } else {
        await employeeApi.create(payload);
        setIsAddModalOpen(false);
      }
      loadData();
    } catch (err: any) {
      const msg = err.response?.data?.employee_id?.[0] ||
        err.response?.data?.mobile_number?.[0] ||
        err.response?.data?.email?.[0] ||
        err.response?.data?.error ||
        'Failed to save employee. Please check inputs.';
      setFormError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async (emp: Employee) => {
    try {
      await employeeApi.toggleStatus(emp.id, !emp.is_active);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    setActionLoading(true);
    try {
      await employeeApi.delete(selectedEmployee.id);
      setIsDeleteModalOpen(false);
      setSelectedEmployee(null);
      loadData();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to delete employee.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;
    setActionLoading(true);
    setImportResult(null);
    try {
      const res = await employeeApi.bulkImport(importFile);
      setImportResult(res);
      loadData();
    } catch (err: any) {
      setImportResult({
        message: 'Import failed',
        created_count: 0,
        errors: [err.response?.data?.error || 'Could not parse spreadsheet.'],
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Employee Management</h1>
          <p className="text-sm text-slate-400">Register, manage, and verify company employee voting credentials</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button onClick={handleOpenAdd} className="gap-2">
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </Button>
          <Button variant="secondary" onClick={() => { setImportResult(null); setImportFile(null); setIsImportModalOpen(true); }} className="gap-2">
            <Upload className="w-4 h-4 text-blue-400" />
            <span>Bulk Excel Import</span>
          </Button>
          <a
            href={employeeApi.getExportUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Excel</span>
          </a>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by name, employee ID, phone or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="w-full md:w-48 px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full md:w-40 px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="true">Active Only</option>
            <option value="false">Inactive Only</option>
          </select>
          <Button type="submit" variant="secondary" size="md">
            Filter
          </Button>
        </form>
      </Card>

      {/* Employee Table */}
      <Card className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
            <p className="text-base font-semibold text-slate-300">No employees found</p>
            <p className="text-xs text-slate-500 mt-1">Add your first employee to get started with polling.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-950/80 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Employee ID</th>
                  <th className="px-5 py-3.5">Full Name</th>
                  <th className="px-5 py-3.5">Mobile Number</th>
                  <th className="px-5 py-3.5">Department</th>
                  <th className="px-5 py-3.5">Designation</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-xs font-semibold text-blue-400">
                      {emp.employee_id}
                    </td>
                    <td className="px-5 py-3.5 font-medium text-white">
                      {emp.full_name}
                      {emp.email && <span className="block text-xs text-slate-500">{emp.email}</span>}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                      {emp.mobile_number}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-300">
                      {emp.department_name || '—'}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-400">
                      {emp.designation || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        onClick={() => handleToggleStatus(emp)}
                        className="cursor-pointer transition-transform active:scale-95"
                        title="Click to toggle status"
                      >
                        <Badge variant={emp.is_active ? 'emerald' : 'rose'}>
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </button>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedEmployee(emp); setIsViewModalOpen(true); }}
                        >
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(emp)}
                          className="text-blue-400 hover:text-blue-300"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setSelectedEmployee(emp); setIsDeleteModalOpen(true); }}
                          className="text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add / Edit Employee Modal */}
      <Modal
        isOpen={isAddModalOpen || isEditModalOpen}
        onClose={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
        title={isEditModalOpen ? `Edit Employee (${formData.employee_id})` : 'Register New Employee'}
        description="Employees can access polls only after registration with authorized mobile number"
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Employee ID (Unique)"
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              required
              disabled={isEditModalOpen}
            />
            <Input
              label="Full Name"
              placeholder="e.g. Rahul Sharma"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Mobile Number (E.164)"
              placeholder="+919876543210"
              value={formData.mobile_number}
              onChange={(e) => {
                const raw = e.target.value;
                if (!raw || raw === '+' || raw === '+9') {
                  setFormData({ ...formData, mobile_number: '+91' });
                  return;
                }
                if (!raw.startsWith('+')) {
                  const digits = raw.replace(/\D/g, '');
                  if (digits.startsWith('91') && digits.length > 10) {
                    setFormData({ ...formData, mobile_number: `+${digits}` });
                  } else {
                    setFormData({ ...formData, mobile_number: `+91${digits}` });
                  }
                  return;
                }
                const prefix = raw.startsWith('+91') ? '+91' : '+';
                const rest = raw.slice(prefix.length).replace(/\D/g, '');
                setFormData({ ...formData, mobile_number: `${prefix}${rest}` });
              }}
              onFocus={(e) => {
                if (e.target.value === '+91') {
                  const len = e.target.value.length;
                  e.target.setSelectionRange(len, len);
                }
              }}
              helperText="Used for OTP verification (+91 pre-filled)"
              required
            />
            <Input
              label="Email Address (Optional)"
              type="email"
              placeholder="rahul@company.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Department
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  Search or create new
                </span>
              </div>
              <DepartmentCombobox
                departments={departments}
                selectedDepartmentId={formData.department}
                onSelectDepartment={(id) => setFormData({ ...formData, department: String(id) })}
                onCreateDepartment={handleCreateDepartment}
              />
            </div>
            <Input
              label="Designation"
              placeholder="e.g. Senior Software Engineer"
              value={formData.designation}
              onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Joining Date"
              type="date"
              value={formData.joining_date}
              onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Account Status</label>
              <select
                value={formData.is_active ? 'true' : 'false'}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.value === 'true' })}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                <option value="true">Active (Can Login & Vote)</option>
                <option value="false">Inactive (Suspended)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); }}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={actionLoading}>
              {isEditModalOpen ? 'Save Changes' : 'Register Employee'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Employee Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title="Employee Profile Details"
        description="Registered voter record in SG ONE"
      >
        {selectedEmployee && (
          <div className="space-y-4 text-sm">
            <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-base font-bold text-white">{selectedEmployee.full_name}</h4>
                <p className="text-xs text-blue-400 font-mono mt-0.5">ID: {selectedEmployee.employee_id}</p>
              </div>
              <Badge variant={selectedEmployee.is_active ? 'emerald' : 'rose'}>
                {selectedEmployee.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Mobile Number (Registered)</span>
                <span className="text-slate-200 font-mono font-semibold">{selectedEmployee.mobile_number}</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Email Address</span>
                <span className="text-slate-200">{selectedEmployee.email || '—'}</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Department</span>
                <span className="text-slate-200">{selectedEmployee.department_name || '—'}</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Joining Date</span>
                <span className="text-slate-200 font-mono">{formatIndiaDate(selectedEmployee.joining_date)}</span>
              </div>
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80">
                <span className="text-slate-500 block mb-1">Designation</span>
                <span className="text-slate-200">{selectedEmployee.designation || '—'}</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="outline" onClick={() => setIsViewModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Bulk Excel Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Bulk Import Employees via Excel"
        description="Upload an .xlsx file with employee records"
      >
        <form onSubmit={handleBulkImport} className="space-y-4">
          <div className="p-4 bg-slate-950/80 rounded-xl border border-dashed border-slate-700 text-center">
            <Upload className="w-8 h-8 mx-auto text-blue-400 mb-2" />
            <p className="text-xs text-slate-300 font-medium">Choose Excel (.xlsx) file</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Columns: employee_id, full_name, mobile_number, email, department, designation
            </p>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="mt-3 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>

          {importResult && (
            <div className={`p-3 rounded-lg text-xs ${importResult.created_count > 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'}`}>
              <p className="font-semibold">{importResult.message}</p>
              {importResult.errors.length > 0 && (
                <ul className="mt-2 list-disc list-inside space-y-0.5 text-[11px] text-rose-400">
                  {importResult.errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsImportModalOpen(false)}>
              Close
            </Button>
            <Button type="submit" disabled={!importFile} isLoading={actionLoading}>
              Process Import
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        title="Confirm Employee Deletion"
        description="Are you sure you want to remove this employee from SG ONE?"
        confirmText="Delete Employee"
        variant="danger"
        itemName={selectedEmployee?.full_name}
        itemBadge={selectedEmployee?.employee_id}
        infoCallout="Notice: This employee will no longer be able to log in or access internal company polls."
        isLoading={actionLoading}
      />
    </div>
  );
};
