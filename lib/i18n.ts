import type { LanguageCode } from './types';

export const UCRED_LOGO_PATH =
  '/assets/aistudio/Meta_AI_917045015_1478484944227547_3671959198306789604_n_20261118_173633_2bf77e53.webp';

export interface LanguageOption {
  code: LanguageCode;
  nativeName: string;
  englishName: string;
  tintLight: string;
  tintDark: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', tintLight: '#FDE8EA', tintDark: 'rgba(220, 38, 38, 0.16)' },
  { code: 'hi', nativeName: 'हिंदी', englishName: 'Hindi', tintLight: '#E7F2FD', tintDark: 'rgba(37, 99, 235, 0.16)' },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', tintLight: '#EAF7EC', tintDark: 'rgba(22, 163, 74, 0.16)' },
  { code: 'hinglish', nativeName: 'Hinglish', englishName: 'Hindi in English', tintLight: '#E6F7F7', tintDark: 'rgba(13, 148, 136, 0.16)' },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', tintLight: '#FEF8E3', tintDark: 'rgba(202, 138, 4, 0.16)' },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', tintLight: '#FDF1E5', tintDark: 'rgba(234, 88, 12, 0.16)' },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', tintLight: '#F4ECFB', tintDark: 'rgba(147, 51, 234, 0.16)' },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', tintLight: '#FCEBF3', tintDark: 'rgba(219, 39, 119, 0.16)' },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', tintLight: '#E8F7FB', tintDark: 'rgba(8, 145, 178, 0.16)' },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', tintLight: '#F0F1F4', tintDark: 'rgba(100, 116, 139, 0.18)' },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bangla', tintLight: '#FDF0EE', tintDark: 'rgba(225, 29, 72, 0.16)' },
];

export interface UIStrings {
  appName: string;
  selectLanguage: string;
  enterMobileTitle: string;
  mobileLabel: string;
  agreePrefix: string;
  continueGoogle: string;
  verificationSuccess: string;
  welcomeFamily: string;
  welcomeSub: string;
  startBtn: string;
  setupBusiness: string;
  businessPrompt: string;
  businessSub: string;
  skip: string;
  tabLedger: string;
  tabCollection: string;
  tabBills: string;
  tabMore: string;
  customer: string;
  supplier: string;
  dueToday: string;
  pendingDue: string;
  upcomingDue: string;
  defaulters: string;
  netBalance: string;
  youGet: string;
  youPay: string;
  accounts: string;
  addCustomer: string;
  addSupplier: string;
  oneClickVasooli: string;
  voiceEntry: string;
  received: string;
  given: string;
  due: string;
  advance: string;
  settled: string;
  settings: string;
  sendWhatsapp: string;
  callNow: string;
}

const EN_STRINGS: UIStrings = {
  appName: 'Ucred',
  selectLanguage: 'Select your Language',
  enterMobileTitle: 'Enter Your Mobile Number',
  mobileLabel: 'Mobile Number',
  agreePrefix: 'I agree to share my phone number for login. See our',
  continueGoogle: 'Continue with Google (Free Sync)',
  verificationSuccess: 'Verification Successful',
  welcomeFamily: 'Welcome to Ucred Family',
  welcomeSub: 'Add your shop name to start Voice Khata, AI Parchi & Live Galla',
  startBtn: 'Start',
  setupBusiness: 'Setup Business',
  businessPrompt: 'Add your business/shop name',
  businessSub: 'This will help your customers identify your business/shop.',
  skip: 'Skip',
  tabLedger: 'Ledger',
  tabCollection: 'Collection',
  tabBills: 'Bills',
  tabMore: 'More',
  customer: 'Customer',
  supplier: 'Supplier',
  dueToday: 'Due Today',
  pendingDue: 'Pending Due',
  upcomingDue: 'Upcoming Due',
  defaulters: 'Defaulters',
  netBalance: 'Net Balance',
  youGet: 'You Get',
  youPay: 'You Give',
  accounts: 'Accounts',
  addCustomer: 'Add Customer',
  addSupplier: 'Add Supplier',
  oneClickVasooli: '1-Click Vasooli',
  voiceEntry: 'Voice & Counter',
  received: 'Received',
  given: 'Given',
  due: 'Due',
  advance: 'Advance',
  settled: 'Settled',
  settings: 'Settings',
  sendWhatsapp: 'Send WhatsApp',
  callNow: 'Call',
};

const HI_STRINGS: UIStrings = {
  appName: 'यूक्रेड (Ucred)',
  selectLanguage: 'अपनी भाषा चुनें',
  enterMobileTitle: 'अपना मोबाइल नंबर दर्ज करें',
  mobileLabel: 'मोबाइल नंबर',
  agreePrefix: 'मैं लॉगिन के लिए अपना फ़ोन नंबर साझा करने से सहमत हूँ। देखें',
  continueGoogle: 'Google से जारी रखें (मुफ़्त सिंक)',
  verificationSuccess: 'सत्यापन सफल रहा',
  welcomeFamily: 'Ucred परिवार में आपका स्वागत है',
  welcomeSub: 'अपनी दुकान का नाम जोड़ें और बोलकर डिजिटल खाता व गल्ला शुरू करें',
  startBtn: 'शुरू करें',
  setupBusiness: 'व्यापार सेटअप',
  businessPrompt: 'अपनी दुकान / व्यापार का नाम लिखें',
  businessSub: 'इससे ग्राहकों को आपकी दुकान पहचानने में मदद मिलेगी।',
  skip: 'छोड़ें',
  tabLedger: 'खाता',
  tabCollection: 'वसूली',
  tabBills: 'बिल',
  tabMore: 'अन्य',
  customer: 'ग्राहक',
  supplier: 'सप्लायर',
  dueToday: 'आज बकाया',
  pendingDue: 'बकाया',
  upcomingDue: 'आने वाला',
  defaulters: 'पुराने बकाया',
  netBalance: 'कुल बैलेंस',
  youGet: 'आपको मिलेंगे',
  youPay: 'आपको देने हैं',
  accounts: 'खाते',
  addCustomer: 'ग्राहक जोड़ें',
  addSupplier: 'सप्लायर जोड़ें',
  oneClickVasooli: '1-क्लिक वसूली',
  voiceEntry: 'बोल के लिखो',
  received: 'मिला (जमा)',
  given: 'दिया (उधार)',
  due: 'बाकी',
  advance: 'जमा',
  settled: 'हिसाब बराबर',
  settings: 'सेटिंग्स',
  sendWhatsapp: 'व्हाट्सएप भेजें',
  callNow: 'कॉल करें',
};

const HINGLISH_STRINGS: UIStrings = {
  appName: 'Ucred',
  selectLanguage: 'Apni Bhasha Chunein',
  enterMobileTitle: 'Apna Mobile Number Daalein',
  mobileLabel: 'Mobile Number',
  agreePrefix: 'Main login ke liye apna phone number share karne se sehmat hoon. Dekhein',
  continueGoogle: 'Google se Continue Karein (Free Sync)',
  verificationSuccess: 'Verification Safal Hua',
  welcomeFamily: 'Ucred Family mein Swagat Hai',
  welcomeSub: 'Apni dukaan ka naam daalein aur Voice Khata, AI Parchi & Galla shuru karein',
  startBtn: 'Shuru Karein',
  setupBusiness: 'Dukaan Setup',
  businessPrompt: 'Apni dukaan / business ka naam likhein',
  businessSub: 'Isse customers ko aapki dukaan pehchaanne mein aasaani hogi.',
  skip: 'Skip Karein',
  tabLedger: 'Khata',
  tabCollection: 'Vasooli',
  tabBills: 'Bills',
  tabMore: 'More',
  customer: 'Customer',
  supplier: 'Supplier',
  dueToday: 'Aaj Baaki',
  pendingDue: 'Pending Udhaar',
  upcomingDue: 'Aane Wala',
  defaulters: 'Purana Baaki',
  netBalance: 'Net Balance',
  youGet: 'Aapko Milenge',
  youPay: 'Aapko Dene Hain',
  accounts: 'Khate',
  addCustomer: 'Customer Jodein',
  addSupplier: 'Supplier Jodein',
  oneClickVasooli: '1-Click Vasooli',
  voiceEntry: 'Voice & Counter',
  received: 'Mila (Jama)',
  given: 'Diya (Udhaar)',
  due: 'Baaki',
  advance: 'Advance',
  settled: 'Hisaab Clear',
  settings: 'Settings',
  sendWhatsapp: 'WhatsApp Bhejein',
  callNow: 'Call',
};

export function getUIStrings(lang: LanguageCode): UIStrings {
  if (lang === 'hi' || lang === 'mr') return HI_STRINGS;
  if (lang === 'hinglish') return HINGLISH_STRINGS;
  return EN_STRINGS;
}

const AVATAR_COLORS = [
  '#161514',
  '#4A4238',
  '#0F8A4B',
  '#1D4ED8',
  '#B45309',
  '#9A1B1E',
  '#0F766E',
];

export function getAvatarColor(name: string): string {
  const s = String(name || 'A');
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    sum += s.charCodeAt(i);
  }
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function formatINR(num: number): string {
  const n = Math.round(Number(num) || 0);
  const abs = Math.abs(n);
  let formatted = String(abs);
  try {
    formatted = abs.toLocaleString('en-IN');
  } catch {
    formatted = String(abs);
  }
  return (n < 0 ? '-₹' : '₹') + formatted;
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return (
      d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return iso;
  }
}

export function formatTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function formatDateHeading(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recent';
    const today = new Date();
    const yest = new Date();
    yest.setDate(today.getDate() - 1);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return 'Recent';
  }
}

export function buildUpiUri(upiId: string, shopName: string, amount?: number): string {
  const cleanPa = upiId.trim();
  if (!cleanPa) return '';
  const params = new URLSearchParams({
    pa: cleanPa,
    pn: (shopName || 'Ucred Shop').slice(0, 40),
    cu: 'INR',
  });
  if (amount && amount > 0) {
    params.set('am', String(Math.round(amount * 100) / 100));
  }
  return `upi://pay?${params.toString()}`;
}

export function buildReminderMessage(params: {
  customerName: string;
  amount: number;
  shopName: string;
  upiId?: string;
  language: LanguageCode;
}): string {
  const amtText = formatINR(Math.abs(params.amount));
  const upiLink = params.upiId
    ? `\nPay via UPI (${params.upiId}): ${buildUpiUri(params.upiId, params.shopName, Math.abs(params.amount))}`
    : '';
  if (params.language === 'hi' || params.language === 'mr') {
    return `नमस्ते ${params.customerName} जी, ${params.shopName} पर आपका ${amtText} उधार बाकी है। कृपया समय पर भुगतान करें। धन्यवाद!${upiLink}`;
  }
  if (params.language === 'hinglish') {
    return `Namaste ${params.customerName} ji, aapka ${amtText} udhaar ${params.shopName} par baaki hai. Kripya jaldi payment kar dein. Dhanyavaad!${upiLink}`;
  }
  return `Hello ${params.customerName}, a payment of ${amtText} is pending at ${params.shopName}. Kindly settle at your convenience. Thank you!${upiLink}`;
}

export function buildWhatsAppUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const cleanPhone = digits.length === 10 ? `91${digits}` : digits;
  const encoded = encodeURIComponent(text);
  return cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

export function buildTransactionSlipMessage(params: {
  customerName: string;
  direction: 'given' | 'received';
  amount: number;
  newBalance: number;
  shopName: string;
  upiId?: string;
  language: LanguageCode;
}): string {
  const txAmt = formatINR(params.amount);
  const absBal = formatINR(Math.abs(params.newBalance));
  const balStatus =
    params.newBalance > 0 ? 'Due' : params.newBalance < 0 ? 'Advance' : 'Settled';
  const upiLine =
    params.upiId && params.newBalance > 0
      ? `\nPay via UPI (${params.upiId}): ${buildUpiUri(params.upiId, params.shopName, params.newBalance)}`
      : '';

  if (params.language === 'hi' || params.language === 'mr') {
    const action = params.direction === 'given' ? `${txAmt} उधार जोड़ा गया` : `${txAmt} जमा मिला`;
    return `${params.shopName} रसीद:\n${params.customerName} जी, आज ${action}।\nनया बैलेंस: ${absBal} (${params.newBalance > 0 ? 'बाकी' : params.newBalance < 0 ? 'जमा' : 'बराबर'})${upiLine}`;
  }
  if (params.language === 'hinglish') {
    const action = params.direction === 'given' ? `${txAmt} Udhaar likha gaya` : `${txAmt} Jama mila`;
    return `${params.shopName} Receipt:\n${params.customerName} ji, aaj ${action}.\nNaya Balance: ${absBal} (${params.newBalance > 0 ? 'Baaki' : params.newBalance < 0 ? 'Advance' : 'Clear'})${upiLine}`;
  }
  const action = params.direction === 'given' ? `${txAmt} Credit added` : `${txAmt} Payment received`;
  return `${params.shopName} Receipt:\n${params.customerName}, ${action}.\nUpdated Balance: ${absBal} ${balStatus}${upiLine}`;
}

export function buildDailyMunimScript(params: {
  givenToday: number;
  receivedToday: number;
  overdueCount: number;
  lowStockCount: number;
  shopName: string;
  language: LanguageCode;
  gallaCash?: number;
}): string {
  const net = params.receivedToday - params.givenToday;
  const given = Math.round(params.givenToday);
  const rec = Math.round(params.receivedToday);
  const netAbs = Math.round(Math.abs(net));
  const gallaNote =
    params.gallaCash !== undefined
      ? params.language === 'en'
        ? ` Galla cash drawer balance is ${Math.round(params.gallaCash)} rupees.`
        : ` Aaj galla mein ${Math.round(params.gallaCash)} rupaye cash hai.`
      : '';

  if (params.language === 'en') {
    return `${params.shopName} daily closing summary. Today credit given is ${given} rupees, payment received is ${rec} rupees, net cashflow is ${net >= 0 ? 'plus' : 'minus'} ${netAbs} rupees.${gallaNote} ${params.overdueCount} customers have overdue balances and ${params.lowStockCount} stock items are low.`;
  }
  return `${params.shopName} ka aaj ka hisaab. Aaj kul ${given} rupaye ka udhaar diya gaya, aur ${rec} rupaye vasooli aayi. Aaj ka net cashflow ${net >= 0 ? 'plus' : 'minus'} ${netAbs} rupaye hai.${gallaNote} ${params.overdueCount} grahako ka payment overdue hai, aur ${params.lowStockCount} stock items kam hain.`;
}

export function speakHinglish(text: string, lang: LanguageCode = 'hinglish'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang === 'en' ? 'en-IN' : 'hi-IN';
    utter.rate = 0.96;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis errors on unsupported browsers
  }
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignore stop errors
  }
}

export async function compressImageToDataUrl(
  file: File,
  options?: { maxSide?: number; maxBytes?: number }
): Promise<string> {
  const maxSide = options?.maxSide ?? 720;
  const maxBytes = options?.maxBytes ?? 145000;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width > height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve('');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', 0.72);
        resolve(out.length <= maxBytes ? out : canvas.toDataURL('image/jpeg', 0.45));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Local timezone YYYY-MM-DD (prevents UTC midnight off-by-one bug in IST +05:30). */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function sha256Salted(saltPrefix: string, pin: string, uid: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${saltPrefix}:${uid}:${pin}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sha256:${hex}`;
}

/** Salted SHA-256 hash for 4-digit App Lock PIN scoped to Firebase UID. */
export async function hashPinForUid(pin: string, uid: string): Promise<string> {
  const cleanPin = pin.trim();
  if (!cleanPin) return '';
  if (typeof globalThis === 'undefined' || !globalThis.crypto?.subtle) {
    return cleanPin;
  }
  return sha256Salted('ucred', cleanPin, uid);
}

/** Verify entered PIN against stored salted SHA-256 hash (supports Ucred + legacy BolBahi hashes). */
export async function verifyStoredPin(
  enteredPin: string,
  storedPin: string,
  uid: string
): Promise<boolean> {
  if (!storedPin) return true;
  if (storedPin.startsWith('sha256:') && typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const cleanPin = enteredPin.trim();
    const ucredHash = await sha256Salted('ucred', cleanPin, uid);
    if (ucredHash === storedPin) return true;
    const legacyHash = await sha256Salted('bolbahi', cleanPin, uid);
    return legacyHash === storedPin;
  }
  return enteredPin === storedPin;
}

export function isValidUpiId(upi: string): boolean {
  const clean = upi.trim();
  if (!clean) return true;
  return /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z0-9.-]{2,32}$/.test(clean);
}

export function isValidGstNumber(gst: string): boolean {
  const clean = gst.trim().toUpperCase();
  if (!clean) return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

export function isValidIndianMobile(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return true;
  return /^(?:91)?[6-9]\d{9}$/.test(digits);
}

export function buildBillShareMessage(params: {
  docType: 'bill' | 'quote';
  billNumber: string;
  shopName: string;
  customerName: string;
  totalAmount: number;
  billDate: string;
  paymentStatus?: 'paid' | 'unpaid' | 'partial';
  upiId?: string;
  items: Array<{ name: string; qty: number; rate: number }>;
}): string {
  const heading = params.docType === 'quote' ? 'Quotation / Estimate' : 'Tax Bill / Invoice';
  const lines = params.items
    .slice(0, 8)
    .map((i) => `• ${i.name} (${i.qty} x ${formatINR(i.rate)}) = ${formatINR(i.qty * i.rate)}`)
    .join('\n');
  const statusLine =
    params.docType === 'bill' && params.paymentStatus
      ? `\nStatus: ${params.paymentStatus === 'paid' ? 'Paid' : 'Pending / Udhaar'}`
      : '';
  const upiLine =
    params.upiId && params.paymentStatus !== 'paid' && params.totalAmount > 0
      ? `\nPay via UPI (${params.upiId}): ${buildUpiUri(params.upiId, params.shopName, params.totalAmount)}`
      : '';
  return `${params.shopName} — ${heading} #${params.billNumber}\nDate: ${params.billDate}\nCustomer: ${params.customerName}\n\n${lines}\n\nTotal: ${formatINR(params.totalAmount)}${statusLine}${upiLine}\nThank you!`;
}
