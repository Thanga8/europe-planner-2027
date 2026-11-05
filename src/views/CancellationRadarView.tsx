import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Clock, 
  ExternalLink, 
  Phone, 
  CheckCircle2, 
  Flame, 
  FileText, 
  Upload, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Sparkles, 
  Check,
  Star,
  MapPin,
  ShieldCheck,
  Calendar,
  Eye,
  Download,
  FileCheck,
  Loader2,
  Paperclip,
  Search,
  RefreshCw,
  QrCode,
  TrendingDown
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { TripBookingItem, EncryptedDocumentAttachment } from '../types';
import { fileToBase64 } from '../services/crypto';
import { getItemImage } from '../data/travelImages';
import { extractTextFromPdfFile, parseBookingText, ExtractedBookingData, CandidateAmount, cleanNumber } from '../services/pdfParser';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { OntoPriceRadarCard } from '../components/OntoPriceRadarCard';
import { evaluateOntoPriceDropAndRefund } from '../services/ontoPricingService';

interface CancellationRadarViewProps {
  onOpenPass?: (passId: string) => void;
}

export const CancellationRadarView: React.FC<CancellationRadarViewProps> = ({ onOpenPass }) => {
  const { 
    bookings, 
    updateBooking, 
    itineraries,
    visaState, 
    updateVisaState, 
    vaultSecurity,
    totalRefundableAtStakeINR,
    totalNonRefundableLossINR,
    exchangeRates,
    setExchangeRates
  } = useTrip();

  const [isEmergencyMode, setIsEmergencyMode] = useState<boolean>(false);
  const [filterType, setFilterType] = useState<'to_book' | 'booked' | 'critical' | 'all'>('to_book');
  const [showAllItems, setShowAllItems] = useState<boolean>(false);
  const [showVisaDetails, setShowVisaDetails] = useState<boolean>(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  // Quick Self-Upload / Importer modal state
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [selectedItemToImport, setSelectedItemToImport] = useState<TripBookingItem | null>(null);
  const [pastedEmailText, setPastedEmailText] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [dateDiscrepancy, setDateDiscrepancy] = useState<{
    voucherDate: string;
    bookingDate: string;
    targetDayNumber?: number;
    targetDayTitle?: string;
  } | null>(null);

  // Dynamic Refundability & Cutoff fields - Non-refundable by default
  const [importIsRefundable, setImportIsRefundable] = useState<boolean>(false);
  const [importCancellationDeadline, setImportCancellationDeadline] = useState<string>('');
  const [importRefundPolicy, setImportRefundPolicy] = useState<string>('');
  const [importBookedCostINR, setImportBookedCostINR] = useState<number | ''>('');
  const [importPNR, setImportPNR] = useState<string>('');

  // Currency and live conversion state
  const [importCurrency, setImportCurrency] = useState<'INR' | 'EUR' | 'CHF'>('INR');
  const [importOriginalAmount, setImportOriginalAmount] = useState<number | ''>('');
  const [importExchangeRate, setImportExchangeRate] = useState<number>(exchangeRates.EUR || 106.25);
  const [saveRateAsDefault, setSaveRateAsDefault] = useState<boolean>(false);

  // PDF Parser State & Document Attachment Persistence
  const [isParsingPdf, setIsParsingPdf] = useState<boolean>(false);
  const [extractedNotice, setExtractedNotice] = useState<ExtractedBookingData | null>(null);
  const [candidateAmounts, setCandidateAmounts] = useState<CandidateAmount[]>([]);
  const [showRawExtractedText, setShowRawExtractedText] = useState<boolean>(false);
  const [draftAttachment, setDraftAttachment] = useState<EncryptedDocumentAttachment | null>(null);
  const [activeViewingAttachment, setActiveViewingAttachment] = useState<EncryptedDocumentAttachment | null>(null);

  const openImporterFor = (
    item: TripBookingItem, 
    prefilledAttachment?: EncryptedDocumentAttachment, 
    prefilledData?: ExtractedBookingData
  ) => {
    setSelectedItemToImport(item);
    setDraftAttachment(prefilledAttachment || item.attachment || null);
    setUploadedFile(null);
    setExtractedNotice(prefilledData || null);
    setCandidateAmounts(prefilledData?.candidateAmounts || []);
    setShowRawExtractedText(false);
    setSaveRateAsDefault(false);
    setDateDiscrepancy(null);

    // Determine initial currency and active exchange rate
    const detectedCurr = prefilledData?.detectedCurrency || item.bookedCurrency || (item.location.toLowerCase().includes('switzerland') || item.location.toLowerCase().includes('lucerne') ? 'CHF' : (item.location.toLowerCase().includes('paris') || item.location.toLowerCase().includes('france') || item.location.toLowerCase().includes('finland') || item.location.toLowerCase().includes('rovaniemi') ? 'EUR' : 'INR'));
    setImportCurrency(detectedCurr);
    const activeRate = detectedCurr === 'EUR' ? (exchangeRates.EUR || 106.25) : (detectedCurr === 'CHF' ? (exchangeRates.CHF || 110.50) : 1);
    setImportExchangeRate(activeRate);

    const origAmount = prefilledData?.detectedPriceOriginal ?? item.bookedCostOriginal ?? '';
    setImportOriginalAmount(origAmount);

    let finalINR: number | '' = '';
    if (prefilledData?.detectedPriceINR !== undefined) {
      finalINR = prefilledData.detectedPriceINR;
    } else if (item.bookedCostINR !== null) {
      finalINR = item.bookedCostINR;
    } else if (origAmount !== '' && detectedCurr !== 'INR') {
      finalINR = Math.round(Number(origAmount) * activeRate);
    } else {
      finalINR = item.plannedCostINR;
    }
    setImportBookedCostINR(finalINR);

    const isNotBooked = item.bookingStatus === 'not_booked';

    // Default to non-refundable (false) unless detected otherwise or already confirmed refundable
    let initialIsRefundable = false;
    if (prefilledData?.detectedIsRefundable !== undefined) {
      initialIsRefundable = prefilledData.detectedIsRefundable;
    } else if (!isNotBooked && item.isRefundable) {
      initialIsRefundable = true;
    }
    setImportIsRefundable(initialIsRefundable);

    if (prefilledData?.detectedCancellationDeadline) {
      setImportCancellationDeadline(prefilledData.detectedCancellationDeadline.slice(0, 16));
    } else if (item.cancellationDeadline) {
      try {
        const d = new Date(item.cancellationDeadline);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        setImportCancellationDeadline(`${yyyy}-${mm}-${dd}T${hh}:${min}`);
      } catch {
        setImportCancellationDeadline('');
      }
    } else {
      // If user toggles to refundable later, suggest 3 days before travel date
      const itemDate = new Date(item.date || '2027-02-06');
      itemDate.setDate(itemDate.getDate() - 3);
      const yyyy = itemDate.getFullYear();
      const mm = String(itemDate.getMonth() + 1).padStart(2, '0');
      const dd = String(itemDate.getDate()).padStart(2, '0');
      setImportCancellationDeadline(`${yyyy}-${mm}-${dd}T23:59`);
    }

    if (prefilledData?.detectedRefundPolicy) {
      setImportRefundPolicy(prefilledData.detectedRefundPolicy);
    } else if (initialIsRefundable) {
      setImportRefundPolicy(item.refundPolicy && !item.refundPolicy.includes('Not booked yet') ? item.refundPolicy : 'Free cancellation until cutoff date');
    } else {
      setImportRefundPolicy('Non-refundable booking');
    }
    setImportPNR(
      prefilledData?.detectedPNR || item.confirmationNumber || ''
    );
    setPastedEmailText('');
    setImportStatus(null);
    setIsImporterOpen(true);
  };

  const handleFileChange = async (file: File | null) => {
    if (!file) {
      setUploadedFile(null);
      return;
    }

    setUploadedFile(file);
    setIsParsingPdf(true);
    setExtractedNotice(null);

    try {
      // 1. Convert to Base64 for permanent encrypted on-device storage
      const base64Data = await fileToBase64(file);
      const newAttachment: EncryptedDocumentAttachment = {
        id: `att-${Date.now()}`,
        fileName: file.name,
        fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        isEncrypted: false,
        dataBase64: base64Data,
      };
      setDraftAttachment(newAttachment);

      // 2. Extract text & parse PDF fields
      if (file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf') {
        const text = await extractTextFromPdfFile(file);
        if (text && text.trim().length > 10) {
          const parsed = parseBookingText(
            text, 
            bookings.map(b => ({ id: b.id, title: b.title, location: b.location, date: b.date })),
            exchangeRates
          );
          setExtractedNotice(parsed);
          setCandidateAmounts(parsed.candidateAmounts || []);

          // Auto-prefill extracted details
          if (parsed.detectedCurrency) {
            setImportCurrency(parsed.detectedCurrency);
            const activeR = parsed.detectedCurrency === 'EUR' ? (exchangeRates.EUR || 106.25) : (parsed.detectedCurrency === 'CHF' ? (exchangeRates.CHF || 110.50) : 1);
            setImportExchangeRate(activeR);
          }
          if (parsed.detectedPriceOriginal) {
            setImportOriginalAmount(parsed.detectedPriceOriginal);
          }
          if (parsed.detectedPriceINR) {
            setImportBookedCostINR(parsed.detectedPriceINR);
          }
          if (parsed.detectedPNR) {
            setImportPNR(parsed.detectedPNR);
          }
          if (parsed.detectedIsRefundable !== undefined) {
            setImportIsRefundable(parsed.detectedIsRefundable);
          }
          if (parsed.detectedCancellationDeadline) {
            setImportCancellationDeadline(parsed.detectedCancellationDeadline.slice(0, 16));
          }
          if (parsed.detectedRefundPolicy) {
            setImportRefundPolicy(parsed.detectedRefundPolicy);
          }

          // Date Sanity Check: Verify if voucher date matches current booking itinerary date
          if (parsed.detectedCheckInDate && selectedItemToImport) {
            if (parsed.detectedCheckInDate !== selectedItemToImport.date) {
              const matchedDay = itineraries.find(d => d.date === parsed.detectedCheckInDate);
              setDateDiscrepancy({
                voucherDate: parsed.detectedCheckInDate,
                bookingDate: selectedItemToImport.date,
                targetDayNumber: matchedDay?.dayNumber,
                targetDayTitle: matchedDay?.title,
              });
            } else {
              setDateDiscrepancy(null);
            }
          }
        }
      }
    } catch (err) {
      console.warn('PDF parsing error:', err);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const handleUniversalPdfScan = async (file: File) => {
    setIsParsingPdf(true);
    try {
      const text = await extractTextFromPdfFile(file);
      const base64Data = await fileToBase64(file);
      const newAttachment: EncryptedDocumentAttachment = {
        id: `att-${Date.now()}`,
        fileName: file.name,
        fileType: file.type || 'application/pdf',
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        isEncrypted: false,
        dataBase64: base64Data,
      };

      const parsed = parseBookingText(
        text, 
        bookings.map(b => ({ id: b.id, title: b.title, location: b.location, date: b.date })),
        exchangeRates
      );

      // Match item from bookings
      let targetItem = bookings.find(b => b.id === parsed.matchedBookingId);
      if (!targetItem && parsed.detectedCheckInDate) {
        targetItem = bookings.find(b => b.date === parsed.detectedCheckInDate);
      }
      if (!targetItem) {
        targetItem = bookings.find(b => b.bookingStatus === 'not_booked') || bookings[0];
      }

      if (targetItem) {
        openImporterFor(targetItem, newAttachment, parsed);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsParsingPdf(false);
    }
  };

  const applyDeadlinePreset = (daysBefore: number) => {
    if (!selectedItemToImport) return;
    const baseDate = new Date(selectedItemToImport.date || '2027-02-06');
    baseDate.setDate(baseDate.getDate() - daysBefore);
    const yyyy = baseDate.getFullYear();
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const newDeadline = `${yyyy}-${mm}-${dd}T23:59`;
    setImportCancellationDeadline(newDeadline);
    const dateFormatted = baseDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    setImportRefundPolicy(`Free cancellation until ${dateFormatted} 23:59.`);
  };

  // Status calculator
  const getDeadlineStatus = (deadlineStr: string | null) => {
    if (!deadlineStr) return { days: null, label: 'Flexible Cancellation', urgency: 'safe' };
    const deadline = new Date(deadlineStr).getTime();
    const now = new Date().getTime();
    const diffHours = (deadline - now) / (1000 * 3600);
    const diffDays = Math.ceil(diffHours / 24);

    if (diffHours < 0) {
      return { days: diffDays, label: 'Cutoff Passed', urgency: 'expired' };
    }
    if (diffDays <= 3) {
      return { days: diffDays, label: `CRITICAL: ${diffDays}d left`, urgency: 'critical' };
    }
    if (diffDays <= 14) {
      return { days: diffDays, label: `Free cancel: ${diffDays}d left`, urgency: 'warning' };
    }
    return { days: diffDays, label: `Free cancel: ${diffDays}d left`, urgency: 'safe' };
  };

  // Sort bookings by deadline ascending
  const sortedBookings = [...bookings].sort((a, b) => {
    if (!a.cancellationDeadline && !b.cancellationDeadline) return 0;
    if (!a.cancellationDeadline) return 1;
    if (!b.cancellationDeadline) return -1;
    return new Date(a.cancellationDeadline).getTime() - new Date(b.cancellationDeadline).getTime();
  });

  const bookedItemsCount = bookings.filter(b => b.bookingStatus === 'confirmed' || b.bookingStatus === 'reserved').length;
  const pendingItemsCount = bookings.filter(b => b.bookingStatus === 'not_booked').length;
  const totalItemsCount = bookings.length;

  // Onto Price Drop Opportunities across hotel stays
  const hotelDropOpportunities = bookings
    .filter(b => b.category === 'stay')
    .map(b => evaluateOntoPriceDropAndRefund(b))
    .filter(e => e.status === 'REBOOK_AND_REFUND');

  const totalOntoSavingsINR = hotelDropOpportunities.reduce((acc, curr) => acc + curr.priceDiffINR, 0);

  // Filtered list
  const filteredBookings = sortedBookings.filter(item => {
    if (filterType === 'all') return true;
    if (filterType === 'to_book') return item.bookingStatus === 'not_booked';
    if (filterType === 'booked') return item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved';
    if (filterType === 'critical') {
      if (!item.cancellationDeadline || item.bookingStatus === 'cancelled' || item.bookingStatus === 'not_booked') return false;
      const days = (new Date(item.cancellationDeadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24);
      return days >= 0 && days <= 3;
    }
    return true;
  });

  // Limited content per page: show top 3 by default unless "showAllItems" is clicked
  const displayedBookings = showAllItems ? filteredBookings : filteredBookings.slice(0, 3);

  const toggleItemBookedStatus = (item: TripBookingItem) => {
    const isCurrentlyBooked = item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved';
    updateBooking({
      ...item,
      bookingStatus: isCurrentlyBooked ? 'not_booked' : 'confirmed',
      bookedCostINR: isCurrentlyBooked ? null : (item.bookedCostINR ?? item.plannedCostINR),
      isRefundable: isCurrentlyBooked ? false : (item.isRefundable ?? false),
      refundPolicy: isCurrentlyBooked ? 'Not booked yet' : (item.refundPolicy === 'Not booked yet' ? 'Non-refundable booking' : item.refundPolicy),
      cancellationDeadline: isCurrentlyBooked ? null : item.cancellationDeadline,
    });
  };

  const toggleTaskCompleted = (taskId: string) => {
    updateVisaState({
      ...visaState,
      checklists: visaState.checklists.map(c => 
        c.id === taskId ? { ...c, completed: !c.completed } : c
      ),
    });
  };

  // Smart Parser & Saver for booking document & updated cancellation terms
  const handleParseAndSaveImport = async () => {
    if (!selectedItemToImport) return;

    let detectedPNR = importPNR || selectedItemToImport.confirmationNumber;
    let detectedPrice = typeof importBookedCostINR === 'number' ? importBookedCostINR : (selectedItemToImport.bookedCostINR ?? selectedItemToImport.plannedCostINR);

    if (pastedEmailText) {
      const pnrMatch = pastedEmailText.match(/(?:PNR|Booking (?:Reference|ID|Number)|Confirmation(?:\s+Code)?|Reservation(?:\s+ID)?)\s*[:#]?\s*([A-Z0-9]{5,12})/i);
      if (pnrMatch && pnrMatch[1] && !importPNR) {
        detectedPNR = pnrMatch[1].toUpperCase();
      }

      const priceMatchINR = pastedEmailText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i);
      const priceMatchEUR = pastedEmailText.match(/(?:EUR|€)\s*([\d,.]+)/i);

      if (priceMatchINR && priceMatchINR[1] && (importBookedCostINR === '' || importBookedCostINR === selectedItemToImport.plannedCostINR)) {
        detectedPrice = Number(priceMatchINR[1].replace(/,/g, ''));
      } else if (priceMatchEUR && priceMatchEUR[1] && (importBookedCostINR === '' || importBookedCostINR === selectedItemToImport.plannedCostINR)) {
        const eurVal = cleanNumber(priceMatchEUR[1]);
        detectedPrice = Math.round(eurVal * importExchangeRate);
        setImportOriginalAmount(eurVal);
        setImportCurrency('EUR');
      }
    }

    const finalDeadline = importIsRefundable && importCancellationDeadline
      ? new Date(importCancellationDeadline).toISOString()
      : null;

    const finalPolicy = importRefundPolicy || (
      importIsRefundable 
        ? (finalDeadline ? `Free cancellation until ${new Date(finalDeadline).toLocaleDateString('en-GB')}` : 'Free cancellation')
        : 'Non-refundable booking'
    );

    const finalAttachment = draftAttachment || selectedItemToImport.attachment;

    if (saveRateAsDefault && importCurrency !== 'INR') {
      setExchangeRates({
        ...exchangeRates,
        [importCurrency]: importExchangeRate,
      });
    }

    updateBooking({
      ...selectedItemToImport,
      bookingStatus: 'confirmed',
      confirmationNumber: detectedPNR,
      bookedCostINR: detectedPrice,
      bookedCostOriginal: typeof importOriginalAmount === 'number' ? importOriginalAmount : (importCurrency === 'INR' ? detectedPrice : null),
      bookedCurrency: importCurrency,
      isRefundable: importIsRefundable,
      cancellationDeadline: finalDeadline,
      refundPolicy: finalPolicy,
      cancellationFeeINR: importIsRefundable ? 0 : detectedPrice,
      attachment: finalAttachment,
      notes: `${selectedItemToImport.notes ? selectedItemToImport.notes + ' • ' : ''}Voucher attached${finalAttachment ? ` (${finalAttachment.fileName})` : ''}`,
    });

    setImportStatus('Booking terms & voucher document saved successfully!');
    setTimeout(() => {
      setImportStatus(null);
      setIsImporterOpen(false);
      setPastedEmailText('');
      setUploadedFile(null);
      setExtractedNotice(null);
    }, 700);
  };

  return (
    <div className="space-y-6 pb-36 px-5 sm:px-6 pt-4 max-w-xl mx-auto">
      {/* GetYourGuide Style Hero Banner */}
      <div className={`p-6 sm:p-7 rounded-[2.2rem] transition-all ${
        isEmergencyMode
          ? 'bg-rose-50/85 backdrop-blur-2xl border border-rose-300 text-rose-900 shadow-xl'
          : 'glass-card-elevated text-slate-800'
      }`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3.5 rounded-2xl ${
              isEmergencyMode 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
                  Cancellation Radar
                </h2>
                {isEmergencyMode && (
                  <span className="text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full bg-rose-600 text-white">
                    Emergency
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-bold mt-1">
                {isEmergencyMode 
                  ? 'Follow this runbook to cancel refundable bookings.' 
                  : 'Track non-refundable risks & cutoff dates.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsEmergencyMode(!isEmergencyMode)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-black tracking-wide transition active:scale-95 shadow-sm border shrink-0 ${
              isEmergencyMode 
                ? 'bg-slate-900 text-white border-slate-900' 
                : 'glass-subcard text-rose-700 border-rose-200 hover:bg-rose-50'
            }`}
          >
            {isEmergencyMode ? 'Exit' : '⚡ Visa Rejected?'}
          </button>
        </div>

        {/* 3 Metric Pills (GYG Style) */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/70">
          <div className="glass-subcard p-4 rounded-2xl text-center">
            <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">Booked</span>
            <span className="text-xl sm:text-2xl font-black text-sky-800 block mt-1">
              {bookedItemsCount}/{totalItemsCount}
            </span>
            <span className="text-[11px] text-slate-500 font-bold block mt-0.5">{pendingItemsCount} To Book</span>
          </div>

          <div className="glass-subcard p-4 rounded-2xl text-center border-emerald-300">
            <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">Refundable</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-800 block mt-1">
              ₹{(totalRefundableAtStakeINR / 100000).toFixed(2)}L
            </span>
            <span className="text-[11px] text-emerald-700 font-bold block mt-0.5">100% Protected</span>
          </div>

          <div className="glass-subcard p-4 rounded-2xl text-center border-rose-300">
            <span className="text-[10px] text-rose-800 font-extrabold uppercase tracking-wider block">Non-Refund</span>
            <span className="text-xl sm:text-2xl font-black text-rose-800 block mt-1">
              ₹{(totalNonRefundableLossINR / 100000).toFixed(2)}L
            </span>
            <span className="text-[11px] text-rose-700 font-bold block mt-0.5">Peak Igloo</span>
          </div>
        </div>

        {/* Onto Price Drop Opportunities Alert Banner */}
        {totalOntoSavingsINR > 0 && (
          <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md flex items-center justify-between animate-in fade-in">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-white/20 text-white shrink-0">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs sm:text-sm font-black tracking-tight">
                  🎉 Onto Fare Radar: ₹{totalOntoSavingsINR.toLocaleString('en-IN')} Rebook & Refund Savings Available!
                </h4>
                <p className="text-[11px] text-emerald-100 font-medium">
                  {hotelDropOpportunities.length} hotel stay(s) dropped in price with 100% free cancellation active before cutoff.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Universal Instant PDF Scanner Banner */}
      <div className="p-4 sm:p-5 rounded-[2rem] glass-card border border-sky-200/80 shadow-md relative overflow-hidden group">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-500 text-white shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Scan Any Booking PDF or Voucher
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Auto-extracts hotel name, price, dates, PNR & cancellation policy directly from document.
              </p>
            </div>
          </div>

          <label className="cursor-pointer shrink-0 ml-3">
            <span className="px-3.5 py-2 rounded-2xl bg-slate-900 text-white font-black text-xs shadow-sm hover:bg-slate-800 transition active:scale-95 inline-flex items-center space-x-1.5">
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Choose PDF</span>
            </span>
            <input 
              type="file" 
              accept="application/pdf,image/*" 
              className="hidden" 
              onChange={e => {
                if (e.target.files?.[0]) {
                  handleUniversalPdfScan(e.target.files[0]);
                }
              }} 
            />
          </label>
        </div>

        {isParsingPdf && (
          <div className="mt-3 pt-3 border-t border-sky-100 flex items-center space-x-2 text-sky-800 text-xs font-bold animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Reading and analyzing booking voucher details with on-device parser...</span>
          </div>
        )}
      </div>

      {/* Emergency Visa Runbook (if activated) */}
      {isEmergencyMode && (
        <div className="p-6 rounded-[2.2rem] bg-rose-50/90 backdrop-blur-2xl border border-rose-300 space-y-4 shadow-xl">
          <div className="flex items-center space-x-2 text-rose-700">
            <Flame className="w-5 h-5" />
            <h3 className="text-sm font-black uppercase tracking-wider">
              Emergency Cancellation Runbook
            </h3>
          </div>
          <p className="text-xs text-rose-900 leading-relaxed font-semibold">
            Cancel refundable items in this order before deadlines expire:
          </p>

          <div className="space-y-3">
            {sortedBookings
              .filter(b => b.isRefundable && (b.bookingStatus === 'confirmed' || b.bookingStatus === 'reserved'))
              .map((item, idx) => (
                <div key={item.id} className="p-4 rounded-2xl glass-card flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black text-rose-700 uppercase">Priority #{idx + 1}</span>
                    <h4 className="text-sm font-black text-slate-900">{item.title}</h4>
                    <p className="text-xs text-slate-500 font-medium">{item.provider}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-700 block">
                      +₹{((item.bookedCostINR ?? item.plannedCostINR) - (item.cancellationFeeINR || 0)).toLocaleString('en-IN')}
                    </span>
                    <button
                      onClick={() => toggleItemBookedStatus(item)}
                      className="mt-1 px-3 py-1 rounded-xl bg-rose-600 text-white font-bold text-[10px]"
                    >
                      Cancel Now
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* GetYourGuide Style Horizontal Filter Carousel */}
      <div className="flex space-x-2.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        {[
          { id: 'to_book', label: `⏳ To Book (${pendingItemsCount})` },
          { id: 'booked', label: `✅ Booked (${bookedItemsCount})` },
          { id: 'critical', label: '🚨 Critical Cutoff' },
          { id: 'all', label: `All (${totalItemsCount})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setFilterType(tab.id as any);
              setShowAllItems(false);
            }}
            className={`px-4 py-2.5 rounded-2xl whitespace-nowrap transition font-black text-xs active:scale-95 shadow-xs ${
              filterType === tab.id
                ? 'glass-pill-active'
                : 'glass-pill text-slate-700 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* GetYourGuide Style Activity & Travel Cards (Visual Banners + Cancellation Pill) */}
      <div className="space-y-6">
        {displayedBookings.map(item => {
          const status = getDeadlineStatus(item.cancellationDeadline);
          const isBooked = item.bookingStatus === 'confirmed' || item.bookingStatus === 'reserved';
          const isExpanded = expandedItemId === item.id;
          const imageUrl = getItemImage(item.id, item.title, item.category, item.location);
          const ontoEval = item.category === 'stay' ? evaluateOntoPriceDropAndRefund(item) : null;

          return (
            <div
              key={item.id}
              className="rounded-[2.2rem] overflow-hidden glass-card hover:bg-white/85 transition-all duration-200 shadow-md group"
            >
              {/* Photo Banner with Badges (GetYourGuide Iconic Signature) */}
              <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-200">
                <img 
                  src={imageUrl} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&auto=format&fit=crop&q=80';
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/20 to-black/30" />

                {/* Top Floating Badges */}
                <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between">
                  {/* Cancellation Pill */}
                  {!isBooked ? (
                    <span className="px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md text-amber-300 text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center space-x-1.5 border border-amber-400/30">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>To Book • Pending</span>
                    </span>
                  ) : !item.isRefundable ? (
                    <span className="px-3 py-1.5 rounded-full bg-rose-600/90 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center space-x-1">
                      <span>🔒 Non-Refundable</span>
                    </span>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-full backdrop-blur-md text-[11px] font-black shadow-sm flex items-center space-x-1 ${
                      status.urgency === 'critical'
                        ? 'bg-rose-600 text-white animate-pulse'
                        : status.urgency === 'warning'
                        ? 'bg-amber-500/95 text-white'
                        : 'bg-emerald-600/90 text-white'
                    }`}>
                      <ShieldCheck className="w-3.5 h-3.5 inline mr-1" />
                      <span>{status.label}</span>
                    </span>
                  )}

                  {/* Category Pill & Onto Drop Alert */}
                  <div className="flex items-center space-x-1.5">
                    {ontoEval?.status === 'REBOOK_AND_REFUND' && (
                      <span className="px-3 py-1.5 rounded-full bg-emerald-600/95 backdrop-blur-md text-white text-[11px] font-black uppercase tracking-wider shadow-sm flex items-center space-x-1 animate-pulse">
                        <TrendingDown className="w-3.5 h-3.5" />
                        <span>Save ₹{ontoEval.priceDiffINR.toLocaleString('en-IN')}</span>
                      </span>
                    )}
                    <span className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-extrabold uppercase tracking-wider capitalize">
                      {item.category}
                    </span>
                  </div>
                </div>

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-white/90">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>{item.location.split(',')[0]}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-amber-300 text-xs font-black">
                    <Star className="w-3.5 h-3.5 fill-amber-300" />
                    <span>4.9</span>
                    <span className="text-white/80 font-medium">
                      • {item.nightsCount && item.nightsCount > 1 
                          ? `Days ${item.mergedDayNumbers ? item.mergedDayNumbers.join(', ') : item.dayNumber} (${item.nightsCount} Nights)` 
                          : `Day ${item.dayNumber}`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Body with Big Typography & Clean Details */}
              <div className="p-6">
                <div className="space-y-1">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold truncate">
                    Provided by {item.provider}
                  </p>
                </div>

                {/* Attached Voucher Badge (Saved Document Indicator) */}
                {item.attachment && (
                  <div className="mt-3 p-3 rounded-2xl bg-sky-50 border border-sky-200/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sky-950 text-xs font-bold truncate">
                      <Paperclip className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="truncate">{item.attachment.fileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveViewingAttachment(item.attachment!)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-black shrink-0 hover:bg-sky-700 flex items-center space-x-1 shadow-xs transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Voucher</span>
                    </button>
                  </div>
                )}

                {/* Price & Action Row (GYG Style) */}
                <div className="mt-4 pt-4 border-t border-white/70 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Price</span>
                    <span className="text-xl font-black text-slate-900 block">
                      ₹{(item.bookedCostINR ?? item.plannedCostINR).toLocaleString('en-IN')}
                    </span>
                    {item.bookedCurrency && item.bookedCurrency !== 'INR' && item.bookedCostOriginal && (
                      <span className="text-[10px] font-bold text-slate-500 block">
                        ({item.bookedCostOriginal} {item.bookedCurrency})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleItemBookedStatus(item)}
                      className={`px-3.5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition active:scale-95 shadow-sm border ${
                        isBooked
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isBooked ? <Check className="w-4 h-4 text-emerald-700" /> : <Clock className="w-4 h-4 text-amber-700" />}
                      <span>{isBooked ? 'Booked' : 'To Book'}</span>
                    </button>

                    <button
                      onClick={() => openImporterFor(item)}
                      className="p-2.5 rounded-2xl glass-subcard hover:bg-white text-sky-800 active:scale-95 transition shadow-xs flex items-center space-x-1"
                      title="Upload Ticket Voucher & Cancellation Policy"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable policy info & quick edit link */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-semibold pt-1">
                  <span className="font-mono">
                    Ref: {vaultSecurity.hideSensitive 
                      ? (item.confirmationNumber ? '••••••' + item.confirmationNumber.slice(-3) : 'Pending')
                      : (item.confirmationNumber || 'Pending')}
                  </span>

                  <div className="flex items-center space-x-2">
                    {item.passId && onOpenPass && (
                      <button
                        type="button"
                        onClick={() => onOpenPass(item.passId!)}
                        className="text-indigo-700 hover:text-indigo-950 font-black flex items-center space-x-1 text-[11px] bg-indigo-50/90 hover:bg-indigo-100 px-2 py-1 rounded-xl border border-indigo-200/80 transition active:scale-95"
                        title="View Gate Pass & Turnstile QR in Wallet"
                      >
                        <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Wallet Pass</span>
                      </button>
                    )}
                    <button
                      onClick={() => openImporterFor(item)}
                      className="text-emerald-700 hover:text-emerald-800 font-black flex items-center space-x-1 text-[11px] underline decoration-emerald-300 underline-offset-2"
                    >
                      <span>Update Terms & Voucher</span>
                    </button>
                    <button
                      onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                      className="text-sky-800 hover:text-sky-900 font-black flex items-center space-x-1"
                    >
                      <span>{isExpanded ? 'Hide' : 'Policy'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Onto Price Drop & Refund Evaluation Card for Stays */}
                {item.category === 'stay' && isBooked && (
                  <OntoPriceRadarCard item={item} onUpdateItem={updateBooking} />
                )}

                {/* Collapsible Details */}
                {isExpanded && (
                  <div className="mt-3 p-4 rounded-2xl glass-subcard space-y-2 text-xs text-slate-700 font-medium animate-in fade-in">
                    <p>
                      <strong>Cancellation Policy:</strong>{' '}
                      {!isBooked ? (
                        <span className="text-amber-800 font-bold">
                          Not booked yet — cancellation terms will apply once reserved.
                        </span>
                      ) : (
                        item.refundPolicy
                      )}
                    </p>
                    {isBooked && item.cancellationDeadline && (
                      <p className="text-slate-600">
                        <strong>Cutoff:</strong> {new Date(item.cancellationDeadline).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {item.emergencyContact && (
                      <p className="text-sky-800 font-bold">Emergency Helpline: {item.emergencyContact}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* "View All" progressive disclosure toggle if filtered list > 3 */}
      {filteredBookings.length > 3 && (
        <div className="text-center pt-2">
          <button
            onClick={() => setShowAllItems(!showAllItems)}
            className="px-6 py-3 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-black text-xs transition active:scale-95 shadow-xs"
          >
            {showAllItems ? 'Show Top 3 Items' : `View All ${filteredBookings.length} Bookings`}
          </button>
        </div>
      )}

      {/* Compact Schengen Visa Milestone Card */}
      <div className="p-6 rounded-[2.2rem] glass-card-elevated space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-2xl bg-sky-100 text-sky-800">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Schengen Visa Milestone
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                VFS: {new Date(visaState.vfsAppointmentDate).toLocaleDateString('en-GB')} • Decision Safe: {new Date(visaState.decisionDeadlineDate).toLocaleDateString('en-GB')}
              </p>
            </div>
          </div>
          
          <button
            onClick={() => setShowVisaDetails(!showVisaDetails)}
            className="p-2 rounded-xl glass-subcard text-slate-600 hover:text-slate-900"
          >
            {showVisaDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Expandable Schengen Checklist */}
        {showVisaDetails && (
          <div className="space-y-2 pt-2 border-t border-white/70 animate-in fade-in">
            {visaState.checklists.map(chk => (
              <button
                key={chk.id}
                onClick={() => toggleTaskCompleted(chk.id)}
                className="w-full p-3 rounded-2xl text-left text-xs flex items-center space-x-3 glass-card"
              >
                {chk.completed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-slate-400 shrink-0" />
                )}
                <span className={`text-xs flex-1 ${chk.completed ? 'line-through text-slate-400 font-medium' : 'font-bold text-slate-800'}`}>
                  {chk.task}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Self-Upload & Refundability Terms Modal */}
      {isImporterOpen && selectedItemToImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 sm:p-7 text-slate-800 shadow-2xl relative">
            <button
              onClick={() => setIsImporterOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70 shadow-xs"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 text-sky-800 mb-1">
              <Sparkles className="w-5 h-5" />
              <h3 className="text-base sm:text-lg font-black text-slate-900">Upload Voucher & Update Terms</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3 font-semibold">
              Updating <strong>{selectedItemToImport.title}</strong>
            </p>

            {/* Document Role Clarification Banner */}
            <div className="p-3 mb-4 rounded-2xl bg-indigo-50/80 border border-indigo-200/80 text-[11px] text-indigo-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>
                  <strong>Financial Voucher / Invoice:</strong> Records cost paid, cancellation deadlines & refund terms.
                </span>
              </div>
              {selectedItemToImport?.passId && onOpenPass && (
                <button
                  type="button"
                  onClick={() => {
                    const passId = selectedItemToImport.passId!;
                    setIsImporterOpen(false);
                    onOpenPass(passId);
                  }}
                  className="text-indigo-700 hover:text-indigo-950 font-black flex items-center space-x-1 shrink-0 bg-white px-2 py-1 rounded-lg border border-indigo-200 text-[10px] active:scale-95 transition"
                >
                  <QrCode className="w-3 h-3 text-indigo-600" />
                  <span>Go to Boarding Pass in Wallet →</span>
                </button>
              )}
            </div>

            {importStatus && (
              <div className="p-3.5 mb-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2 animate-in fade-in">
                <Check className="w-4 h-4 shrink-0" />
                <span>{importStatus}</span>
              </div>
            )}

            {/* Extracted Details Notice from PDF */}
            {extractedNotice && (
              <div className="p-4 mb-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-1.5 animate-in fade-in">
                <div className="flex items-center space-x-1.5 text-emerald-800 font-black">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Voucher PDF Data Extracted Successfully!</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-semibold text-emerald-900">
                  {extractedNotice.detectedProvider && (
                    <div>Provider: <strong>{extractedNotice.detectedProvider}</strong></div>
                  )}
                  {extractedNotice.detectedPriceINR && (
                    <div>Amount: <strong>₹{extractedNotice.detectedPriceINR.toLocaleString('en-IN')}</strong></div>
                  )}
                  {extractedNotice.detectedPNR && (
                    <div>Ref / PNR: <strong className="font-mono">{extractedNotice.detectedPNR}</strong></div>
                  )}
                  {extractedNotice.detectedCheckInDate && (
                    <div>Date: <strong>{extractedNotice.detectedCheckInDate}</strong></div>
                  )}
                </div>
              </div>
            )}

            {/* Date Sanity Check Discrepancy Alert */}
            {dateDiscrepancy && (
              <div className="p-4 mb-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs space-y-3 shadow-sm animate-in fade-in">
                <div className="flex items-center space-x-2 text-amber-900 font-black">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                  <span className="text-sm">Date Sanity Check: Voucher Date Discrepancy</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-white/80 border border-amber-200">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Document Voucher Date</span>
                    <span className="font-mono font-black text-rose-700 text-xs">{dateDiscrepancy.voucherDate}</span>
                    {dateDiscrepancy.targetDayNumber && (
                      <span className="text-[10px] text-slate-600 font-bold block">
                        Day {dateDiscrepancy.targetDayNumber}: {dateDiscrepancy.targetDayTitle}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Current Booking Schedule</span>
                    <span className="font-mono font-black text-slate-800 text-xs">{dateDiscrepancy.bookingDate}</span>
                    <span className="text-[10px] text-slate-600 font-bold block">
                      Day {selectedItemToImport.dayNumber}: {selectedItemToImport.title}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-amber-900 font-semibold leading-relaxed">
                  The voucher date differs from your current planned itinerary. Choose how you would like to proceed:
                </p>

                <div className="space-y-1.5 pt-1">
                  {dateDiscrepancy.targetDayNumber && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemToImport(prev => prev ? {
                          ...prev,
                          date: dateDiscrepancy.voucherDate,
                          dayNumber: dateDiscrepancy.targetDayNumber!,
                        } : null);
                        setDateDiscrepancy(null);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition active:scale-95 shadow-xs flex items-center justify-center space-x-1.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>Align Booking to Voucher Date (Move to Day {dateDiscrepancy.targetDayNumber})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setDateDiscrepancy(null)}
                    className="w-full py-2 px-3 rounded-xl glass-subcard hover:bg-white text-slate-800 font-bold text-xs border border-amber-200 transition"
                  >
                    Keep Existing Itinerary Date ({dateDiscrepancy.bookingDate})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsImporterOpen(false);
                      setDateDiscrepancy(null);
                    }}
                    className="w-full py-1.5 px-3 text-slate-500 hover:text-rose-600 font-bold text-[11px] transition text-center"
                  >
                    Stop Upload & Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4 text-xs">
              {/* 1. Document Attachment / Existing Voucher */}
              <div className="space-y-2">
                <label className="text-slate-800 font-black text-xs uppercase tracking-wider block">
                  Booking Voucher File
                </label>

                {draftAttachment ? (
                  <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-300 text-emerald-900 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <FileCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div className="truncate">
                          <span className="text-xs font-black block truncate text-slate-900">
                            {draftAttachment.fileName}
                          </span>
                          <span className="text-[10px] text-emerald-700 block">
                            {(draftAttachment.fileSize / 1024).toFixed(1)} KB • Stored encrypted on device
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setActiveViewingAttachment(draftAttachment)}
                          className="px-2.5 py-1.5 rounded-xl bg-white text-emerald-800 text-[11px] font-black shadow-xs hover:bg-emerald-100 flex items-center space-x-1 transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDraftAttachment(null)}
                          className="px-2.5 py-1.5 rounded-xl bg-white/70 text-slate-600 text-[11px] font-bold hover:bg-white transition"
                        >
                          Replace
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl glass-subcard border-2 border-dashed border-sky-300 text-center hover:bg-white/60 transition">
                    <Upload className="w-6 h-6 text-sky-600 mx-auto mb-1.5" />
                    <span className="font-bold text-slate-800 block text-xs">
                      Attach Booking PDF or Voucher Image
                    </span>
                    <span className="text-[10px] text-slate-500 block mt-0.5">
                      Extracts price, dates, hotel name & cancellation policy automatically
                    </span>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={e => handleFileChange(e.target.files?.[0] || null)}
                      className="w-full text-slate-500 text-xs mt-2"
                    />
                  </div>
                )}

                {isParsingPdf && (
                  <div className="p-3 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-bold flex items-center space-x-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                    <span>Extracting details from PDF document...</span>
                  </div>
                )}

                {/* Inspect Extracted Document Text */}
                {extractedNotice?.rawText && (
                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setShowRawExtractedText(!showRawExtractedText)}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline underline-offset-2 flex items-center space-x-1"
                    >
                      <span>{showRawExtractedText ? '▲ Hide Extracted Document Text' : '🔍 Inspect Extracted PDF Text'}</span>
                    </button>
                    {showRawExtractedText && (
                      <div className="mt-2 p-3 rounded-2xl bg-slate-900 text-slate-100 font-mono text-[10px] max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed border border-slate-800">
                        {extractedNotice.rawText}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Cancellation Policy Toggle (Refundable vs Non-Refundable - Non-Refundable by default) */}
              <div className="p-4 rounded-2xl glass-subcard space-y-3 border border-slate-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-slate-800 font-black text-xs uppercase tracking-wider">
                    Cancellation Policy
                  </label>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    importIsRefundable 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    {importIsRefundable ? 'Free Cancellation' : 'Non-Refundable (Default)'}
                  </span>
                </div>

                {/* Segmented Switch: Non-Refundable (Default) on Left */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-200/70">
                  <button
                    type="button"
                    onClick={() => {
                      setImportIsRefundable(false);
                      setImportRefundPolicy('Non-refundable booking');
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition flex items-center justify-center space-x-1.5 ${
                      !importIsRefundable
                        ? 'bg-white text-rose-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>🔒 Non-Refundable (Default)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportIsRefundable(true);
                      if (!importCancellationDeadline) {
                        applyDeadlinePreset(3);
                      }
                      if (!importRefundPolicy || importRefundPolicy === 'Non-refundable booking') {
                        setImportRefundPolicy('Free cancellation until cutoff date');
                      }
                    }}
                    className={`py-2.5 px-3 rounded-xl font-black text-xs transition flex items-center justify-center space-x-1.5 ${
                      importIsRefundable
                        ? 'bg-white text-emerald-700 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Free Cancellation</span>
                  </button>
                </div>

                {/* Dynamic Content based on Refundability */}
                {importIsRefundable ? (
                  <div className="space-y-3 pt-2 animate-in fade-in">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-slate-700 font-bold text-xs flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-sky-600" />
                          <span>Free Cancellation Until (Cutoff Date & Time):</span>
                        </label>
                      </div>
                      <input
                        type="datetime-local"
                        value={importCancellationDeadline}
                        onChange={e => setImportCancellationDeadline(e.target.value)}
                        className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-bold text-xs border border-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                        Quick Cutoff Presets (Relative to travel on {selectedItemToImport.date}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyDeadlinePreset(1)}
                          className="px-2.5 py-1.5 rounded-xl glass-subcard hover:bg-white text-slate-700 font-bold text-[11px] active:scale-95 transition"
                        >
                          24h Prior
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDeadlinePreset(3)}
                          className="px-2.5 py-1.5 rounded-xl glass-subcard hover:bg-white text-slate-700 font-bold text-[11px] active:scale-95 transition"
                        >
                          3 Days Prior
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDeadlinePreset(7)}
                          className="px-2.5 py-1.5 rounded-xl glass-subcard hover:bg-white text-slate-700 font-bold text-[11px] active:scale-95 transition"
                        >
                          7 Days Prior
                        </button>
                        <button
                          type="button"
                          onClick={() => applyDeadlinePreset(14)}
                          className="px-2.5 py-1.5 rounded-xl glass-subcard hover:bg-white text-slate-700 font-bold text-[11px] active:scale-95 transition"
                        >
                          14 Days Prior
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold text-xs block mb-1">
                        Refund Policy Notes:
                      </label>
                      <input
                        type="text"
                        value={importRefundPolicy}
                        onChange={e => setImportRefundPolicy(e.target.value)}
                        placeholder="e.g. Free cancellation until cutoff, 100% refund"
                        className="w-full glass-subcard rounded-2xl px-3.5 py-2 text-slate-900 font-semibold text-xs border border-slate-300"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold flex items-center space-x-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Protected: ₹{(Number(importBookedCostINR) || selectedItemToImport.plannedCostINR).toLocaleString('en-IN')} will be counted under 100% Refundable in your radar.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold space-y-1 animate-in fade-in">
                    <p className="font-bold flex items-center space-x-1.5 text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Marked as 100% Non-Refundable</span>
                    </p>
                    <p className="text-[11px] text-rose-700">
                      ₹{(Number(importBookedCostINR) || selectedItemToImport.plannedCostINR).toLocaleString('en-IN')} will be tracked under Non-Refundable Risk in the financial summary.
                    </p>
                  </div>
                )}
              </div>

              {/* 3. Pricing, Currency & Forex Converter */}
              <div className="space-y-3">
                {/* Interactive Currency & Forex Converter Card */}
                <div className="p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase text-indigo-950 tracking-wider flex items-center space-x-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Currency & Forex Converter</span>
                    </span>
                    {importCurrency !== 'INR' && (
                      <span className="text-[10px] text-indigo-700 font-bold bg-white/85 px-2 py-0.5 rounded-md border border-indigo-100 shadow-xs">
                        1 {importCurrency} = ₹{importExchangeRate}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Currency</label>
                      <select
                        value={importCurrency}
                        onChange={e => {
                          const curr = e.target.value as 'INR' | 'EUR' | 'CHF';
                          setImportCurrency(curr);
                          const r = curr === 'EUR' ? (exchangeRates.EUR || 106.25) : (curr === 'CHF' ? (exchangeRates.CHF || 110.50) : 1);
                          setImportExchangeRate(r);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            if (curr === 'INR') {
                              setImportBookedCostINR(importOriginalAmount);
                            } else {
                              setImportBookedCostINR(Math.round(importOriginalAmount * r));
                            }
                          }
                        }}
                        className="w-full glass-subcard rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs border border-indigo-200"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="CHF">CHF (Fr)</option>
                        <option value="INR">INR (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Original ({importCurrency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={importOriginalAmount}
                        onChange={e => {
                          const orig = e.target.value === '' ? '' : Number(e.target.value);
                          setImportOriginalAmount(orig);
                          if (orig !== '' && typeof orig === 'number' && importCurrency !== 'INR') {
                            setImportBookedCostINR(Math.round(orig * importExchangeRate));
                          } else if (orig !== '' && typeof orig === 'number' && importCurrency === 'INR') {
                            setImportBookedCostINR(orig);
                          }
                        }}
                        placeholder="e.g. 875"
                        className="w-full glass-subcard rounded-xl px-2.5 py-2 text-slate-900 font-black text-xs border border-indigo-200"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">
                        Rate (₹/{importCurrency})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        disabled={importCurrency === 'INR'}
                        value={importCurrency === 'INR' ? 1 : importExchangeRate}
                        onChange={e => {
                          const r = e.target.value === '' ? 0 : Number(e.target.value);
                          setImportExchangeRate(r);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0 && importCurrency !== 'INR') {
                            setImportBookedCostINR(Math.round(importOriginalAmount * r));
                          }
                        }}
                        className={`w-full glass-subcard rounded-xl px-2.5 py-2 text-slate-900 font-bold text-xs border border-indigo-200 ${
                          importCurrency === 'INR' ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                  </div>

                  {/* Preset quick buttons */}
                  {importCurrency === 'EUR' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-bold">Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(106.25);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 106.25));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 106.25 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        ₹106.25 (Live Market)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(108.0);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 108.0));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 108.0 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        ₹108.00 (Card Forex)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(91.5);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 91.5));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 91.5 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹91.50 (Excel Plan)
                      </button>
                    </div>
                  )}

                  {importCurrency === 'CHF' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-bold">Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(110.5);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 110.5));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 110.5 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        ₹110.50 (Live Market)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(112.0);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 112.0));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 112.0 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-indigo-900 border-indigo-200 hover:bg-indigo-100'
                        }`}
                      >
                        ₹112.00 (Card Forex)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setImportExchangeRate(94.0);
                          if (typeof importOriginalAmount === 'number' && importOriginalAmount > 0) {
                            setImportBookedCostINR(Math.round(importOriginalAmount * 94.0));
                          }
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] border transition ${
                          importExchangeRate === 94.0 
                            ? 'bg-indigo-600 text-white border-indigo-700' 
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        ₹94.00 (Excel Plan)
                      </button>
                    </div>
                  )}

                  {/* Formula banner */}
                  {importOriginalAmount !== '' && importCurrency !== 'INR' && (
                    <div className="text-[11px] text-indigo-950 font-bold bg-white/90 p-2.5 rounded-xl border border-indigo-100 flex items-center justify-between shadow-xs">
                      <span className="text-slate-600">Calculated Value:</span>
                      <span className="font-mono font-black text-xs text-indigo-950">
                        {importOriginalAmount} {importCurrency} × ₹{importExchangeRate} = ₹{(Number(importBookedCostINR) || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}

                  {importCurrency !== 'INR' && (
                    <label className="flex items-center space-x-2 pt-1 text-[11px] text-slate-600 font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveRateAsDefault}
                        onChange={e => setSaveRateAsDefault(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Save this {importCurrency} rate (₹{importExchangeRate}) as my default for future bookings</span>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 block mb-1 font-bold text-xs">
                      Confirmed Cost (INR):
                    </label>
                    <input
                      type="number"
                      value={importBookedCostINR}
                      onChange={e => {
                        const val = e.target.value === '' ? '' : Number(e.target.value);
                        setImportBookedCostINR(val);
                        if (typeof val === 'number' && typeof importOriginalAmount === 'number' && importOriginalAmount > 0 && importCurrency !== 'INR') {
                          const effRate = Number((val / importOriginalAmount).toFixed(2));
                          setImportExchangeRate(effRate);
                        }
                      }}
                      placeholder="e.g. 92969"
                      className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-black text-xs border border-slate-300"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 block mb-1 font-bold text-xs">
                      Booking PNR / Ref:
                    </label>
                    <input
                      type="text"
                      value={importPNR}
                      onChange={e => setImportPNR(e.target.value)}
                      placeholder="e.g. EY849201"
                      className="w-full glass-subcard rounded-2xl px-3.5 py-2.5 text-slate-900 font-mono font-bold text-xs border border-slate-300 uppercase"
                    />
                  </div>
                </div>

                {/* Quick 1-Tap Candidate Amounts from Document */}
                {candidateAmounts.length > 0 && (
                  <div className="p-3 rounded-2xl bg-sky-50/80 border border-sky-200/80 space-y-1.5 animate-in fade-in">
                    <span className="text-[10px] text-sky-900 font-extrabold uppercase tracking-wider block">
                      Amounts Detected in Document (Tap to Apply):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidateAmounts.map((cand, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setImportBookedCostINR(cand.amountINR);
                            if (cand.currency) {
                              setImportCurrency(cand.currency);
                              setImportOriginalAmount(cand.originalAmount);
                              const r = cand.currency === 'EUR' ? (exchangeRates.EUR || 106.25) : (cand.currency === 'CHF' ? (exchangeRates.CHF || 110.50) : 1);
                              setImportExchangeRate(r);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 border flex items-center space-x-1.5 ${
                            (importBookedCostINR === cand.amountINR || (typeof importOriginalAmount === 'number' && importOriginalAmount === cand.originalAmount))
                              ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                              : 'bg-white text-slate-800 hover:bg-sky-100 border-sky-200'
                          }`}
                        >
                          <span className="font-black">₹{cand.amountINR.toLocaleString('en-IN')}</span>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md ${
                            (importBookedCostINR === cand.amountINR || (typeof importOriginalAmount === 'number' && importOriginalAmount === cand.originalAmount))
                              ? 'bg-sky-800 text-white' 
                              : 'bg-slate-200/90 text-slate-700'
                          }`}>
                            {cand.label}
                          </span>
                          {cand.currency !== 'INR' && (
                            <span className="opacity-90 text-[10px]">({cand.originalAmount} {cand.currency})</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Optional Text Paste */}
              <div>
                <label className="text-slate-700 block mb-1 font-bold text-xs">
                  Or Paste Confirmation Email / SMS Text:
                </label>
                <textarea
                  rows={2}
                  value={pastedEmailText}
                  onChange={e => {
                    const text = e.target.value;
                    setPastedEmailText(text);
                    const parsed = parseBookingText(text);
                    if (parsed.detectedPNR) setImportPNR(parsed.detectedPNR);
                    if (parsed.detectedPriceINR) setImportBookedCostINR(parsed.detectedPriceINR);
                    if (parsed.detectedIsRefundable !== undefined) setImportIsRefundable(parsed.detectedIsRefundable);
                    if (parsed.detectedCancellationDeadline) setImportCancellationDeadline(parsed.detectedCancellationDeadline.slice(0, 16));
                    if (parsed.detectedRefundPolicy) setImportRefundPolicy(parsed.detectedRefundPolicy);
                  }}
                  placeholder="Paste email with PNR, amount, or cancellation dates..."
                  className="w-full glass-subcard rounded-2xl p-3 text-slate-900 placeholder-slate-400 text-xs border border-slate-300"
                />
              </div>

              {/* 5. Action Buttons */}
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleParseAndSaveImport}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center space-x-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Booking & Terms</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImporterOpen(false)}
                  className="px-5 py-3.5 rounded-2xl glass-subcard text-slate-700 font-bold text-xs active:scale-95 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      <DocumentViewerModal
        attachment={activeViewingAttachment}
        onClose={() => setActiveViewingAttachment(null)}
        titlePrefix="Financial Booking Voucher"
      />
    </div>
  );
};
