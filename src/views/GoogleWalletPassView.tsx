import React, { useState } from 'react';
import { 
  Plus, 
  Plane, 
  Bed, 
  Ticket, 
  X, 
  Paperclip, 
  Trash2,
  Upload,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  QrCode,
  ShieldCheck,
  Maximize2
} from 'lucide-react';
import { useTrip } from '../context/TripContext';
import { DigitalPass, PassType, EncryptedDocumentAttachment } from '../types';
import { QRCodeView } from '../components/QRCodeView';
import { DocumentViewerModal } from '../components/DocumentViewerModal';
import { fileToBase64 } from '../services/crypto';
import { scanPdfForBarcode, scanImageFile } from '../services/qrScanner';

interface GoogleWalletPassViewProps {
  initialOpenPassId?: string | null;
  onClearInitialPassId?: () => void;
}

export const GoogleWalletPassView: React.FC<GoogleWalletPassViewProps> = ({
  initialOpenPassId,
  onClearInitialPassId,
}) => {
  const { passes, updatePass, addPass, deletePass, vaultSecurity } = useTrip();

  const [activeTab, setActiveTab] = useState<'all' | 'boarding_pass' | 'hotel_reservation' | 'activity_ticket'>('all');
  const [showAllPasses, setShowAllPasses] = useState<boolean>(false);
  const [inspectingPass, setInspectingPass] = useState<DigitalPass | null>(() => {
    if (initialOpenPassId) {
      return passes.find(p => p.id === initialOpenPassId) || null;
    }
    return null;
  });

  // Modal for uploading / updating boarding pass & authentic QR
  const [uploadTargetPass, setUploadTargetPass] = useState<DigitalPass | null>(null);
  const [isScanningDocument, setIsScanningDocument] = useState<boolean>(false);
  const [scanResultStatus, setScanResultStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [pendingQrImage, setPendingQrImage] = useState<string | null>(null);
  const [pendingBarcodeValue, setPendingBarcodeValue] = useState<string>('');
  const [pendingSeat, setPendingSeat] = useState<string>('');
  const [pendingGate, setPendingGate] = useState<string>('');
  const [pendingTerminal, setPendingTerminal] = useState<string>('');
  const [pendingBoardingGroup, setPendingBoardingGroup] = useState<string>('');
  const [pendingPassengerName, setPendingPassengerName] = useState<string>('');
  const [pendingAttachment, setPendingAttachment] = useState<EncryptedDocumentAttachment | null>(null);

  // Document preview viewer modal
  const [activeViewingDoc, setActiveViewingDoc] = useState<EncryptedDocumentAttachment | null>(null);

  // Form State for new pass creation
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [passType, setPassType] = useState<PassType>('boarding_pass');
  const [title, setTitle] = useState<string>('');
  const [subtitle, setSubtitle] = useState<string>('');
  const [provider, setProvider] = useState<string>('');
  const [bookingRef, setBookingRef] = useState<string>('');
  const [passengerName, setPassengerName] = useState<string>('TRAVELER / ADULT');
  const [date, setDate] = useState<string>('2027-02-06');
  const [time, setTime] = useState<string>('10:00 AM');
  const [originIATA, setOriginIATA] = useState<string>('HYD');
  const [originCity] = useState<string>('Hyderabad');
  const [destIATA, setDestIATA] = useState<string>('CDG');
  const [destCity] = useState<string>('Paris');
  const [flightNumber, setFlightNumber] = useState<string>('');
  const [seat, setSeat] = useState<string>('');
  const [gate, setGate] = useState<string>('');
  const [terminal, setTerminal] = useState<string>('');

  const filteredPasses = passes.filter(p => {
    if (activeTab === 'all') return true;
    return p.type === activeTab;
  });

  const displayedPasses = showAllPasses ? filteredPasses : filteredPasses.slice(0, 3);

  // Open the Upload Boarding Pass modal for a target pass
  const openUploadModalFor = (pass: DigitalPass) => {
    setUploadTargetPass(pass);
    setPendingQrImage(pass.qrImageBase64 || null);
    setPendingBarcodeValue(pass.barcodeValue || pass.bookingReference);
    setPendingSeat(pass.seat || '');
    setPendingGate(pass.gate || '');
    setPendingTerminal(pass.terminal || '');
    setPendingBoardingGroup(pass.boardingGroup || '');
    setPendingPassengerName(pass.passengerName || 'TRAVELER / ADULT');
    setPendingAttachment(pass.boardingPassAttachment || null);
    setScanResultStatus(null);
    setIsScanningDocument(false);
  };

  // Handle uploaded boarding pass (PDF or image)
  const handleBoardingPassFileChosen = async (file: File) => {
    setIsScanningDocument(true);
    setScanResultStatus(null);

    try {
      // 1. Prepare base64 document attachment
      const base64 = await fileToBase64(file);
      const attachment: EncryptedDocumentAttachment = {
        id: `bp-${Date.now()}`,
        fileName: file.name,
        fileType: file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        isEncrypted: false,
        dataBase64: base64,
      };
      setPendingAttachment(attachment);

      // 2. Scan for authentic 2D Barcode (QR, Aztec, PDF417)
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      const scanResult = isPdf 
        ? await scanPdfForBarcode(file)
        : await scanImageFile(file);

      if (scanResult && scanResult.qrImageBase64) {
        setPendingQrImage(scanResult.qrImageBase64);
        if (scanResult.data) {
          setPendingBarcodeValue(scanResult.data);
        }
        setScanResultStatus({
          success: true,
          message: `Authentic ${scanResult.format || 'QR'} barcode extracted! Ready for turnstiles & gates.`,
        });
      } else if (!isPdf) {
        // For uploaded images/screenshots, use the full image directly if barcode boundary wasn't isolated
        setPendingQrImage(base64);
        setScanResultStatus({
          success: true,
          message: 'Pass image loaded. Displaying your authentic boarding pass scan image.',
        });
      } else {
        setScanResultStatus({
          success: false,
          message: 'PDF attached. No standard 2D barcode isolated automatically; preview QR will be used.',
        });
      }
    } catch (err) {
      console.error('Scan error:', err);
      setScanResultStatus({
        success: false,
        message: 'Could not read document. You can upload an image screenshot directly.',
      });
    } finally {
      setIsScanningDocument(false);
    }
  };

  // Save the updated boarding pass & QR to the pass
  const handleSaveBoardingPass = () => {
    if (!uploadTargetPass) return;

    const updated: DigitalPass = {
      ...uploadTargetPass,
      boardingPassAttachment: pendingAttachment || uploadTargetPass.boardingPassAttachment,
      qrImageBase64: pendingQrImage || uploadTargetPass.qrImageBase64,
      barcodeValue: pendingBarcodeValue || uploadTargetPass.barcodeValue,
      barcodeSource: pendingQrImage ? 'extracted_pdf' : uploadTargetPass.barcodeSource,
      seat: pendingSeat || uploadTargetPass.seat,
      gate: pendingGate || uploadTargetPass.gate,
      terminal: pendingTerminal || uploadTargetPass.terminal,
      boardingGroup: pendingBoardingGroup || uploadTargetPass.boardingGroup,
      passengerName: pendingPassengerName || uploadTargetPass.passengerName,
    };

    updatePass(updated);
    if (inspectingPass?.id === updated.id) {
      setInspectingPass(updated);
    }
    setUploadTargetPass(null);
  };

  // Create a brand new pass manually
  const handleCreatePass = async () => {
    const generatedBarcode = bookingRef || 'AUTO-PASS';

    const newPass: DigitalPass = {
      id: `pass-${Date.now()}`,
      type: passType,
      title: title || (passType === 'boarding_pass' ? `${originIATA} → ${destIATA}` : 'Digital Travel Pass'),
      subtitle: subtitle || provider || 'Confirmed Pass',
      provider: provider || 'Europe Travel',
      bookingReference: bookingRef || 'AUTO-PASS',
      passengerName,
      date,
      time,
      location: `${originCity} → ${destCity}`,
      themeColor: '#0284c7',
      barcodeType: 'QR',
      barcodeValue: generatedBarcode,
      originIATA: passType === 'boarding_pass' ? originIATA : undefined,
      originCity: passType === 'boarding_pass' ? originCity : undefined,
      destIATA: passType === 'boarding_pass' ? destIATA : undefined,
      destCity: passType === 'boarding_pass' ? destCity : undefined,
      flightNumber: passType === 'boarding_pass' ? flightNumber : undefined,
      seat: passType === 'boarding_pass' ? seat : undefined,
      gate: passType === 'boarding_pass' ? gate : undefined,
      terminal: passType === 'boarding_pass' ? terminal : undefined,
      attachments: [],
    };

    addPass(newPass);
    setIsAddModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-36 md:pb-16 px-5 sm:px-8 pt-6 max-w-4xl mx-auto">
      {/* Header & Add Button */}
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono-fluid text-[11px] uppercase tracking-[0.2em] text-[#1a1a1a]/50">
            Turnstile Ready · Boarding &amp; QR Passes
          </p>
          <h1 className="font-gaegu text-4xl sm:text-5xl font-bold leading-none text-[#ff5e3a] -rotate-1 inline-block mt-1">
            Pass Wallet
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#ff5e3a] hover:bg-[#e84f2d] text-white font-extrabold text-xs active:scale-95 transition whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Pass</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex space-x-2.5 overflow-x-auto pb-1 text-xs scrollbar-none">
        {[
          { id: 'all', label: 'All Passes' },
          { id: 'boarding_pass', label: 'Flights & Trains' },
          { id: 'hotel_reservation', label: 'Stays' },
          { id: 'activity_ticket', label: 'Activities' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-2xl font-black transition active:scale-95 whitespace-nowrap shadow-xs ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white'
                : 'glass-subcard hover:bg-white text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Passes List (GetYourGuide Digital Pass Style) */}
      <div className="space-y-5">
        {displayedPasses.map(pass => {
          const hasAuthenticQr = Boolean(pass.qrImageBase64);
          const hasBoardingPassDoc = Boolean(pass.boardingPassAttachment);

          return (
            <div
              key={pass.id}
              className="glass-card-elevated rounded-[2.2rem] overflow-hidden transition-all hover:shadow-xl border border-white/80"
            >
              {/* Pass Card Header with Brand / Route Color */}
              <div 
                className="p-5 sm:p-6 text-white relative flex items-center justify-between"
                style={{ backgroundColor: pass.themeColor }}
              >
                <div className="flex items-center space-x-3 truncate">
                  <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
                    {pass.type === 'boarding_pass' ? (
                      <Plane className="w-5 h-5 text-white" />
                    ) : pass.type === 'hotel_reservation' ? (
                      <Bed className="w-5 h-5 text-white" />
                    ) : (
                      <Ticket className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="truncate">
                    <span className="text-[10px] uppercase font-black tracking-widest text-white/80 block">
                      {pass.provider}
                    </span>
                    <h3 className="text-base font-black text-white truncate">
                      {pass.title}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectingPass(pass)}
                  className="p-2 rounded-2xl bg-white/20 hover:bg-white/30 backdrop-blur-md transition active:scale-95 text-white shrink-0 ml-2"
                  title="Enlarge for Turnstile Scanning"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>

              {/* Flight / Train Route Header if applicable */}
              {pass.type === 'boarding_pass' && pass.originIATA && pass.destIATA && (
                <div className="p-5 sm:p-6 pb-2 border-b border-white/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{pass.originIATA}</div>
                      <div className="text-xs text-slate-500 font-bold">{pass.originCity}</div>
                    </div>
                    
                    <div className="flex flex-col items-center px-4">
                      <div className="w-16 sm:w-20 border-t-2 border-dashed border-sky-300 relative flex items-center justify-center my-2">
                        <Plane className="w-4 h-4 text-sky-600 absolute -top-2 bg-transparent" />
                      </div>
                      <span className="text-xs text-slate-500 font-mono font-black">{pass.flightNumber}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">{pass.destIATA}</div>
                      <div className="text-xs text-slate-500 font-bold">{pass.destCity}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Perforation Divider Line */}
              <div className="relative flex items-center justify-between px-2 -my-2.5">
                <div className="w-4 h-7 rounded-r-full glass-subcard -ml-2 border-r border-white/80" />
                <div className="flex-1 border-t-2 border-dashed border-slate-300 mx-2" />
                <div className="w-4 h-7 rounded-l-full glass-subcard -mr-2 border-l border-white/80" />
              </div>

              {/* Pass Card Details & Scannable QR */}
              <div className="p-5 sm:p-6 pt-4 glass-subcard space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-2 text-xs flex-1 pr-3">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Date</span>
                        <span className="font-black text-slate-900">{pass.date}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Time</span>
                        <span className="font-black text-slate-900">{pass.time}</span>
                      </div>
                      {pass.seat && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Seat</span>
                          <span className="font-black text-sky-800 text-sm">{pass.seat}</span>
                        </div>
                      )}
                      {pass.gate && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Gate</span>
                          <span className="font-black text-slate-900 text-sm">{pass.gate}</span>
                        </div>
                      )}
                      {pass.terminal && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Terminal</span>
                          <span className="font-black text-slate-900">{pass.terminal}</span>
                        </div>
                      )}
                      {pass.boardingGroup && (
                        <div>
                          <span className="text-slate-500 block text-[10px] uppercase tracking-wider font-extrabold">Group / Zone</span>
                          <span className="font-black text-slate-900">{pass.boardingGroup}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 flex items-center space-x-2 text-xs text-slate-500 font-bold">
                      <span>PNR:</span>
                      <span className="font-mono text-slate-900 font-black">
                        {vaultSecurity.hideSensitive
                          ? '••••••' + pass.bookingReference.slice(-3)
                          : pass.bookingReference}
                      </span>
                    </div>
                  </div>

                  {/* Scannable Mini QR / Aztec preview */}
                  <div 
                    onClick={() => setInspectingPass(pass)}
                    className="cursor-pointer shrink-0 ml-2 p-2 rounded-2xl bg-white shadow-sm border border-slate-200 flex flex-col items-center hover:scale-105 transition"
                    title="Tap to view full-screen high-brightness barcode"
                  >
                    {hasAuthenticQr ? (
                      <img 
                        src={pass.qrImageBase64} 
                        alt="Authentic Gate Barcode" 
                        className="w-[78px] h-[78px] object-contain rounded-lg"
                      />
                    ) : (
                      <QRCodeView value={pass.barcodeValue} size={78} />
                    )}
                    <span className={`text-[9px] font-black uppercase mt-1 px-1.5 py-0.5 rounded-md flex items-center space-x-1 ${
                      hasAuthenticQr 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {hasAuthenticQr ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          <span>Authentic</span>
                        </>
                      ) : (
                        <span>Preview</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Attached Boarding Pass Document (Gate Ticket PDF) */}
                {hasBoardingPassDoc && (
                  <div className="p-3 rounded-2xl bg-sky-50/90 border border-sky-200/80 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sky-950 text-xs font-bold truncate">
                      <Paperclip className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="truncate">{pass.boardingPassAttachment!.fileName}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveViewingDoc(pass.boardingPassAttachment!)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-[11px] font-black shrink-0 hover:bg-sky-700 flex items-center space-x-1 shadow-xs transition active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Pass PDF</span>
                    </button>
                  </div>
                )}

                {/* Pass Card Action Bar */}
                <div className="pt-2 border-t border-white/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => openUploadModalFor(pass)}
                    className="text-sky-800 hover:text-sky-950 font-black text-xs flex items-center space-x-1.5 py-1 px-2.5 rounded-xl glass-subcard transition active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>{hasBoardingPassDoc ? 'Update Boarding Pass & QR' : 'Upload Boarding Pass & QR'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInspectingPass(pass)}
                    className="text-slate-700 hover:text-slate-900 font-bold text-xs flex items-center space-x-1 py-1 px-2"
                  >
                    <span>Enlarge Scan</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Show All Toggle */}
      {filteredPasses.length > 3 && (
        <div className="text-center pt-1">
          <button
            onClick={() => setShowAllPasses(!showAllPasses)}
            className="px-6 py-3 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-black text-xs transition active:scale-95 shadow-xs"
          >
            {showAllPasses ? 'Show Top 3 Passes' : `View All ${filteredPasses.length} Passes`}
          </button>
        </div>
      )}

      {/* Fullscreen Pass Inspection Modal (High-Brightness Gate Scanner View) */}
      {inspectingPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-sm max-h-[92vh] overflow-y-auto p-6 text-slate-800 shadow-2xl relative">
            <button
              onClick={() => {
                setInspectingPass(null);
                if (onClearInitialPassId) onClearInitialPassId();
              }}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center pt-2 pb-3">
              <span className="text-[10px] uppercase font-black tracking-widest text-sky-800">
                {inspectingPass.type.replace('_', ' ')}
              </span>
              <h3 className="text-xl font-black text-slate-900 mt-1">{inspectingPass.title}</h3>
              <p className="text-xs text-slate-500 font-semibold">{inspectingPass.subtitle}</p>
            </div>

            {/* High-Brightness Barcode Container */}
            <div className="my-4 flex flex-col items-center justify-center p-5 bg-white rounded-3xl shadow-sm border border-slate-200">
              {inspectingPass.qrImageBase64 ? (
                <div className="text-center space-y-2">
                  <img
                    src={inspectingPass.qrImageBase64}
                    alt="Authentic Turnstile Barcode"
                    className="w-56 h-56 object-contain mx-auto"
                  />
                  <div className="flex items-center justify-center space-x-1.5 text-emerald-800 text-[11px] font-black bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Authentic Airline / Operator Scan Code</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <QRCodeView value={inspectingPass.barcodeValue} size={190} />
                  <p className="text-[10px] text-amber-800 font-bold bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                    ⚠️ Preview QR. Tap "Upload Boarding Pass" below to load your authentic turnstile barcode.
                  </p>
                </div>
              )}

              {inspectingPass.barcodeValue && (
                <span className="text-[10px] font-mono text-slate-600 font-bold mt-2 truncate max-w-[240px]">
                  {inspectingPass.barcodeValue}
                </span>
              )}
            </div>

            {/* Gate Details Grid */}
            <div className="space-y-2 text-xs glass-subcard p-4 rounded-2xl">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-white/60">
                {inspectingPass.seat && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Seat</span>
                    <span className="text-sm font-black text-sky-800">{inspectingPass.seat}</span>
                  </div>
                )}
                {inspectingPass.gate && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Gate</span>
                    <span className="text-sm font-black text-slate-900">{inspectingPass.gate}</span>
                  </div>
                )}
                {inspectingPass.terminal && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Terminal</span>
                    <span className="font-black text-slate-900">{inspectingPass.terminal}</span>
                  </div>
                )}
                {inspectingPass.boardingGroup && (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Group / Zone</span>
                    <span className="font-black text-slate-900">{inspectingPass.boardingGroup}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between py-1 border-b border-white/60">
                <span className="text-slate-500 font-bold">Passenger</span>
                <span className="font-black text-slate-900">{inspectingPass.passengerName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/60">
                <span className="text-slate-500 font-bold">Booking Ref</span>
                <span className="font-mono font-black text-sky-800">
                  {vaultSecurity.hideSensitive 
                    ? '••••••' + inspectingPass.bookingReference.slice(-3) 
                    : inspectingPass.bookingReference}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-bold">Schedule</span>
                <span className="font-black text-slate-900">{inspectingPass.date} • {inspectingPass.time}</span>
              </div>
            </div>

            {/* Action Buttons in Fullscreen Modal */}
            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  const p = inspectingPass;
                  setInspectingPass(null);
                  openUploadModalFor(p);
                }}
                className="w-full py-3 rounded-2xl bg-sky-600 text-white font-black text-xs shadow-sm hover:bg-sky-700 transition active:scale-95 flex items-center justify-center space-x-2"
              >
                <Upload className="w-4 h-4" />
                <span>Upload / Update Boarding Pass & QR</span>
              </button>

              {inspectingPass.boardingPassAttachment && (
                <button
                  type="button"
                  onClick={() => {
                    const doc = inspectingPass.boardingPassAttachment!;
                    setInspectingPass(null);
                    setActiveViewingDoc(doc);
                  }}
                  className="w-full py-2.5 rounded-2xl glass-subcard hover:bg-white text-slate-800 font-black text-xs transition active:scale-95 flex items-center justify-center space-x-1.5"
                >
                  <Eye className="w-4 h-4 text-sky-600" />
                  <span>View Original Boarding Pass PDF</span>
                </button>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/60 flex justify-end">
              <button
                onClick={() => {
                  if (confirm(`Remove pass "${inspectingPass.title}"?`)) {
                    deletePass(inspectingPass.id);
                    setInspectingPass(null);
                  }
                }}
                className="text-xs text-rose-600 hover:text-rose-700 flex items-center space-x-1 font-black"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove Pass</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Boarding Pass & Authentic QR Modal */}
      {uploadTargetPass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 sm:p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[92vh] overflow-y-auto p-6 text-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <span className="text-[10px] text-sky-800 font-black uppercase tracking-wider block">
                  Gate Document Upload
                </span>
                <h3 className="text-base font-black text-slate-900 truncate">
                  {uploadTargetPass.title}
                </h3>
              </div>
              <button 
                onClick={() => setUploadTargetPass(null)} 
                className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-[11px] text-indigo-950 font-medium space-y-1">
              <p className="font-bold flex items-center space-x-1.5 text-indigo-900">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Separate Gate Pass from Booking Invoice</span>
              </p>
              <p className="text-indigo-800">
                Upload your official boarding pass or ticket (PDF or screenshot). The authentic gate QR code will be extracted for offline turnstile scanning without any financial price clutter.
              </p>
            </div>

            {/* Document Picker Dropzone */}
            <div className="space-y-2">
              <label className="block text-slate-700 font-bold text-xs">
                Select Boarding Pass (PDF or Image Screenshot):
              </label>

              <label className="cursor-pointer block border-2 border-dashed border-sky-300 hover:border-sky-500 rounded-3xl p-5 text-center bg-white/70 hover:bg-white transition group">
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleBoardingPassFileChosen(e.target.files[0]);
                    }
                  }}
                />
                <div className="flex flex-col items-center space-y-2">
                  <div className="p-3 rounded-2xl bg-sky-100 text-sky-700 group-hover:scale-105 transition">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-black text-slate-800">
                    Choose Boarding Pass File or Screenshot
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Accepts PDF, PNG, JPG (e.g. from Etihad, SBB, TGV, or Booking.com)
                  </span>
                </div>
              </label>

              {isScanningDocument && (
                <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 flex items-center space-x-2 text-sky-800 text-xs font-bold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
                  <span>Scanning document for turnstile QR / Aztec / PDF417 barcode...</span>
                </div>
              )}

              {scanResultStatus && (
                <div className={`p-3 rounded-xl border text-xs font-bold flex items-center space-x-2 ${
                  scanResultStatus.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  {scanResultStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  )}
                  <span>{scanResultStatus.message}</span>
                </div>
              )}
            </div>

            {/* Extracted QR Code Preview */}
            {pendingQrImage && (
              <div className="p-4 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
                <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                  Scanned Gate QR Preview
                </span>
                <img 
                  src={pendingQrImage} 
                  alt="Scanned Gate QR" 
                  className="w-36 h-36 object-contain mx-auto rounded-xl shadow-xs" 
                />
                {pendingBarcodeValue && (
                  <span className="text-[10px] font-mono text-slate-600 block truncate max-w-xs mx-auto">
                    Payload: {pendingBarcodeValue}
                  </span>
                )}
              </div>
            )}

            {/* Gate Details Inputs */}
            <div className="space-y-3 pt-1 text-xs">
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                Travel Gate Details:
              </span>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Seat</label>
                  <input
                    type="text"
                    value={pendingSeat}
                    onChange={e => setPendingSeat(e.target.value)}
                    placeholder="e.g. 18A"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-black text-xs border border-slate-200 uppercase"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Gate</label>
                  <input
                    type="text"
                    value={pendingGate}
                    onChange={e => setPendingGate(e.target.value)}
                    placeholder="e.g. 24B"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-black text-xs border border-slate-200 uppercase"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Terminal</label>
                  <input
                    type="text"
                    value={pendingTerminal}
                    onChange={e => setPendingTerminal(e.target.value)}
                    placeholder="e.g. T1"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-black text-xs border border-slate-200 uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Boarding Zone / Group</label>
                  <input
                    type="text"
                    value={pendingBoardingGroup}
                    onChange={e => setPendingBoardingGroup(e.target.value)}
                    placeholder="e.g. Zone 2"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1">Passenger Name</label>
                  <input
                    type="text"
                    value={pendingPassengerName}
                    onChange={e => setPendingPassengerName(e.target.value)}
                    placeholder="e.g. TRAVELER / ADULT"
                    className="w-full glass-subcard rounded-xl px-3 py-2 text-slate-900 font-bold text-xs border border-slate-200 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleSaveBoardingPass}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition"
              >
                Save Boarding Pass to Pass Hub
              </button>
              <button
                type="button"
                onClick={() => setUploadTargetPass(null)}
                className="px-4 py-3 rounded-2xl glass-subcard text-slate-700 font-bold text-xs hover:bg-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Pass Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-5 animate-in fade-in">
          <div className="glass-card-elevated rounded-[2.5rem] w-full max-w-md max-h-[92vh] overflow-y-auto p-7 text-slate-800 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-black text-slate-900">Add Digital Pass</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 rounded-full text-slate-400 hover:text-slate-700 bg-white/70">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 block mb-1.5 font-bold">Category</label>
                <select
                  value={passType}
                  onChange={e => setPassType(e.target.value as PassType)}
                  className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-semibold"
                >
                  <option value="boarding_pass">Flight Boarding Pass</option>
                  <option value="train_ticket">Train / Rail Ticket</option>
                  <option value="hotel_reservation">Hotel Stay Voucher</option>
                  <option value="activity_ticket">Activity / Tour Pass</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">Provider</label>
                  <input
                    type="text"
                    placeholder="e.g. Etihad"
                    value={provider}
                    onChange={e => setProvider(e.target.value)}
                    className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-semibold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1.5 font-bold">PNR / Ref</label>
                  <input
                    type="text"
                    placeholder="e.g. EY849201"
                    value={bookingRef}
                    onChange={e => setBookingRef(e.target.value)}
                    className="w-full glass-subcard rounded-2xl px-4 py-3 text-slate-900 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3 pt-3">
                <button
                  onClick={handleCreatePass}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-black text-xs shadow-md active:scale-95 transition"
                >
                  Create Pass
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

      {/* Offline Document Viewer Modal */}
      <DocumentViewerModal
        attachment={activeViewingDoc}
        onClose={() => setActiveViewingDoc(null)}
        titlePrefix="Boarding Pass Document"
      />
    </div>
  );
};
