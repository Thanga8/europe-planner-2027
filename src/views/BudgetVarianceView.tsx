import React, { useState } from 'react';
import { 
  TrendingDown, 
  TrendingUp, 
  Plus, 
  Edit3, 
  X, 
  ReceiptIndianRupee, 
  Bed, 
  Plane, 
  Ticket, 
  Utensils, 
  FileCheck2,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  Wallet,
  Trash2,
  Clock
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { TripBookingItem, BookingCategory, BookingStatus } from '../types';

export const BudgetVarianceView: React.FC = () => {
  const { 
    bookings, 
    updateBooking, 
    addBooking, 
    totalPlannedINR, 
    totalBookedINR, 
    totalVarianceINR, 
    pocketExpenses,
    totalPocketExpensesINR,
    deletePocketExpense,
    exchangeRates, 
    vaultSecurity 
  } = useTrip();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAllItems, setShowAllItems] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<TripBookingItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<Partial<TripBookingItem>>({});

  const categories = [
    { id: 'all', label: 'All Items', icon: ReceiptIndianRupee },
    { id: 'stay', label: 'Stays', icon: Bed },
    { id: 'travel', label: 'Travel', icon: Plane },
    { id: 'activity', label: 'Activities', icon: Ticket },
    { id: 'food', label: 'Food', icon: Utensils },
    { id: 'visa', label: 'Visa', icon: FileCheck2 },
  ];

  const filteredBookings = bookings.filter(item => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'travel') {
      return item.category === 'flight' || item.category === 'train';
    }
    return item.category === selectedCategory;
  });

  const displayedBookings = showAllItems ? filteredBookings : filteredBookings.slice(0, 4);

  const handleStartEdit = (item: TripBookingItem) => {
    setEditingItem(item);
    setFormData({ ...item });
  };

  const handleSaveEdit = () => {
    if (!editingItem) return;

    let bookedINR = formData.bookedCostINR ?? null;
    if (formData.bookedCostOriginal && formData.bookedCurrency) {
      if (formData.bookedCurrency === 'EUR') {
        bookedINR = Math.round(formData.bookedCostOriginal * exchangeRates.EUR);
      } else if (formData.bookedCurrency === 'CHF') {
        bookedINR = Math.round(formData.bookedCostOriginal * exchangeRates.CHF);
      } else {
        bookedINR = formData.bookedCostOriginal;
      }
    }

    const finalStatus = (formData.bookingStatus as BookingStatus) || editingItem.bookingStatus;
    const isStatusNotBooked = finalStatus === 'not_booked';

    // Default to non-refundable (false) unless explicitly marked refundable
    const isRef = isStatusNotBooked 
      ? false 
      : (formData.isRefundable ?? editingItem.isRefundable ?? false);

    const deadline = isRef 
      ? (formData.cancellationDeadline ? new Date(formData.cancellationDeadline).toISOString() : editingItem.cancellationDeadline) 
      : null;

    const policy = formData.refundPolicy || (
      isStatusNotBooked 
        ? 'Not booked yet' 
        : (isRef 
          ? (deadline ? `Free cancellation until ${new Date(deadline).toLocaleDateString('en-GB')}` : 'Free cancellation') 
          : 'Non-refundable booking')
    );

    const updated: TripBookingItem = {
      ...editingItem,
      ...formData,
      bookingStatus: finalStatus,
      bookedCostINR: bookedINR,
      isRefundable: isRef,
      cancellationDeadline: deadline,
      refundPolicy: policy,
      cancellationFeeINR: isRef ? 0 : (bookedINR ?? editingItem.plannedCostINR),
    } as TripBookingItem;

    updateBooking(updated);
    setEditingItem(null);
  };

  const handleCreateNewBooking = () => {
    const finalStatus = (formData.bookingStatus as BookingStatus) || 'not_booked';
    const isStatusNotBooked = finalStatus === 'not_booked';
    const isRef = isStatusNotBooked ? false : (formData.isRefundable ?? false);
    const deadline = isRef && formData.cancellationDeadline ? new Date(formData.cancellationDeadline).toISOString() : null;
    const policy = formData.refundPolicy || (
      isStatusNotBooked 
        ? 'Not booked yet' 
        : (isRef ? 'Free cancellation' : 'Non-refundable booking')
    );

    const newItem: TripBookingItem = {
      id: `custom-booking-${Date.now()}`,
      date: formData.date || '2027-02-08',
      dayNumber: formData.dayNumber || 1,
      category: (formData.category as BookingCategory) || 'activity',
      title: formData.title || 'New Travel Item',
      location: formData.location || 'Europe',
      details: formData.details || '',
      plannedCostINR: Number(formData.plannedCostINR) || 0,
      bookedCostINR: Number(formData.bookedCostINR) || null,
      bookedCostOriginal: Number(formData.bookedCostOriginal) || null,
      bookedCurrency: (formData.bookedCurrency as any) || 'INR',
      bookingStatus: finalStatus,
      provider: formData.provider || '',
      confirmationNumber: formData.confirmationNumber || '',
      cancellationDeadline: deadline,
      isRefundable: isRef,
      refundPolicy: policy,
      cancellationFeeINR: isRef ? 0 : (Number(formData.cancellationFeeINR) || (Number(formData.bookedCostINR) || Number(formData.plannedCostINR) || 0)),
      emergencyContact: '',
      bookingUrl: '',
      notes: '',
    };

    addBooking(newItem);
    setIsAddModalOpen(false);
    setFormData({});
  };

  const confirmedCount = bookings.filter(b => b.bookingStatus === 'confirmed').length;
  const reservedCount = bookings.filter(b => b.bookingStatus === 'reserved').length;
  const pendingCount = bookings.filter(b => b.bookingStatus === 'not_booked').length;

  return (
    <div className="space-y-6 pb-36 px-5 sm:px-6 pt-5 max-w-xl mx-auto">
      {/* Top Financial Summary Cards with Large High-Impact Typography */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 rounded-[2.2rem] glass-card space-y-2">
          <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Excel Planned</span>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            ₹{totalPlannedINR.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-bold block">Baseline Budget</span>
        </div>

        <div className="p-6 rounded-[2.2rem] glass-card space-y-2">
          <span className="text-xs font-black text-sky-800 uppercase tracking-wider">Booked Total</span>
          <div className="text-2xl sm:text-3xl font-black text-sky-800 tracking-tight">
            ₹{totalBookedINR.toLocaleString('en-IN')}
          </div>
          <span className="text-xs text-slate-500 font-bold block">
            {confirmedCount} confirmed • {reservedCount} reserved
          </span>
        </div>
      </div>

      {/* Variance Pill Card */}
      <div className={`p-6 sm:p-7 rounded-[2.2rem] border flex items-center justify-between transition-all ${
        totalVarianceINR <= 0 
          ? 'glass-card-elevated border-emerald-300 text-emerald-950' 
          : 'glass-card-elevated border-rose-300 text-rose-950'
      }`}>
        <div className="flex items-center space-x-4">
          <div className={`p-3.5 rounded-2xl ${totalVarianceINR <= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            {totalVarianceINR <= 0 ? <TrendingDown className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-600">
              {totalVarianceINR <= 0 ? 'Total Savings Realized' : 'Net Budget Overrun'}
            </div>
            <div className="text-2xl font-black mt-0.5 tracking-tight">
              {totalVarianceINR <= 0 
                ? `₹${Math.abs(totalVarianceINR).toLocaleString('en-IN')} Saved` 
                : `+₹${totalVarianceINR.toLocaleString('en-IN')} Over`}
            </div>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase font-black text-slate-500 block">Pending</span>
          <span className="font-black text-amber-700 text-base mt-0.5 block">{pendingCount} Items</span>
        </div>
      </div>

      {/* On-The-Go Pocket Expenses Tracker Card */}
      <div className="p-6 rounded-[2.2rem] glass-card space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                Incidental Spending Tracker
              </span>
              <h3 className="text-sm font-black text-slate-900">
                Daily Pocket Expenses
              </h3>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xl font-black text-emerald-900 block">
              ₹{totalPocketExpensesINR.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-slate-500 block">
              {pocketExpenses.length} item{pocketExpenses.length === 1 ? '' : 's'} logged
            </span>
          </div>
        </div>

        {pocketExpenses.length > 0 && (
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-500 px-1">
              <span>Recent On-The-Go Logs</span>
              <span className="text-emerald-700">{pocketExpenses.length} total</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {pocketExpenses.slice(0, 6).map(expense => (
                <div key={expense.id} className="p-2.5 rounded-xl bg-white/70 border border-slate-100 flex items-center justify-between text-xs">
                  <div className="min-w-0 pr-2">
                    <span className="font-bold text-slate-900 block truncate">{expense.description}</span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Day {expense.dayNumber} • {expense.category} • {expense.paymentMode.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <div className="text-right">
                      <span className="font-black text-slate-900 block text-xs">
                        {expense.currency === 'EUR' ? '€' : expense.currency === 'CHF' ? 'CHF ' : '₹'}{expense.amount}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-800 block">
                        ≈ ₹{expense.amountINR.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deletePocketExpense(expense.id)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 transition"
                      title="Delete expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Category Filter Chips */}
      <div className="flex space-x-2.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        {categories.map(cat => {
          const Icon = cat.icon;
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                setShowAllItems(false);
              }}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-2xl whitespace-nowrap transition font-black text-xs active:scale-95 shadow-xs ${
                isSelected 
                  ? 'glass-pill-active' 
                  : 'glass-pill text-slate-700 hover:text-slate-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Action Header */}
      <div className="flex items-center justify-between text-xs px-1">
        <span className="text-slate-700 font-extrabold text-xs">
          Showing {displayedBookings.length} of {filteredBookings.length} items
        </span>
        <button
          onClick={() => {
            setFormData({});
            setIsAddModalOpen(true);
          }}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl glass-card hover:bg-white text-sky-800 font-bold active:scale-95 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Item</span>
        </button>
      </div>

      {/* Limited, High-Impact Bookings List */}
      <div className="space-y-4">
        {displayedBookings.map(item => {
          const bookedPrice = item.bookedCostINR;
          const variance = bookedPrice !== null ? (bookedPrice - item.plannedCostINR) : null;
          const isSavings = variance !== null && variance <= 0;

          return (
            <div
              key={item.id}
              className="p-6 sm:p-7 rounded-[2rem] glass-card hover:bg-white/80 transition space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1.5 min-w-0 pr-3">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                      Day {item.dayNumber} • {item.date}
                    </span>
                    <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full capitalize ${
                      item.bookingStatus === 'confirmed' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : item.bookingStatus === 'reserved'
                        ? 'bg-sky-100 text-sky-800 border border-sky-300'
                        : item.bookingStatus === 'cancelled'
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {item.bookingStatus.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">{item.title}</h3>
                  <p className="text-xs text-slate-500 font-medium truncate">{item.provider} • {item.location}</p>
                </div>

                <button
                  onClick={() => handleStartEdit(item)}
                  className="p-2.5 rounded-xl glass-subcard hover:bg-white text-sky-800 active:scale-95 transition shadow-xs shrink-0"
                  title="Edit Booked Price"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              {/* Price & Variance Metrics Box with Large Bold Figures */}
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/70 text-center">
                <div className="glass-subcard p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-500 block font-bold uppercase">Plan</span>
                  <span className="text-sm font-black text-slate-900 block mt-1">
                    ₹{item.plannedCostINR.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="glass-subcard p-3 rounded-2xl">
                  <span className="text-[10px] text-slate-500 block font-bold uppercase">Booked</span>
                  <span className="text-sm font-black text-slate-900 block mt-1">
                    {bookedPrice !== null 
                      ? `₹${bookedPrice.toLocaleString('en-IN')}` 
                      : <span className="text-amber-700 font-semibold">Pending</span>}
                  </span>
                </div>

                <div className={`p-3 rounded-2xl border ${
                  variance === null 
                    ? 'glass-subcard text-slate-500' 
                    : isSavings 
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                    : 'bg-rose-100 text-rose-800 border-rose-300'
                }`}>
                  <span className="text-[10px] block font-bold uppercase">Variance</span>
                  <span className="text-sm font-black block mt-1">
                    {variance === null 
                      ? '—' 
                      : isSavings 
                      ? `-₹${Math.abs(variance).toLocaleString('en-IN')}` 
                      : `+₹${variance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Progressive Disclosure: Show All Toggle */}
      {filteredBookings.length > 4 && (
        <div className="text-center pt-1">
          <button
            onClick={() => setShowAllItems(!showAllItems)}
            className="px-6 py-3 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-black text-xs transition active:scale-95 shadow-xs"
          >
            {showAllItems ? 'Show Top 4 Items' : `View All ${filteredBookings.length} Items`}
          </button>
        </div>
      )}

      {/* Edit Booking Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto p-7 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-slate-900">Update Booking & Price</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Item Title</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">Status</label>
                  <select
                    value={formData.bookingStatus || 'not_booked'}
                    onChange={e => setFormData({ ...formData, bookingStatus: e.target.value as any })}
                    className="w-full glass-subcard rounded-2xl px-3 py-3 text-slate-900 font-semibold"
                  >
                    <option value="not_booked">Not Booked</option>
                    <option value="reserved">Reserved (Pay Later)</option>
                    <option value="confirmed">Confirmed / Paid</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">Amount (INR)</label>
                  <input
                    type="number"
                    value={formData.bookedCostINR ?? ''}
                    placeholder="e.g. 75000"
                    onChange={e => setFormData({ ...formData, bookedCostINR: Number(e.target.value) })}
                    className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-black"
                  />
                </div>
              </div>

              {/* Cancellation Policy Toggle */}
              {((formData.bookingStatus || editingItem.bookingStatus) === 'not_booked') ? (
                <div className="p-3.5 rounded-2xl glass-subcard border border-amber-200/80 bg-amber-50/70 text-amber-900 space-y-1">
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Status: Pending Booking (To Book)</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Refundability & cancellation terms do not apply until this item is reserved or confirmed.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl glass-subcard space-y-2.5 border border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <label className="text-slate-800 font-bold text-xs">Cancellation Policy</label>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      (formData.isRefundable ?? editingItem.isRefundable ?? false)
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {(formData.isRefundable ?? editingItem.isRefundable ?? false) ? 'Free Cancellation' : 'Non-Refundable (Default)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-200/70">
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          isRefundable: false,
                          refundPolicy: 'Non-refundable booking',
                          cancellationDeadline: undefined
                        });
                      }}
                      className={`py-2 px-2.5 rounded-lg font-black text-xs transition flex items-center justify-center space-x-1 ${
                        !(formData.isRefundable ?? editingItem.isRefundable ?? false)
                          ? 'bg-white text-rose-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🔒 Non-Refund (Default)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ 
                          ...formData, 
                          isRefundable: true,
                          cancellationDeadline: formData.cancellationDeadline || (editingItem.date ? `${editingItem.date}T23:59` : '2027-02-03T23:59'),
                          refundPolicy: formData.refundPolicy || 'Free cancellation until specified date'
                        });
                      }}
                      className={`py-2 px-2.5 rounded-lg font-black text-xs transition flex items-center justify-center space-x-1 ${
                        (formData.isRefundable ?? editingItem.isRefundable ?? false)
                          ? 'bg-white text-emerald-700 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Free Cancel</span>
                    </button>
                  </div>

                  {(formData.isRefundable ?? editingItem.isRefundable ?? false) ? (
                    <div className="space-y-2 pt-1">
                      <div>
                        <label className="text-slate-700 block mb-1 font-bold text-[11px] flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-sky-600" />
                          <span>Cutoff Date & Time:</span>
                        </label>
                        <input
                          type="datetime-local"
                          value={formData.cancellationDeadline ? formData.cancellationDeadline.slice(0, 16) : ''}
                          onChange={e => setFormData({ ...formData, cancellationDeadline: e.target.value })}
                          className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-300"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 block mb-1 font-bold text-[11px]">
                          Policy Terms / Notes:
                        </label>
                        <input
                          type="text"
                          value={formData.refundPolicy || ''}
                          onChange={e => setFormData({ ...formData, refundPolicy: e.target.value })}
                          placeholder="e.g. Free cancellation until 3 days before"
                          className="w-full glass-subcard rounded-xl px-3 py-1.5 text-slate-900 font-medium text-xs border border-slate-300"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-semibold flex items-center space-x-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Non-refundable (Default): 100% cancellation fee on cancellation.</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-3 pt-3">
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-5 py-3.5 rounded-2xl glass-subcard text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Custom Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[90vh] overflow-y-auto p-7 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-slate-900">Add Trip Expense Item</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Title</label>
                <input
                  type="text"
                  placeholder="e.g. Helsinki Museum Pass"
                  value={formData.title || ''}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">Date</label>
                  <input
                    type="date"
                    value={formData.date || '2027-02-15'}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full glass-subcard rounded-2xl px-3 py-3 text-slate-900 font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">Planned INR</label>
                  <input
                    type="number"
                    placeholder="e.g. 5000"
                    value={formData.plannedCostINR || ''}
                    onChange={e => setFormData({ ...formData, plannedCostINR: Number(e.target.value) })}
                    className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  onClick={handleCreateNewBooking}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition"
                >
                  Add to Budget
                </button>
                <button
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-3.5 rounded-2xl glass-subcard text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
