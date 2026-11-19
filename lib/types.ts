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

export type AppearanceMode = 'light' | 'dark';

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
  | 'defaulters'
  | 'high-risk';

export type CollectionFilterChip =
  | 'all'
  | 'due-today'
  | 'pending-due'
  | 'upcoming'
  | 'defaulters'
  | 'high-risk';

export type SortByOption =
  | 'recommended'
  | 'last-payment'
  | 'latest-activity'
  | 'due-amount'
  | 'recovery-priority';

export type CashbookEntryType = 'inflow' | 'outflow';
export type CashbookMode = 'cash' | 'upi' | 'bank';
export type StaffRole = 'owner' | 'munim' | 'cashier';
export type ActivityActionType = 'ledger' | 'bill' | 'stock' | 'galla' | 'staff' | 'account';

export interface UserProfile {
  uid: string;
  mobileNumber: string;
  language: LanguageCode;
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
  promiseDate?: string;
  promiseNote?: string;
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
  createdByName?: string;
  createdByRole?: StaffRole;
  gallaSynced?: boolean;
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
  createdByName?: string;
  estimatedCost?: number;
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

export interface CashbookEntry {
  id: string;
  ownerId: string;
  businessId: string;
  entryType: CashbookEntryType;
  mode: CashbookMode;
  category: string;
  amount: number;
  note: string;
  entryDate: string;
  linkedRefId?: string;
  actorName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface StaffMember {
  id: string;
  ownerId: string;
  businessId: string;
  name: string;
  role: StaffRole;
  phone: string;
  pinHash?: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActivityLog {
  id: string;
  ownerId: string;
  businessId: string;
  actorName: string;
  actorRole: StaffRole;
  actionType: ActivityActionType;
  summary: string;
  targetName: string;
  amount?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActiveOperator {
  staffId: string;
  name: string;
  role: StaffRole;
}

export type TrustBand = 'reliable' | 'watch' | 'high-risk';

export interface CustomerTrustScore {
  score: number;
  band: TrustBand;
  overdueDays: number;
  settledRatio: number;
  lastPaymentDaysAgo: number | null;
  recoveryTimingHint: string;
  suggestedTone: 'gentle' | 'firm' | 'urgent';
  priorityScore: number;
}

export interface DailyGallaPulse {
  todayStr: string;
  cashDrawerBalance: number;
  upiBankBalance: number;
  totalLiquidBalance: number;
  todayInflow: number;
  todayOutflow: number;
  todayCashSalesAndVasooli: number;
  todayExpenses: number;
  estimatedDailyProfit: number;
  profitBasisNote: string;
}

export interface ParchiScanResult {
  partyName: string;
  phone: string;
  direction: TxDirection;
  billDate: string;
  notes: string;
  items: BillLineItem[];
  totalAmount: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface HybridVoiceEntry {
  name: string;
  amount: number;
  type: 'credit' | 'debit';
  note: string;
}

export interface HybridVoiceParseResult {
  intent: 'entries' | 'bill' | 'balance_query' | 'daily_summary';
  entries: HybridVoiceEntry[];
  billItems: BillLineItem[];
  customerName: string;
  paymentStatus: 'paid' | 'unpaid';
  confidence: 'high' | 'medium' | 'low';
  source: 'local' | 'ai';
}

export interface AppNotificationItem {
  id: string;
  title: string;
  bullets: string[];
  actionLabel: string;
  targetAction: 'collection' | 'theme' | 'upi' | 'voice' | 'galla' | 'parchi';
  read: boolean;
  fav: boolean;
  timeLabel: string;
}
