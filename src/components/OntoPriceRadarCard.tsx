import React, { useState } from 'react';
import {
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Clock,
  Sparkles,
  History,
  Tag
} from 'lucide-react';
import { TripBookingItem } from '../types';
import {
  evaluateOntoPriceDropAndRefund,
  generateHotelDeepLinks,
  recordPriceCheckOnItem,
  getMockLiveMarketRates,
  OntoEvaluationResult
} from '../services/ontoPricingService';

interface OntoPriceRadarCardProps {
  item: TripBookingItem;
  onUpdateItem: (updatedItem: TripBookingItem) => void;
}

export const OntoPriceRadarCard: React.FC<OntoPriceRadarCardProps> = ({
  item,
  onUpdateItem,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [customPriceInput, setCustomPriceInput] = useState('');
  const [customSourceInput, setCustomSourceInput] = useState('Agoda');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);

  const evaluation: OntoEvaluationResult = evaluateOntoPriceDropAndRefund(item);
  const deepLinks = generateHotelDeepLinks(item);

  // Quick simulate live market scan (mimics Onto background rate crawler)
  const handleSimulateLiveScan = () => {
    setIsUpdating(true);
    setTimeout(() => {
      const mock = getMockLiveMarketRates(item);
      const topRate = mock.suggestedRates[0];
      const updated = recordPriceCheckOnItem(item, topRate.rateINR, topRate.source);
      onUpdateItem(updated);
      setIsUpdating(false);
    }, 600);
  };

  const handleApplyCustomPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseInt(customPriceInput.replace(/[^0-9]/g, ''), 10);
    if (isNaN(priceNum) || priceNum <= 0) return;

    const updated = recordPriceCheckOnItem(item, priceNum, customSourceInput || 'Manual Check');
    onUpdateItem(updated);
    setCustomPriceInput('');
    setIsCustomModalOpen(false);
  };

  return (
    <div className="mt-4 rounded-3xl overflow-hidden border border-slate-200/80 bg-white/70 backdrop-blur-md shadow-xs transition">
      {/* Top Header Banner */}
      <div className={`p-4 flex items-center justify-between border-b ${evaluation.status === 'REBOOK_AND_REFUND'
          ? 'bg-emerald-500/10 border-emerald-200 text-emerald-950'
          : evaluation.status === 'NON_REFUNDABLE_PRICE_DROP'
            ? 'bg-amber-500/10 border-amber-200 text-amber-950'
            : evaluation.status === 'BEST_RATE_LOCKED'
              ? 'bg-sky-500/10 border-sky-200 text-sky-950'
              : 'bg-slate-500/5 border-slate-200 text-slate-900'
        }`}>
        <div className="flex items-center space-x-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${evaluation.status === 'REBOOK_AND_REFUND'
              ? 'bg-emerald-600 text-white'
              : evaluation.status === 'NON_REFUNDABLE_PRICE_DROP'
                ? 'bg-amber-600 text-white'
                : evaluation.status === 'BEST_RATE_LOCKED'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-700 text-white'
            }`}>
            {evaluation.status === 'REBOOK_AND_REFUND' ? (
              <TrendingDown className="w-4 h-4" />
            ) : evaluation.status === 'NON_REFUNDABLE_PRICE_DROP' ? (
              <AlertTriangle className="w-4 h-4" />
            ) : evaluation.status === 'BEST_RATE_LOCKED' ? (
              <ShieldCheck className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 border border-current shadow-2xs">
                Onto Fare Radar
              </span>
              {evaluation.lastCheckedAt && (
                <span className="text-[10px] font-bold text-slate-500 flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    Checked {new Date(evaluation.lastCheckedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                  </span>
                </span>
              )}
            </div>
            <h4 className="text-sm font-black tracking-tight mt-0.5">
              {evaluation.actionTitle}
            </h4>
          </div>
        </div>

        {/* Scan / Refresh Button */}
        <button
          onClick={handleSimulateLiveScan}
          disabled={isUpdating}
          className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-black flex items-center space-x-1.5 shadow-2xs active:scale-95 transition"
          title="Check live market rates across Booking, Agoda & Google Hotels"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-sky-600 ${isUpdating ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Check Fares</span>
        </button>
      </div>

      {/* Main Stats Comparison Body */}
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* 1. Booked Tariff */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Booked Tariff
            </span>
            <span className="text-base font-black text-slate-900 block mt-0.5">
              ₹{evaluation.bookedCostINR.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-slate-500 block truncate">
              {item.provider || 'Locked Rate'}
            </span>
          </div>

          {/* 2. Live Market Rate */}
          <div className={`p-3 rounded-2xl border ${evaluation.status === 'REBOOK_AND_REFUND'
              ? 'bg-emerald-50 border-emerald-200'
              : evaluation.status === 'NON_REFUNDABLE_PRICE_DROP'
                ? 'bg-amber-50 border-amber-200'
                : 'bg-slate-50 border-slate-200/60'
            }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Live Tariff
            </span>
            <span className={`text-base font-black block mt-0.5 ${evaluation.priceDiffINR > 0 ? 'text-emerald-700' : 'text-slate-900'
              }`}>
              ₹{evaluation.currentRateINR.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] font-bold text-slate-500 block truncate">
              via {evaluation.source}
            </span>
          </div>

          {/* 3. Onto Price Drop */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Price Variance
            </span>
            <span className={`text-base font-black block mt-0.5 ${evaluation.priceDiffINR > 0 ? 'text-emerald-600' : 'text-slate-700'
              }`}>
              {evaluation.priceDiffINR > 0
                ? `-₹${evaluation.priceDiffINR.toLocaleString('en-IN')}`
                : evaluation.currentRateINR > evaluation.bookedCostINR
                  ? `+₹${(evaluation.currentRateINR - evaluation.bookedCostINR).toLocaleString('en-IN')}`
                  : '₹0'}
            </span>
            <span className="text-[10px] font-bold text-slate-500 block">
              {evaluation.percentageDrop > 0 ? `${evaluation.percentageDrop}% cheaper` : 'Optimal price'}
            </span>
          </div>

          {/* 4. Refund Eligibility */}
          <div className={`p-3 rounded-2xl border ${evaluation.canCancelFree ? 'bg-sky-50 border-sky-200' : 'bg-rose-50 border-rose-200'
            }`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Refundable Amount
            </span>
            <span className={`text-base font-black block mt-0.5 ${evaluation.canCancelFree ? 'text-sky-700' : 'text-rose-700'
              }`}>
              ₹{evaluation.refundAmountINR.toLocaleString('en-IN')}
            </span>
            <span className={`text-[10px] font-bold block truncate ${evaluation.canCancelFree ? 'text-sky-600' : 'text-rose-600'
              }`}>
              {evaluation.canCancelFree ? '100% Refundable' : 'Penalty ₹' + evaluation.cancellationPenaltyINR.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* Action Strategy Alert */}
        <div className={`p-3.5 rounded-2xl text-xs leading-relaxed font-semibold border ${evaluation.status === 'REBOOK_AND_REFUND'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
            : evaluation.status === 'NON_REFUNDABLE_PRICE_DROP'
              ? 'bg-amber-50 border-amber-300 text-amber-950'
              : evaluation.status === 'BEST_RATE_LOCKED'
                ? 'bg-sky-50 border-sky-300 text-sky-950'
                : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}>
          <p>{evaluation.actionAdvice}</p>
        </div>

        {/* 1-Click Comparison Deep Links & Manual Price Input */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mr-1">
              Verify On:
            </span>
            <a
              href={deepLinks.googleHotelsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] inline-flex items-center space-x-1 transition"
            >
              <span>Google Hotels</span>
              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
            </a>
            <a
              href={deepLinks.agodaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] inline-flex items-center space-x-1 transition"
            >
              <span>Agoda</span>
              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
            </a>
            <a
              href={deepLinks.bookingComUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] inline-flex items-center space-x-1 transition"
            >
              <span>Booking.com</span>
              <ExternalLink className="w-2.5 h-2.5 text-slate-500" />
            </a>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(true)}
              className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] inline-flex items-center space-x-1 border border-indigo-200/80 transition"
            >
              <Tag className="w-3 h-3" />
              <span>Log Rate</span>
            </button>

            {item.priceDropHistory && item.priceDropHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 flex items-center space-x-1 px-2 py-1 rounded-xl hover:bg-slate-100 transition"
              >
                <History className="w-3 h-3" />
                <span>History ({item.priceDropHistory.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Price History Log */}
        {showHistory && item.priceDropHistory && item.priceDropHistory.length > 0 && (
          <div className="mt-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
              Onto Price Log History
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {item.priceDropHistory.map((rec, i) => (
                <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg bg-white border border-slate-100">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-800">{rec.source}</span>
                    {rec.isBooked && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-blue-100 text-blue-800 uppercase">
                        Booked
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">
                      ₹{rec.amountINR.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(rec.checkedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Price Log Modal */}
      {isCustomModalOpen && (
        <div className="p-4 bg-indigo-50/80 border-t border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-indigo-950 font-bold">
            Saw a new tariff online? Enter it to update the Onto Radar:
          </div>
          <form onSubmit={handleApplyCustomPrice} className="flex items-center space-x-2 w-full sm:w-auto">
            <select
              value={customSourceInput}
              onChange={e => setCustomSourceInput(e.target.value)}
              className="px-2 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-slate-800"
            >
              <option value="Agoda">Agoda</option>
              <option value="Booking.com">Booking.com</option>
              <option value="Google Hotels">Google Hotels</option>
              <option value="Official Hotel">Official Hotel</option>
            </select>
            <input
              type="text"
              placeholder="e.g. 10400"
              value={customPriceInput}
              onChange={e => setCustomPriceInput(e.target.value)}
              className="w-24 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
              autoFocus
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-xs transition"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsCustomModalOpen(false)}
              className="px-2 py-1.5 rounded-xl text-slate-500 hover:text-slate-800 text-xs font-bold"
            >
              Cancel
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
