import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, Plus, Tag, X, Loader2 } from 'lucide-react';
import { PollCategory } from '../../types';

interface CategoryComboboxProps {
  categories: PollCategory[];
  selectedCategoryId: string | number | null;
  onSelectCategory: (id: string | number) => void;
  onCreateCategory: (name: string) => Promise<PollCategory | null | void>;
  disabled?: boolean;
}

export const CategoryCombobox: React.FC<CategoryComboboxProps> = ({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onCreateCategory,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setCreationError(null);
    } else {
      setSearch('');
    }
  }, [isOpen]);

  const selectedCategory = categories.find(
    (c) => String(c.id) === String(selectedCategoryId)
  );

  const trimmedSearch = search.trim();
  const searchLower = trimmedSearch.toLowerCase();

  // Filter categories
  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(searchLower)
  );

  // Check if search matches an existing category case-insensitively
  const exactMatch = categories.find(
    (c) => c.name.trim().toLowerCase() === searchLower
  );

  const handleSelect = (categoryItem: PollCategory) => {
    onSelectCategory(categoryItem.id);
    setIsOpen(false);
  };

  const handleCreate = async () => {
    if (!trimmedSearch || isCreating) return;

    if (exactMatch) {
      handleSelect(exactMatch);
      return;
    }

    setIsCreating(true);
    setCreationError(null);
    try {
      const created = await onCreateCategory(trimmedSearch);
      if (created) {
        onSelectCategory(created.id);
      }
      setIsOpen(false);
    } catch (err: any) {
      setCreationError(err.response?.data?.name?.[0] || err.message || 'Failed to create category');
    } finally {
      setIsCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (trimmedSearch.length > 0) {
        handleCreate();
      } else if (filtered.length > 0) {
        handleSelect(filtered[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 bg-slate-950/70 border rounded-lg text-sm text-left flex items-center justify-between transition-colors cursor-pointer ${
          isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-800 hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedCategory ? (
            <>
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: selectedCategory.color || '#3b82f6' }}
              />
              <span className="text-slate-100 font-medium truncate">
                {selectedCategory.name}
              </span>
            </>
          ) : (
            <span className="text-slate-500 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              <span>Select or search category...</span>
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 ml-2 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-blue-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 z-50 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl shadow-black/60 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Box Header */}
          <div className="p-2 border-b border-slate-800/80 bg-slate-950/80">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search category or type to create..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {creationError && (
              <p className="text-[11px] text-rose-400 mt-1 px-1">{creationError}</p>
            )}
          </div>

          {/* Option: Create New Category (When typed text does not match an existing category) */}
          {trimmedSearch.length > 0 && !exactMatch && (
            <div className="p-2 border-b border-slate-800/60 bg-blue-500/5">
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating}
                className="w-full flex items-center justify-between p-2.5 bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 rounded-lg text-xs font-semibold text-blue-300 hover:text-white transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-2 truncate">
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <Plus className="w-4 h-4 text-blue-400 group-hover:scale-110 shrink-0 transition-transform" />
                  )}
                  <span className="truncate">
                    Create new category: <strong className="text-white">"{trimmedSearch}"</strong>
                  </span>
                </div>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider shrink-0 ml-2">
                  ↵ Enter
                </span>
              </button>
            </div>
          )}

          {/* Categories List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5 divide-y divide-slate-800/20">
            {filtered.length === 0 && !trimmedSearch ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No categories available. Type above to create one.
              </div>
            ) : filtered.length === 0 && exactMatch ? null : filtered.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching category found. Click above or press Enter to create it!
              </div>
            ) : (
              filtered.map((cat) => {
                const isSelected = String(cat.id) === String(selectedCategoryId);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600/20 text-blue-300 font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || '#3b82f6' }}
                      />
                      <span className="truncate">{cat.name}</span>
                      {cat.poll_count !== undefined && (
                        <span className="text-[10px] text-slate-500 font-normal">
                          ({cat.poll_count} {cat.poll_count === 1 ? 'poll' : 'polls'})
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
