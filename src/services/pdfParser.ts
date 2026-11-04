import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker for Vite build
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export interface CandidateAmount {
  rawText: string;
  label: string;
  currency: 'INR' | 'EUR' | 'CHF';
  originalAmount: number;
  amountINR: number;
  score: number;
}

export interface ExtractedBookingData {
  rawText: string;
  detectedTitle?: string;
  detectedProvider?: string;
  detectedPriceINR?: number;
  detectedCurrency?: 'INR' | 'EUR' | 'CHF';
  detectedPriceOriginal?: number;
  detectedPNR?: string;
  detectedCheckInDate?: string;
  detectedCheckOutDate?: string;
  detectedCancellationDeadline?: string;
  detectedIsRefundable?: boolean;
  detectedRefundPolicy?: string;
  matchedBookingId?: string;
  candidateAmounts?: CandidateAmount[];
}

export const DEFAULT_EXCHANGE_RATES = {
  EUR: 106.25, // Updated live market rate (approx ₹106.25 / EUR)
  CHF: 110.50, // Updated live market rate (approx ₹110.50 / CHF)
};

/**
 * Universal Number Parser supporting:
 * - European comma decimals: '260,00' -> 260, '1.250,50' -> 1250.5
 * - Standard comma thousands: '1,46,800.00' -> 146800, '11,850' -> 11850
 * - Trailing symbols: '11,850/-' -> 11850
 */
export function cleanNumber(str: string): number {
  if (!str) return NaN;
  const cleaned = str.trim().replace(/[/\-]$/, '').trim();
  
  // European format with comma decimal: e.g. '1.250,50' or '260,00' or '130,00'
  if (/^\d{1,3}(?:\.\d{3})*,\d{2}$/.test(cleaned) || /^\d+,\d{2}$/.test(cleaned)) {
    return parseFloat(cleaned.replace(/\./g, '').replace(',', '.'));
  }
  
  // Standard format with comma thousands: '1,46,800.00' or '11,850'
  return parseFloat(cleaned.replace(/,/g, ''));
}

/**
 * Robust extraction of all monetary values from travel document text
 */
export function extractCandidateAmounts(
  text: string, 
  rates = DEFAULT_EXCHANGE_RATES
): CandidateAmount[] {
  const candidates: CandidateAmount[] = [];
  const lines = text.split(/[\r\n]+/);

  const docHasEur = /EUR|€/.test(text);
  const docHasChf = /CHF/.test(text);

  const eurRate = rates?.EUR || DEFAULT_EXCHANGE_RATES.EUR;
  const chfRate = rates?.CHF || DEFAULT_EXCHANGE_RATES.CHF;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const prevLine = lines[i - 1] || '';
    const nextLine = lines[i + 1] || '';
    const context = (prevLine + ' ' + line + ' ' + nextLine).toLowerCase();

    // 1. Matches with currency symbol: 'INR 1,46,800', '₹ 146,800', 'EUR 130,00', '130.00 €', 'CHF 85'
    const currencyRegex = /(?:(INR|Rs\.?|₹|EUR|€|CHF)\s*([0-9.,]+)|([0-9.,]+)\s*(INR|Rs\.?|₹|EUR|€|CHF))/gi;
    let match: RegExpExecArray | null;
    while ((match = currencyRegex.exec(line)) !== null) {
      const currStr = (match[1] || match[4] || '').toUpperCase();
      const numStr = match[2] || match[3];

      const num = cleanNumber(numStr);
      if (isNaN(num) || num <= 1) continue;

      // Filter out calendar years (2025-2030) unless specifically tagged as price
      if ((num >= 2025 && num <= 2030) && !/total|amount|paid|fare|price/i.test(context)) {
        continue;
      }

      let currency: 'INR' | 'EUR' | 'CHF' = 'INR';
      let inr = num;
      if (/EUR|€/.test(currStr)) {
        currency = 'EUR';
        inr = Math.round(num * eurRate);
      } else if (/CHF/.test(currStr)) {
        currency = 'CHF';
        inr = Math.round(num * chfRate);
      } else {
        currency = 'INR';
        inr = Math.round(num);
      }

      let score = 20;
      let label = 'Amount';

      if (/tax|fee|vat|charge|city\s*tax|service\s*fee/i.test(line)) {
        score = -30;
        label = 'Tax / Fee';
      } else if (/total\s*(?:amount|price|paid|charges|fare)?|grand\s*total|amount\s*paid|paid\s*in\s*full|you\s*(?:will\s*)?pay|final\s*(?:price|amount)/i.test(line)) {
        score = 100;
        label = 'Total Paid';
      } else if (/fare|subtotal|room\s*rate|night/i.test(line)) {
        score = 40;
        label = 'Fare / Rate';
      } else if (/total|grand|amount|paid/i.test(context)) {
        score = 60;
        label = 'Likely Total';
      }

      candidates.push({
        rawText: line,
        label,
        currency,
        originalAmount: num,
        amountINR: inr,
        score
      });
    }

    // 2. Matches for lines like 'Total Amount: 146800.00' where currency is elsewhere in document
    const totalLineMatch = line.match(/(?:Total(?:\s+price|\s+amount|\s+paid)?|Grand\s+total|Amount\s+paid|You\s+pay)\s*[:#.\s-]?\s*([0-9.,]+)/i);
    if (totalLineMatch && totalLineMatch[1]) {
      const num = cleanNumber(totalLineMatch[1]);
      if (!isNaN(num) && num > 5 && !(num >= 2025 && num <= 2030)) {
        let currency: 'INR' | 'EUR' | 'CHF' = docHasEur ? 'EUR' : (docHasChf ? 'CHF' : 'INR');
        let inr = currency === 'EUR' ? Math.round(num * eurRate) : (currency === 'CHF' ? Math.round(num * chfRate) : Math.round(num));
        candidates.push({
          rawText: line,
          label: 'Total Paid',
          currency,
          originalAmount: num,
          amountINR: inr,
          score: 100
        });
      }
    }
  }

  // Sort descending by score, then amount
  candidates.sort((a, b) => b.score - a.score || b.amountINR - a.amountINR);

  // De-duplicate by amountINR
  const unique: CandidateAmount[] = [];
  const seen = new Set<number>();
  for (const c of candidates) {
    if (!seen.has(c.amountINR)) {
      seen.add(c.amountINR);
      unique.push(c);
    }
  }
  return unique;
}

/**
 * Fallback raw text extractor for PDF array buffers if pdfjs worker fails
 */
function extractTextFromRawPdfBuffer(arrayBuffer: ArrayBuffer): string {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('latin1');
    const rawString = decoder.decode(bytes);
    
    // Find text objects in PDF streams: BT ... ET
    const matches = rawString.match(/\(([^)]+)\)\s*Tj|\[([^\]]+)\]\s*TJ/g);
    if (!matches) return '';

    const textPieces: string[] = [];
    for (const match of matches) {
      const clean = match.replace(/\\([()\\])/g, '$1')
                         .replace(/[()\[\]]/g, ' ')
                         .replace(/\s*T[jJ]\s*$/, '')
                         .trim();
      if (clean.length > 1) {
        textPieces.push(clean);
      }
    }
    return textPieces.join(' ');
  } catch (err) {
    console.warn('Fallback PDF extraction failed:', err);
    return '';
  }
}

/**
 * Extract all text from an uploaded PDF File
 */
export async function extractTextFromPdfFile(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useWorkerFetch: false,
      useSystemFonts: true,
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, 6); // Read up to 6 pages
    let fullText = '';

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');
      fullText += pageText + '\n';
    }

    if (fullText.trim().length > 20) {
      return fullText;
    }
  } catch (err) {
    console.warn('pdfjs extraction encountered error, trying raw buffer fallback:', err);
  }

  // Fallback to raw string parser
  const rawFallback = extractTextFromRawPdfBuffer(arrayBuffer);
  return rawFallback || '';
}

const MONTH_MAP: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function parseDateSafely(raw: string): string | null {
  const clean = raw.trim().replace(/(?:st|nd|rd|th)/gi, '');
  
  // Format: "3 Feb 2027" or "03 February 2027"
  const m1 = clean.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = MONTH_MAP[m1[2].toLowerCase().slice(0, 3)] || 1;
    const year = parseInt(m1[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Format: "Feb 3, 2027"
  const m2 = clean.match(/([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (m2) {
    const month = MONTH_MAP[m2[1].toLowerCase().slice(0, 3)] || 1;
    const day = parseInt(m2[2], 10);
    const year = parseInt(m2[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Format: "2027-02-06"
  const m3 = clean.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m3) {
    return `${m3[1]}-${m3[2]}-${m3[3]}`;
  }

  // Format: "06/02/2027" or "06.02.2027"
  const m4 = clean.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (m4) {
    const day = parseInt(m4[1], 10);
    const month = parseInt(m4[2], 10);
    const year = parseInt(m4[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return null;
}

/**
 * Smart heuristic parser for extracted travel booking text (PDF or pasted text)
 */
export function parseBookingText(
  text: string, 
  knownBookings?: Array<{ id: string; title: string; location: string; date: string }>,
  rates = DEFAULT_EXCHANGE_RATES
): ExtractedBookingData {
  const result: ExtractedBookingData = {
    rawText: text,
  };

  if (!text || text.trim().length === 0) {
    return result;
  }

  // 1. Extract and rank all monetary values using active exchange rates
  const candidateAmounts = extractCandidateAmounts(text, rates);
  result.candidateAmounts = candidateAmounts;

  if (candidateAmounts.length > 0) {
    const bestAmount = candidateAmounts[0];
    result.detectedPriceINR = bestAmount.amountINR;
    result.detectedCurrency = bestAmount.currency;
    result.detectedPriceOriginal = bestAmount.originalAmount;
  }

  // 2. Detect PNR / Confirmation / Booking Number
  const pnrPatterns = [
    /(?:Confirmation\s*(?:number|no|code|ID)?|Booking\s*(?:reference|ref|number|no|ID|code)?|Reservation\s*(?:number|no|ID|code)?|PNR(?:\s*number)?)\s*[:#.\s-]?\s*([A-Z0-9-]{5,18})/i,
    /(?:Booking\s*#|Confirmation\s*#|Reservation\s*#)\s*([A-Z0-9-]{5,18})/i,
    /(?:Reference|Ref|Code|ETicket|E-Ticket\s*no)\s*[:#.\s-]?\s*([A-Z0-9-]{5,15})/i,
  ];

  for (const regex of pnrPatterns) {
    const match = text.match(regex);
    if (match && match[1]) {
      const candidate = match[1].trim().toUpperCase();
      if (!['NUMBER', 'CONFIRMATION', 'BOOKING', 'DETAILS', 'STATUS', 'INCLUDED', 'CONFIRMED', 'RESERVATION'].includes(candidate)) {
        result.detectedPNR = candidate;
        break;
      }
    }
  }

  // 3. Detect Cancellation Policy & Cutoff Date
  const freeCancelRegex = /(?:Free\s+cancellation|cancellation\s+free\s+of\s+charge|cancel\s+for\s+free|100%\s+refund|fully\s+refundable|refundable\s+until)/i;
  const nonRefundRegex = /(?:Non-refundable|Strict\s+policy|No\s+refund|non\s+refundable)/i;

  if (freeCancelRegex.test(text)) {
    result.detectedIsRefundable = true;
    
    // Look for deadline date: e.g. "before 3 Feb 2027 23:59" or "until Feb 3, 2027" or "until 03/02/2027"
    const deadlineMatch = text.match(/(?:until|before|prior\s+to|by)\s*[:\s]*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+[0-9]{4}(?:\s*(?:at\s*)?[0-9]{1,2}:[0-9]{2}(?:\s*(?:AM|PM|CET|UTC))?)?)/i) ||
                          text.match(/(?:until|before)\s*[:\s]*([A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}(?:\s*(?:at\s*)?[0-9]{1,2}:[0-9]{2})?)/i) ||
                          text.match(/(?:until|before)\s*[:\s]*([0-9]{1,2}[./-][0-9]{1,2}[./-][0-9]{4})/i);

    if (deadlineMatch && deadlineMatch[1]) {
      const datePart = parseDateSafely(deadlineMatch[1]);
      if (datePart) {
        // Extract time if present
        const timeMatch = deadlineMatch[1].match(/(\d{1,2}):(\d{2})/);
        const timeStr = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : '23:59';
        result.detectedCancellationDeadline = `${datePart}T${timeStr}:00`;
        result.detectedRefundPolicy = `Free cancellation until ${deadlineMatch[1].trim()}`;
      } else {
        result.detectedRefundPolicy = `Free cancellation until ${deadlineMatch[1].trim()}`;
      }
    } else {
      result.detectedRefundPolicy = 'Free cancellation (cutoff date flexible or not specified in text)';
    }
  } else if (nonRefundRegex.test(text)) {
    result.detectedIsRefundable = false;
    result.detectedCancellationDeadline = undefined;
    result.detectedRefundPolicy = '100% Non-refundable booking';
  }

  // 4. Detect Dates (Check-in, Check-out or Flight dates)
  const checkInMatch = text.match(/(?:Check-in|Arrival|Departure|Date|Flight\s+Date)\s*[:\s]*([0-9]{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+[0-9]{4}|[A-Za-z]{3,9}\s+[0-9]{1,2},?\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})/i);
  if (checkInMatch && checkInMatch[1]) {
    const dStr = parseDateSafely(checkInMatch[1]);
    if (dStr) {
      result.detectedCheckInDate = dStr;
    }
  }

  // 5. Match with known bookings in trip if provided
  if (knownBookings && knownBookings.length > 0) {
    const lowerText = text.toLowerCase();
    let highestScore = 0;

    for (const b of knownBookings) {
      let score = 0;
      const titleTerms = b.title.toLowerCase().split(/[\s,–—\-✈]+/).filter(t => t.length > 3);
      const locTerms = b.location.toLowerCase().split(/[\s,–—\-↔]+/).filter(t => t.length > 3);
      
      for (const term of titleTerms) {
        if (lowerText.includes(term)) score += 2;
      }
      for (const term of locTerms) {
        if (lowerText.includes(term)) score += 1;
      }

      if (result.detectedCheckInDate && b.date === result.detectedCheckInDate) {
        score += 3;
      }

      if (score > highestScore && score >= 2) {
        highestScore = score;
        result.matchedBookingId = b.id;
        result.detectedTitle = b.title;
      }
    }
  }

  // 6. Detect Hotel / Property or Service Name
  const hotelPropertyMatch = text.match(/(?:Property|Hotel|Accommodation|Apartment|Resort)\s*(?:name)?\s*[:#.\s-]?\s*([^\n\r,.;]{4,50})/i);
  if (hotelPropertyMatch && hotelPropertyMatch[1]) {
    const candidateName = hotelPropertyMatch[1].trim();
    if (!result.detectedTitle) {
      result.detectedTitle = candidateName;
    }
  }

  // 7. Detect Provider
  if (/booking\.com/i.test(text)) {
    result.detectedProvider = 'Booking.com';
  } else if (/airbnb/i.test(text)) {
    result.detectedProvider = 'Airbnb';
  } else if (/etihad/i.test(text)) {
    result.detectedProvider = 'Etihad Airways';
  } else if (/lufthansa/i.test(text)) {
    result.detectedProvider = 'Lufthansa';
  } else if (/vr\s*(?:group|finland|trains)/i.test(text)) {
    result.detectedProvider = 'VR Group Finland';
  } else if (/sncf|tgv/i.test(text)) {
    result.detectedProvider = 'SNCF Lyria';
  } else if (/apukka/i.test(text)) {
    result.detectedProvider = 'Apukka Resort';
  } else if (/icebreaker|polar\s*explorer/i.test(text)) {
    result.detectedProvider = 'Polar Explorer Icebreaker';
  } else if (/titlis/i.test(text)) {
    result.detectedProvider = 'Mt. Titlis Cableways';
  } else if (/lindt/i.test(text)) {
    result.detectedProvider = 'Lindt Home of Chocolate';
  }

  return result;
}
