import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pollApi, departmentApi, categoryApi } from '../../lib/api';
import { getKolkataDatetimeLocalString, toKolkataIsoString } from '../../lib/date';
import { Department, PollCategory } from '../../types';
import { Button, Input, Card, Badge, CategoryCombobox } from '../../components/ui';
import {
  Vote, Plus, Trash2, ArrowLeft, Calendar,
  ShieldCheck, HelpCircle, Sparkles, Check
} from 'lucide-react';

export const CreateEditPoll: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<PollCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('');
  const [votingType, setVotingType] = useState<'single_choice' | 'multiple_choice' | 'yes_no' | 'rating'>('single_choice');
  const [targetAudience, setTargetAudience] = useState<'all' | 'department' | 'selected_employees'>('all');
  const [selectedDepts, setSelectedDepts] = useState<number[]>([]);
  const [anonymousVoting, setAnonymousVoting] = useState(false);
  const [allowComments, setAllowComments] = useState(true);
  const [resultsVisibility, setResultsVisibility] = useState<'always' | 'after_voting' | 'after_closing' | 'admin_only'>('after_voting');

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [startDatetime, setStartDatetime] = useState(getKolkataDatetimeLocalString(now));
  const [endDatetime, setEndDatetime] = useState(getKolkataDatetimeLocalString(nextWeek));

  const [options, setOptions] = useState<{ text: string }[]>([
    { text: 'Option 1' },
    { text: 'Option 2' },
  ]);

  useEffect(() => {
    Promise.all([departmentApi.list(), categoryApi.list()]).then(([dList, cList]) => {
      setDepartments(dList);
      setCategories(cList);
      if (cList.length > 0) setCategory(String(cList[0].id));
    });
  }, []);

  const handleCreateCategory = async (newCategoryName: string) => {
    try {
      const created = await categoryApi.create({ name: newCategoryName });
      setCategories((prev) => {
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, created];
      });
      setCategory(String(created.id));
      return created;
    } catch (err: any) {
      console.error('Failed to create category:', err);
      throw err;
    }
  };

  const handleVotingTypeChange = (type: any) => {
    setVotingType(type);
    if (type === 'yes_no') {
      setOptions([{ text: 'Yes' }, { text: 'No' }]);
    } else if (type === 'rating') {
      setOptions([{ text: 'Rate on scale 1 to 10' }]);
    } else if (options.length < 2) {
      setOptions([{ text: 'Option 1' }, { text: 'Option 2' }]);
    }
  };

  const handleAddOption = () => {
    setOptions([...options, { text: `Option ${options.length + 1}` }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionTextChange = (index: number, text: string) => {
    const updated = [...options];
    updated[index].text = text;
    setOptions(updated);
  };

  const handleToggleDept = (deptId: number) => {
    if (selectedDepts.includes(deptId)) {
      setSelectedDepts(selectedDepts.filter(id => id !== deptId));
    } else {
      setSelectedDepts([...selectedDepts, deptId]);
    }
  };

  const handleSubmit = async (publishDirectly: boolean) => {
    setError(null);
    if (!title.trim()) {
      setError('Poll title is required.');
      return;
    }

    if (votingType !== 'rating') {
      const validOpts = options.filter(o => o.text.trim() !== '');
      if (validOpts.length < 2) {
        setError('At least two options are required for this poll.');
        return;
      }
    }

    setLoading(true);
    try {
      const payload: any = {
        title,
        description,
        category: category ? Number(category) : null,
        voting_type: votingType,
        target_audience: targetAudience,
        targeted_departments: targetAudience === 'department' ? selectedDepts : [],
        anonymous_voting: anonymousVoting,
        allow_comments: allowComments,
        results_visibility: resultsVisibility,
        start_datetime: toKolkataIsoString(startDatetime),
        end_datetime: toKolkataIsoString(endDatetime),
        status: publishDirectly ? 'active' : 'draft',
        options: votingType === 'rating' ? [{ text: 'Rating (1-10)' }] : options.filter(o => o.text.trim() !== ''),
      };

      const poll = await pollApi.create(payload);
      if (publishDirectly) {
        await pollApi.publish(poll.id);
      }
      navigate('/admin/polls');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create poll. Please check fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/admin/polls')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Poll Management</span>
        </button>
      </div>

      <div>
        <h1 className="text-2xl font-black tracking-tight text-white">Create New Company Poll</h1>
        <p className="text-sm text-slate-400">Configure survey parameters, targeting, options, and privacy rules</p>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-400">
          {error}
        </div>
      )}

      {/* Main Settings Card */}
      <Card className="p-6 space-y-5">
        <Input
          label="Poll Title"
          placeholder="e.g. Q4 Company Strategy & Culture Feedback"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Description & Context
          </label>
          <textarea
            rows={3}
            placeholder="Explain why this poll matters and how employee feedback will be applied..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Poll Category
              </label>
              <span className="text-[11px] text-slate-500">
                Search or create new
              </span>
            </div>
            <CategoryCombobox
              categories={categories}
              selectedCategoryId={category}
              onSelectCategory={(id) => setCategory(String(id))}
              onCreateCategory={handleCreateCategory}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Voting Type
            </label>
            <select
              value={votingType}
              onChange={(e) => handleVotingTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="single_choice">Single Choice (1 Option)</option>
              <option value="multiple_choice">Multiple Choice (Multiple Options)</option>
              <option value="yes_no">Yes / No</option>
              <option value="rating">Rating Poll (Scale 1 to 10)</option>
            </select>
          </div>
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Start Date & Time (IST - Indian Standard Time)"
            type="datetime-local"
            value={startDatetime}
            onChange={(e) => setStartDatetime(e.target.value)}
          />
          <Input
            label="End Date & Time (IST - Indian Standard Time)"
            type="datetime-local"
            value={endDatetime}
            onChange={(e) => setEndDatetime(e.target.value)}
          />
        </div>

        {/* Target Audience */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            Target Audience
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTargetAudience('all')}
              className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                targetAudience === 'all'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold">All Employees</div>
              <div className="text-[11px] text-slate-400">Company-wide poll open to all active staff</div>
            </button>
            <button
              type="button"
              onClick={() => setTargetAudience('department')}
              className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                targetAudience === 'department'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-slate-800 bg-slate-950/50 text-slate-400 hover:text-white'
              }`}
            >
              <div className="text-xs font-bold">Specific Departments</div>
              <div className="text-[11px] text-slate-400">Only employees belonging to selected teams</div>
            </button>
          </div>

          {targetAudience === 'department' && (
            <div className="pt-2 flex flex-wrap gap-2">
              {departments.map((dept) => {
                const isSelected = selectedDepts.includes(dept.id);
                return (
                  <button
                    key={dept.id}
                    type="button"
                    onClick={() => handleToggleDept(dept.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isSelected && <Check className="w-3 h-3 inline mr-1" />}
                    {dept.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Voting Privacy & Results Visibility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
          <div className="p-4 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-purple-400" />
                  Anonymous Voting
                </h4>
                <p className="text-[11px] text-slate-400">Zero linkage between voter identity and choices</p>
              </div>
              <input
                type="checkbox"
                checked={anonymousVoting}
                onChange={(e) => setAnonymousVoting(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Results Visibility for Employees
            </label>
            <select
              value={resultsVisibility}
              onChange={(e) => setResultsVisibility(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="after_voting">Visible After Voting (Recommended)</option>
              <option value="always">Always Visible (Real-time)</option>
              <option value="after_closing">Visible Only After Poll Closes</option>
              <option value="admin_only">Admin Only (Confidential)</option>
            </select>
          </div>
        </div>

        {/* Options Builder */}
        {votingType !== 'rating' && (
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Poll Options</h4>
                <p className="text-xs text-slate-400">Define the selectable ballot options</p>
              </div>
              {votingType !== 'yes_no' && (
                <Button type="button" size="sm" variant="outline" onClick={handleAddOption} className="gap-1">
                  <Plus className="w-3.5 h-3.5" />
                  Add Option
                </Button>
              )}
            </div>

            <div className="space-y-2.5">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-bold text-slate-500">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt.text}
                    onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                    disabled={votingType === 'yes_no'}
                    className="flex-1 px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                  {votingType !== 'yes_no' && options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin/polls')}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => handleSubmit(false)}
            isLoading={loading}
          >
            Save as Draft
          </Button>
          <Button
            type="button"
            onClick={() => handleSubmit(true)}
            isLoading={loading}
          >
            Publish Poll Now
          </Button>
        </div>
      </Card>
    </div>
  );
};
