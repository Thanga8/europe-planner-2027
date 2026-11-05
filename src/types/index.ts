export type BookingCategory = 'flight' | 'train' | 'stay' | 'activity' | 'visa' | 'food';

export type BookingStatus = 'not_booked' | 'reserved' | 'confirmed' | 'cancelled';

export interface TripBookingItem {
  id: string;
  date: string; // e.g. "2027-02-06"
  dayNumber: number; // 1 to 11
  category: BookingCategory;
  title: string;
  location: string;
  details: string;
  plannedCostINR: number; // From Excel
  bookedCostINR: number | null;
  bookedCostOriginal: number | null;
  bookedCurrency: 'INR' | 'EUR' | 'CHF';
  bookingStatus: BookingStatus;
  provider: string; // e.g. "Etihad / Lufthansa", "Booking.com", "VR Trains", "Apukka Resort"
  confirmationNumber: string; // PNR or Reservation Code
  cancellationDeadline: string | null; // ISO Date "2027-01-20T23:59:00"
  isRefundable: boolean;
  refundPolicy: string; // e.g. "Full refund up to 7 days before"
  cancellationFeeINR: number;
  emergencyContact: string; // Phone or support email
  bookingUrl: string;
  notes: string;
  passId?: string; // Connected pass ID in Digital Wallet
  attachment?: EncryptedDocumentAttachment; // Uploaded voucher / PDF / screenshot
  nightsCount?: number; // Number of nights if multi-night combined stay
  checkOutDate?: string; // Check-out date (e.g. "2027-02-08")
  mergedDayNumbers?: number[]; // Day numbers covered by this stay (e.g. [1, 2])
  mergedItemIds?: string[]; // IDs of constituent nightly bookings if combined
  
  // Onto-style fare tracking & price history
  currentTrackedRateINR?: number | null;
  trackedRateSource?: string;
  lastPriceCheckDate?: string;
  priceDropHistory?: PriceChangeRecord[];
}

export interface PriceChangeRecord {
  checkedAt: string;
  amountINR: number;
  source: string; // e.g. 'Google Hotels' | 'Agoda' | 'Booking.com' | 'Manual Check'
  isBooked?: boolean;
}

export type PassType = 'boarding_pass' | 'hotel_reservation' | 'activity_ticket' | 'train_ticket' | 'secure_document';

export interface EncryptedDocumentAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  isEncrypted: boolean;
  dataBase64: string; // Encrypted or raw data URL
}

export interface DigitalPass {
  id: string;
  type: PassType;
  title: string;
  subtitle: string;
  themeColor: string; // Hex or gradient
  date: string;
  time: string;
  location: string;
  provider: string;
  bookingReference: string; // PNR, Ticket #, Booking ID
  passengerName: string;
  
  // Specific for Flight / Train
  originIATA?: string;
  originCity?: string;
  destIATA?: string;
  destCity?: string;
  flightNumber?: string;
  gate?: string;
  terminal?: string;
  seat?: string;
  boardingGroup?: string;
  platform?: string;
  coachNumber?: string;

  // Specific for Hotel / Activity
  checkInTime?: string;
  checkOutTime?: string;
  roomType?: string;
  address?: string;
  activityDuration?: string;
  meetingPoint?: string;

  // Barcode / QR
  barcodeType: 'QR' | 'CODE128' | 'AZTEC';
  barcodeValue: string;
  qrImageBase64?: string; // Authentic scanned or uploaded QR/Aztec image
  barcodeSource?: 'extracted_pdf' | 'uploaded_image' | 'generated_code' | 'manual';

  // Dedicated Boarding Pass / Gate Ticket document (separate from financial invoice)
  boardingPassAttachment?: EncryptedDocumentAttachment;
  linkedBookingId?: string; // ID of the financial booking in Cancellation Radar

  // Cancellation and attachments
  cancellationDeadline?: string;
  attachments: EncryptedDocumentAttachment[];
  notes?: string;
  isFavorite?: boolean;
}

export interface VisaMilestone {
  id: string;
  label: string;
  date: string;
  isCompleted: boolean;
}

export interface VisaTrackerState {
  status: 'planning' | 'appointment_booked' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  embassy: string;
  centerLocation: string; // e.g. "VFS Global Hyderabad"
  vfsAppointmentDate: string;
  biometricsDate: string;
  submissionDate: string;
  decisionDeadlineDate: string; // Critical date to cancel free reservations if no visa
  trackingNumber: string;
  notes: string;
  checklists: {
    id: string;
    task: string;
    completed: boolean;
    requiredFor: string;
  }[];
}

export interface VaultSecurityState {
  isVaultLocked: boolean;
  hasPinSet: boolean;
  pinHash: string | null;
  pinSalt: string | null;
  autoLockMinutes: number;
  hideSensitive: boolean; // Mask PNRs, Passports, etc.
  biometricsEnabled: boolean;
  lastActiveTimestamp: number;
}

export interface DayItineraryItem {
  id: string;
  text: string;
  time?: string; // e.g. "09:00 AM", "Morning", "Afternoon", "Evening"
  completed?: boolean;
}

export interface DayItinerary {
  dayNumber: number;
  date: string; // "2027-02-06"
  dayName: string; // "Saturday"
  title: string;
  location: string;
  daylightHours: string; // e.g. "08:45 - 15:30 (Lapland ~6.7h daylight)"
  weatherTip: string;
  clothingTip: string;
  notes?: string; // Custom day scratchpad / reminders
  highlights: string[]; // Fallback list
  timelineItems?: DayItineraryItem[]; // Rich interactive timeline items with time tags & completion
  itemIds: string[]; // references TripBookingItem
}

export type PocketExpenseCategory = 'food' | 'transport' | 'shopping' | 'activity' | 'misc';

export interface PocketExpense {
  id: string;
  dayNumber: number;
  date: string; // e.g. "2027-02-06"
  description: string;
  amount: number;
  currency: 'EUR' | 'CHF' | 'INR';
  amountINR: number;
  category: PocketExpenseCategory;
  paymentMode: 'cash' | 'forex_card' | 'credit_card';
  createdAt: string;
}

export type ChecklistType = 'pre_travel' | 'daily';

export type PreTravelCategory = 
  | 'documents' 
  | 'money_forex' 
  | 'winter_clothing' 
  | 'electronics_gear' 
  | 'health_safety' 
  | 'home_departure';

export type DailyCategory = 
  | 'morning_departure' 
  | 'pocket_essentials' 
  | 'day_activity' 
  | 'evening_return';

export interface ChecklistItem {
  id: string;
  type: ChecklistType;
  category: PreTravelCategory | DailyCategory | string;
  title: string;
  subtitle?: string;
  isCompleted: boolean;
  isCustom?: boolean;
}


