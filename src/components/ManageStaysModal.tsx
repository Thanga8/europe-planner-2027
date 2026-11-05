import React, { useState } from 'react';
import { 
  X, 
  Bed, 
  CheckSquare, 
  Square, 
  Layers, 
  Scissors, 
  Calendar, 
  MapPin, 
  ReceiptIndianRupee, 
  Edit3, 
  Check, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { TripBookingItem } from '../types';

interface ManageStaysModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ManageStaysModal: React.FC<ManageStaysModalProps> = ({ isOpen, onClose }) => {
  const { bookings, combineStays, splitStay, updateHotelDetails } = useTrip();

  // Selected stay IDs for combining
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergedHotelName, setMergedHotelName] = useState<string>('');
  const [mergedLocation, setMergedLocation] = useState<string>('');
  const [notice, setNotice] = useState<string | null>(null);

  // Quick Inline Edit for a specific stay's hotel name/location
  const [editingStayId, setEditingStayId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editLocation, setEditLocation] = useState<string>('');

  if (!isOpen) return null;

  // All stay items sorted by date
  const stayItems = bookings
    .filter(b => b.category === 'stay')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const selectedItems = stayItems.filter(b => selectedIds.includes(b.id));

  // Compute combined preview totals
  const totalSelectedPlannedINR = selectedItems.reduce((sum, b) => sum + b.plannedCostINR, 0);
  const hasBooked = selectedItems.some(b => b.bookedCostINR !== null);
  const totalSelectedBookedINR = hasBooked 
    ? selectedItems.reduce((sum, b) => sum + (b.bookedCostINR ?? b.plannedCostINR), 0)
    : null;
  const totalSelectedNights = selectedItems.reduce((sum, b) => sum + (b.nightsCount || 1), 0);

  const toggleSelectStay = (id: string) => {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      
      // Auto-suggest hotel title and location from the first selected item
      if (next.length > 0) {
        const first = stayItems.find(b => b.id === next[0]);
        if (first) {
          const cleanName = first.title.replace(/\s*\((?:Night\s*\d+|2\s*Nights|3\s*Nights|\d+\s*Nights)[^)]*\)/i, '').trim();
          setMergedHotelName(cleanName);
          setMergedLocation(first.location);
        }
      } else {
        setMergedHotelName('');
        setMergedLocation('');
      }
      return next;
    });
  };

  const handleCombineSelected = () => {
    if (selectedIds.length < 2) return;

    combineStays(selectedIds, mergedHotelName.trim() || undefined, mergedLocation.trim() || undefined);
    setNotice(`Successfully combined ${selectedIds.length} nights into 1 stay!`);
    setSelectedIds([]);
    setMergedHotelName('');
    setMergedLocation('');
    setTimeout(() => setNotice(null), 3500);
  };

  const handleSplitStay = (id: string, title: string) => {
    splitStay(id);
    setNotice(`Split "${title}" back into individual nightly stays.`);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleStartEdit = (item: TripBookingItem) => {
    setEditingStayId(item.id);
    const cleanName = item.title.replace(/\s*\((?:Night\s*\d+|2\s*Nights|3\s*Nights|\d+\s*Nights)[^)]*\)/i, '').trim();
    setEditTitle(cleanName);
    setEditLocation(item.location);
  };

  const handleSaveEdit = (stayId: string) => {
    if (!editTitle.trim()) return;
    updateHotelDetails(stayId, editTitle.trim(), editLocation.trim());
    setEditingStayId(null);
    setNotice('Hotel name & address updated and synchronized across all days and map stops!');
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
      <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-lg max-h-[92vh] flex flex-col p-6 text-slate-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 block">
                Stay Customizer
              </span>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Combine & Split Stays
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70 active:scale-95 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notice alert */}
        {notice && (
          <div className="my-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        {/* Scrollable list of stays */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-1">
          <p className="text-[11px] text-slate-500 font-semibold px-1">
            Check 2 or more nights to merge them into 1 booking with combined Excel seed amounts, or tap "Split" on any combined stay.
          </p>

          <div className="space-y-3">
            {stayItems.map(item => {
              const isCombined = (item.nightsCount && item.nightsCount > 1) || (item.mergedItemIds && item.mergedItemIds.length > 1);
              const isSelected = selectedIds.includes(item.id);
              const isEditing = editingStayId === item.id;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl transition border ${
                    isSelected
                      ? 'bg-sky-50/90 border-sky-300 shadow-sm'
                      : isCombined
                      ? 'bg-indigo-50/60 border-indigo-200/80'
                      : 'glass-subcard border-slate-200/70 hover:bg-white/70'
                  }`}
                >
                  {isEditing ? (
                    /* Inline Hotel Name & Location Editor */
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                          Hotel / Property Name:
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={e => setEditTitle(e.target.value)}
                          className="w-full glass-subcard rounded-xl px-3 py-2 text-xs font-black text-slate-900 border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                          Location / Street Address (Updates Map Pins):
                        </label>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={e => setEditLocation(e.target.value)}
                          className="w-full glass-subcard rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 border border-slate-300"
                        />
                      </div>
                      <div className="flex items-center space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs flex items-center space-x-1 shadow-xs active:scale-95"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save & Sync Everywhere</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStayId(null)}
                          className="px-3 py-2 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Stay Summary Display */
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2.5">
                          {/* Selection Checkbox */}
                          <button
                            type="button"
                            onClick={() => toggleSelectStay(item.id)}
                            className="pt-0.5 text-sky-600 hover:text-sky-800 transition"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-sky-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-400 hover:text-slate-600" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {isCombined 
                                  ? `Days ${item.mergedDayNumbers?.join(', ') || item.dayNumber} • ${item.nightsCount} Nights`
                                  : `Day ${item.dayNumber} • 1 Night`}
                              </span>

                              {isCombined && (
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-300">
                                  🔗 Combined
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 leading-snug">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium flex items-center space-x-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                              <span className="truncate">{item.location}</span>
                            </p>
                          </div>
                        </div>

                        {/* Actions: Edit or Split */}
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(item)}
                            className="p-1.5 rounded-xl glass-subcard hover:bg-white text-slate-600 hover:text-sky-700 transition"
                            title="Edit Hotel Name & Location"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {isCombined && (
                            <button
                              type="button"
                              onClick={() => handleSplitStay(item.id, item.title)}
                              className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[10px] flex items-center space-x-1 active:scale-95 transition"
                              title="Split into individual 1-night items"
                            >
                              <Scissors className="w-3 h-3" />
                              <span>Split</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Cost and Dates Strip */}
                      <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-600 font-semibold">
                        <div className="flex items-center space-x-3">
                          <span>
                            Plan: <strong className="text-slate-800">₹{item.plannedCostINR.toLocaleString('en-IN')}</strong>
                          </span>
                          <span>
                            Booked: <strong className="text-slate-900">
                              {item.bookedCostINR !== null ? `₹${item.bookedCostINR.toLocaleString('en-IN')}` : 'Pending'}
                            </strong>
                            {item.bookedCurrency !== 'INR' && item.bookedCostOriginal && (
                              <span className="text-[10px] text-slate-500 ml-1">
                                ({item.bookedCostOriginal} {item.bookedCurrency})
                              </span>
                            )}
                          </span>
                        </div>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.date} {item.checkOutDate ? `→ ${item.checkOutDate}` : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Multi-Select Combine Action Dock */}
        {selectedIds.length >= 2 ? (
          <div className="mt-3 pt-3 border-t border-white/60 space-y-3 bg-white/50 -mx-6 -mb-6 p-6 rounded-b-[2.5rem] shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase text-sky-700 block">
                  Combine {totalSelectedNights} Nights Into 1 Stay
                </span>
                <div className="flex items-baseline space-x-3 mt-0.5 text-xs">
                  <span>Planned: <strong className="text-slate-900 font-black">₹{totalSelectedPlannedINR.toLocaleString('en-IN')}</strong></span>
                  <span>Booked: <strong className="text-slate-900 font-black">
                    {totalSelectedBookedINR !== null ? `₹${totalSelectedBookedINR.toLocaleString('en-IN')}` : 'Pending'}
                  </strong></span>
                </div>
              </div>

              <span className="text-xs font-black text-sky-600 bg-sky-100 px-2.5 py-1 rounded-full border border-sky-300">
                {selectedIds.length} Selected
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Combined Hotel Name:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Central Paris Boutique Hotel"
                  value={mergedHotelName}
                  onChange={e => setMergedHotelName(e.target.value)}
                  className="w-full glass-subcard rounded-xl px-3 py-2 font-bold text-xs text-slate-900 border border-slate-300"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 uppercase block mb-1">
                  Location / Address:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paris, France (Opera / Le Marais)"
                  value={mergedLocation}
                  onChange={e => setMergedLocation(e.target.value)}
                  className="w-full glass-subcard rounded-xl px-3 py-2 font-semibold text-xs text-slate-900 border border-slate-300"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleCombineSelected}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-2"
            >
              <Layers className="w-4 h-4" />
              <span>Combine {selectedIds.length} Nights into 1 Stay</span>
            </button>
          </div>
        ) : selectedIds.length === 1 ? (
          <div className="mt-3 pt-3 border-t border-white/60 text-center text-xs text-slate-500 font-semibold">
            Select at least 1 more night to combine them together.
          </div>
        ) : null}
      </div>
    </div>
  );
};

