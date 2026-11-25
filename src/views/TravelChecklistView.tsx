import React, { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  RotateCcw, 
  Plus, 
  X, 
  Trash2, 
  Sparkles, 
  FileText, 
  CreditCard, 
  ThermometerSnowflake, 
  Cpu, 
  HeartPulse, 
  Home, 
  SunMedium, 
  Compass, 
  Moon, 
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { ChecklistItem, ChecklistType, PreTravelCategory, DailyCategory } from '../types';

export const TravelChecklistView: React.FC = () => {
  const { 
    checklistItems, 
    toggleChecklistItem, 
    addChecklistItem, 
    deleteChecklistItem, 
    resetDailyChecklist,
    preTravelProgress,
    dailyProgress
  } = useTrip();

  const [activeType, setActiveType] = useState<ChecklistType>('pre_travel');
  const [filterState, setFilterState] = useState<'all' | 'pending' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);

  // New Custom Item Form State
  const [newTitle, setNewTitle] = useState<string>('');
  const [newSubtitle, setNewSubtitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('documents');

  // Active items based on current tab
  const currentItems = checklistItems.filter(item => item.type === activeType);
  const currentProgress = activeType === 'pre_travel' ? preTravelProgress : dailyProgress;

  // Filter items by status and search query
  const filteredItems = currentItems.filter(item => {
    if (filterState === 'pending' && item.isCompleted) return false;
    if (filterState === 'completed' && !item.isCompleted) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchSub = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
      if (!matchTitle && !matchSub) return false;
    }
    return true;
  });

  // Pre-Travel Category definitions with iconography and titles
  const preTravelCategories: { id: PreTravelCategory; name: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'documents', name: 'Documents & Visa', icon: FileText },
    { id: 'money_forex', name: 'Money & Forex', icon: CreditCard },
    { id: 'winter_clothing', name: 'Sub-Zero & Arctic Gear', icon: ThermometerSnowflake },
    { id: 'electronics_gear', name: 'Tech & Electronics', icon: Cpu },
    { id: 'health_safety', name: 'Health & First Aid', icon: HeartPulse },
    { id: 'home_departure', name: 'Home Departure Routine', icon: Home },
  ];

  // Daily Category definitions
  const dailyCategories: { id: DailyCategory; name: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'morning_departure', name: 'Morning Hotel Exit (Pockets & Bag)', icon: SunMedium },
    { id: 'pocket_essentials', name: 'Day Activity & Cold Protection', icon: Compass },
    { id: 'evening_return', name: 'Evening Return & Recharge', icon: Moon },
  ];

  const activeCategories = activeType === 'pre_travel' ? preTravelCategories : dailyCategories;

  const handleCreateCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newItem: ChecklistItem = {
      id: `custom-chk-${Date.now()}`,
      type: activeType,
      category: newCategory,
      title: newTitle.trim(),
      subtitle: newSubtitle.trim() || undefined,
      isCompleted: false,
      isCustom: true,
    };

    addChecklistItem(newItem);
    setNewTitle('');
    setNewSubtitle('');
    setIsAddModalOpen(false);
  };

  const handleConfirmResetDaily = () => {
    resetDailyChecklist();
    setShowResetConfirm(false);
  };

  return (
    <div className="space-y-6 pb-36 md:pb-16 px-5 sm:px-8 pt-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <span className="font-mono-fluid text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/50 block">
            Trip Preparation &amp; Daily Routine
          </span>
          <h1 className="font-gaegu text-4xl sm:text-5xl font-bold leading-none text-[#ff5e3a] -rotate-1 inline-block mt-1">
            Travel Checklists
          </h1>
        </div>

        <button
          onClick={() => {
            setNewCategory(activeType === 'pre_travel' ? 'documents' : 'morning_departure');
            setIsAddModalOpen(true);
          }}
          className="px-3.5 py-2 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center space-x-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Main Tab Segmented Control */}
      <div className="p-1 rounded-2xl bg-slate-200/80 grid grid-cols-2 gap-1.5 text-xs font-black shadow-inner">
        <button
          type="button"
          onClick={() => {
            setActiveType('pre_travel');
            setFilterState('all');
          }}
          className={`py-3 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeType === 'pre_travel'
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>✈️ Pre-Travel Packing</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeType === 'pre_travel' ? 'bg-sky-100 text-sky-800' : 'bg-slate-300 text-slate-700'
          }`}>
            {preTravelProgress.percent}%
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveType('daily');
            setFilterState('all');
          }}
          className={`py-3 px-3 rounded-xl transition flex items-center justify-center space-x-1.5 ${
            activeType === 'daily'
              ? 'bg-white text-indigo-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>☀️ Daily On-Trip</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
            activeType === 'daily' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-300 text-slate-700'
          }`}>
            {dailyProgress.completed}/{dailyProgress.total}
          </span>
        </button>
      </div>

      {/* Progress & Readiness Hero Card */}
      <div className="p-6 rounded-[2.2rem] glass-card space-y-4 shadow-sm border border-white/60">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              {activeType === 'pre_travel' ? 'Packing & Formalities Readiness' : 'Today\'s Routine Progress'}
            </span>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">
                {currentProgress.completed} of {currentProgress.total}
              </span>
              <span className="text-xs font-bold text-slate-500">items completed</span>
            </div>
          </div>

          <div className="text-right">
            <span className={`text-2xl font-black ${
              currentProgress.percent === 100 
                ? 'text-emerald-600' 
                : currentProgress.percent >= 50 
                ? 'text-sky-600' 
                : 'text-amber-600'
            }`}>
              {currentProgress.percent}%
            </span>
          </div>
        </div>

        {/* Progress Bar with Gradient */}
        <div className="w-full bg-slate-200/80 rounded-full h-3.5 p-0.5 overflow-hidden">
          <div 
            className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-500 transition-all duration-500 shadow-xs"
            style={{ width: `${Math.max(currentProgress.percent, 4)}%` }}
          />
        </div>

        {/* Bottom Banner Status / Actions */}
        <div className="flex items-center justify-between pt-1 text-xs">
          {activeType === 'pre_travel' ? (
            <div className="flex items-center space-x-1.5 text-slate-600 font-semibold text-[11px]">
              {currentProgress.percent === 100 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-emerald-700 font-bold">100% Packed! You are fully departure ready.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{currentProgress.total - currentProgress.completed} items pending before takeoff.</span>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between w-full">
              <span className="text-[11px] text-slate-600 font-semibold">
                Reusable routine for each day of your 11-day trip.
              </span>
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-black text-[11px] flex items-center space-x-1 border border-indigo-200/80 transition active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Start New Day</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Banner for Daily Reset */}
      {showResetConfirm && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2 animate-in fade-in">
          <p className="text-xs font-bold">
            ☀️ Start a fresh morning? This will uncheck only the Daily items so you can run through today's pockets & pack routine.
          </p>
          <div className="flex items-center space-x-2 pt-1">
            <button
              onClick={handleConfirmResetDaily}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 text-white font-black text-xs active:scale-95 transition"
            >
              Yes, Reset for Today
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 pointer-events-none" />
          <input
            type="text"
            placeholder={`Search ${activeType === 'pre_travel' ? 'packing & documents' : 'daily routine'}...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full glass-subcard rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 font-semibold placeholder:text-slate-400 border border-slate-200/80"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex space-x-2 text-xs">
          {[
            { id: 'all', label: `All (${currentItems.length})` },
            { id: 'pending', label: `⏳ Pending (${currentItems.filter(i => !i.isCompleted).length})` },
            { id: 'completed', label: `✅ Done (${currentItems.filter(i => i.isCompleted).length})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterState(f.id as any)}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs transition active:scale-95 ${
                filterState === f.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'glass-subcard text-slate-600 hover:text-slate-900 border border-slate-200/60'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category-Grouped Checklist Cards */}
      <div className="space-y-5">
        {activeCategories.map(cat => {
          const catItems = filteredItems.filter(item => item.category === cat.id);
          if (catItems.length === 0) return null;

          const IconComponent = cat.icon;
          const completedInCat = catItems.filter(i => i.isCompleted).length;
          const totalInCat = catItems.length;

          return (
            <div 
              key={cat.id} 
              className="rounded-[2.2rem] glass-card overflow-hidden border border-white/70 shadow-sm"
            >
              {/* Category Header */}
              <div className="p-4 sm:p-5 border-b border-white/60 bg-white/40 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 shadow-xs">
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">
                      {cat.name}
                    </h3>
                  </div>
                </div>

                <span className={`text-[10px] font-black px-2.5 py-1 rounded-full ${
                  completedInCat === totalInCat 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                }`}>
                  {completedInCat}/{totalInCat}
                </span>
              </div>

              {/* Items in Category */}
              <div className="divide-y divide-white/60">
                {catItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className={`p-4 sm:p-5 flex items-start space-x-3.5 transition cursor-pointer select-none active:bg-sky-50/50 ${
                      item.isCompleted ? 'bg-slate-50/50' : 'hover:bg-white/60'
                    }`}
                  >
                    {/* Checkbox Icon */}
                    <div className="pt-0.5 shrink-0">
                      {item.isCompleted ? (
                        <div className="w-5 h-5 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                          <CheckSquare className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-lg border-2 border-slate-300 hover:border-sky-500 bg-white flex items-center justify-center transition">
                          <Square className="w-3.5 h-3.5 text-transparent" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm font-bold leading-snug transition ${
                        item.isCompleted 
                          ? 'line-through text-slate-400' 
                          : 'text-slate-900'
                      }`}>
                        {item.title}
                      </p>
                      {item.subtitle && (
                        <p className={`text-[11px] mt-0.5 leading-relaxed font-medium ${
                          item.isCompleted ? 'text-slate-400' : 'text-slate-500'
                        }`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Custom Item Badge / Delete Action */}
                    {item.isCustom && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteChecklistItem(item.id);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition shrink-0"
                        title="Delete custom item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Empty State */}
        {filteredItems.length === 0 && (
          <div className="p-8 rounded-[2rem] glass-card text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
            <h4 className="text-sm font-black text-slate-700">No items match your filter</h4>
            <p className="text-xs text-slate-500">
              {searchQuery ? `No items found matching "${searchQuery}".` : 'All items in this filter are completed or empty.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Custom Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md p-6 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-600 block">Custom Reminder</span>
                <h3 className="text-base font-black text-slate-900">Add to Checklist</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomItem} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Item Name / Action</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Extra ski socks or Swiss chocolate gifts"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Notes / Subtitle (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Buy before boarding train at Lucerne station"
                  value={newSubtitle}
                  onChange={e => setNewSubtitle(e.target.value)}
                  className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Category</label>
                <select
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                  className="w-full glass-subcard rounded-2xl px-3 py-3 text-slate-900 font-semibold"
                >
                  {activeCategories.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  type="submit"
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition"
                >
                  Save to Checklist
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3.5 rounded-2xl glass-subcard text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

