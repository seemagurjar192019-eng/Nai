export type LanguageCode =
  | 'en'
  | 'hi'
  | 'hinglish'
  | 'mr'
  | 'gu'
  | 'ta'
  | 'te'
  | 'pa'
  | 'ml'
  | 'kn'
  | 'bn';

export type AccentTheme = 'green' | 'crimson';
export type AppearanceMode = 'light' | 'dark' | 'system';

export type AccountKind = 'customer' | 'supplier';
export type TxDirection = 'given' | 'received';
export type BillDocType = 'bill' | 'quote';
export type BillTemplateId = 'classic' | 'modern' | 'gst-color' | 'thermal-58';

export type LedgerFilterChip =
  | 'customer'
  | 'supplier'
  | 'due-today'
  | 'pending-due'
  | 'upcoming-due'
  | 'defaulters';

export type CollectionFilterChip =
  | 'all'
  | 'due-today'
  | 'pending-due'
  | 'upcoming'
  | 'defaulters';

export type SortByOption =
  | 'recommended'
  | 'last-payment'
  | 'latest-activity'
  | 'due-amount';

export interface UserProfile {
  uid: string;
  mobileNumber: string;
  language: LanguageCode;
  accentTheme: AccentTheme;
  appearance: AppearanceMode;
  activeBusinessId: string;
  appLockPin: string;
  onboardingDone: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  gstNumber: string;
  businessType: string;
  category: string;
  address: string;
  email: string;
  about: string;
  upiId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LedgerAccount {
  id: string;
  ownerId: string;
  businessId: string;
  kind: AccountKind;
  name: string;
  phone: string;
  dueDate: string;
  creditLimit?: number;
  balance: number;
  lastNote: string;
  lastActivityAt: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LedgerTransaction {
  id: string;
  ownerId: string;
  businessId: string;
  accountId: string;
  direction: TxDirection;
  amount: number;
  note: string;
  billDate: string;
  voiceRaw: string;
  billImage: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BillLineItem {
  name: string;
  qty: number;
  rate: number;
  gstRate: number;
  stockItemId?: string;
}

export type BillPaymentStatus = 'paid' | 'unpaid' | 'partial';

export interface BillDocument {
  id: string;
  ownerId: string;
  businessId: string;
  docType: BillDocType;
  billNumber: string;
  customerName: string;
  customerPhone: string;
  items: BillLineItem[];
  subtotal: number;
  totalGst: number;
  discountAmount?: number;
  totalAmount: number;
  paymentStatus?: BillPaymentStatus;
  linkedTxId?: string;
  templateId: BillTemplateId;
  notes: string;
  billDate: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StockItem {
  id: string;
  ownerId: string;
  businessId: string;
  name: string;
  unit: string;
  salePrice: number;
  purchasePrice?: number;
  quantity: number;
  lowStockThreshold: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AppNotificationItem {
  id: string;
  title: string;
  bullets: string[];
  actionLabel: string;
  targetAction: 'collection' | 'theme' | 'upi' | 'voice';
  read: boolean;
  fav: boolean;
  timeLabel: string;
}
