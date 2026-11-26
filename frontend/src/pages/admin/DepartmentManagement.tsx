import React, { useState, useEffect } from 'react';
import { departmentApi } from '../../lib/api';
import { Department } from '../../types';
import { Button, Input, Card, Badge, Modal, Skeleton, ConfirmModal } from '../../components/ui';
import { Building2, Plus, Users, Edit, Trash2, Layers } from 'lucide-react';

export const DepartmentManagement: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deptToDelete, setDeptToDelete] = useState<Department | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const data = await departmentApi.list();
      setDepartments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleOpenAdd = () => {
    setEditingDept(null);
    setName('');
    setCode('');
    setDescription('');
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setCode(dept.code);
    setDescription(dept.description);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError(null);
    try {
      if (editingDept) {
        await departmentApi.update(editingDept.id, { name, code, description });
      } else {
        await departmentApi.create({ name, code, description });
      }
      setIsModalOpen(false);
      loadDepartments();
    } catch (err: any) {
      setError(err.response?.data?.name?.[0] || err.response?.data?.code?.[0] || 'Failed to save department.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deptToDelete) return;
    setDeleteLoading(true);
    try {
      await departmentApi.delete(deptToDelete.id);
      setDeptToDelete(null);
      loadDepartments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete department.');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">Department Management</h1>
          <p className="text-sm text-slate-400">Configure organizational departments and target audience segments</p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          <span>Add Department</span>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {departments.map((dept) => (
            <Card key={dept.id} className="flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="blue">{dept.code}</Badge>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    <span>{dept.employee_count || 0} Employees</span>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white">{dept.name}</h3>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                  {dept.description || 'No description provided.'}
                </p>
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => handleOpenEdit(dept)}>
                  <Edit className="w-3.5 h-3.5 text-slate-300" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDeptToDelete(dept)} className="text-rose-400 hover:text-rose-300">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Edit Department' : 'Create New Department'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {error && <p className="text-xs text-rose-400">{error}</p>}
          <Input
            label="Department Name"
            placeholder="e.g. Engineering"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Department Code"
            placeholder="e.g. ENG"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">Description</label>
            <textarea
              rows={3}
              placeholder="Brief description of department scope..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={actionLoading}>
              {editingDept ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deptToDelete}
        onClose={() => !deleteLoading && setDeptToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Department Permanently?"
        description="Are you sure you want to delete this organizational department? Employees currently assigned to it will need re-assignment."
        confirmText="Delete Department"
        variant="danger"
        itemName={deptToDelete?.name}
        itemBadge={deptToDelete?.code}
        infoCallout="Notice: Active polls targeting this department will no longer include its audience."
        isLoading={deleteLoading}
      />
    </div>
  );
};
