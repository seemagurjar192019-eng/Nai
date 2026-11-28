export type ParsedTxType = 'credit' | 'debit';

export interface ParsedHinglishEntry {
  name: string;
  amount: number;
  type: ParsedTxType;
  note?: string;
  raw: string;
}

export type VoiceCommandResult =
  | { intent: 'daily_summary'; raw: string }
  | { intent: 'balance_query'; customerName: string; raw: string }
  | { intent: 'entries'; entries: ParsedHinglishEntry[]; raw: string };

export interface ParserTestCase {
  input: string;
  name: string;
  amount: number;
  type: ParsedTxType;
}

const DEVANAGARI_DIGITS: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
};

const DEVANAGARI_WORD_MAP: Record<string, string> = {
  'एक': 'ek', 'दो': 'do', 'तीन': 'teen', 'चार': 'char', 'पाँच': 'paanch', 'पांच': 'paanch',
  'छह': 'chhe', 'छे': 'chhe', 'छ': 'chhe', 'सात': 'saat', 'आठ': 'aath', 'नौ': 'nau',
  'दस': 'das', 'ग्यारह': 'gyarah', 'बारह': 'barah', 'तेरह': 'terah', 'चौदह': 'chaudah',
  'पंद्रह': 'pandrah', 'पन्द्रह': 'pandrah', 'सोलह': 'solah', 'सत्रह': 'satrah',
  'अठारह': 'atharah', 'उन्नीस': 'unnees', 'बीस': 'bees', 'पच्चीस': 'pachchees',
  'तीस': 'tees', 'चालीस': 'chalees', 'पचास': 'pachaas', 'साठ': 'saath',
  'सत्तर': 'sattar', 'अस्सी': 'assi', 'नब्बे': 'nabbe', 'सौ': 'sau',
  'हज़ार': 'hazaar', 'हजार': 'hazaar', 'लाख': 'lakh', 'करोड़': 'crore', 'करोड': 'crore',
  'डेढ़': 'dedh', 'डेढ': 'dedh', 'ढाई': 'dhai', 'सवा': 'sava', 'पौने': 'paune',
  'आधा': 'aadha', 'आधे': 'aadha', 'साढ़े': 'sadhe', 'साढे': 'sadhe',
  'उधार': 'udhaar', 'दिया': 'diya', 'दी': 'di', 'देना': 'dena', 'देने': 'dene',
  'बकाया': 'bakaya', 'बाकी': 'baaki', 'मिला': 'mila', 'मिले': 'mile', 'मिली': 'mili',
  'जमा': 'jama', 'पेमेंट': 'payment', 'वापस': 'wapas', 'वापिस': 'wapis',
  'लिया': 'liya', 'ली': 'li', 'आया': 'aaya', 'आये': 'aaye', 'आए': 'aaye',
  'के': 'ke', 'को': 'ko', 'से': 'se', 'का': 'ka', 'की': 'ki', 'है': 'hai', 'हैं': 'hai',
  'हूँ': 'hu', 'हु': 'hu', 'हाँ': 'haan', 'हां': 'haan', 'रुपये': 'rupaye',
  'रुपए': 'rupaye', 'रुपया': 'rupaye', 'और': 'aur', 'ने': 'ne', 'था': 'tha',
  'थे': 'the', 'जी': 'ji', 'भाई': 'bhai', 'भैया': 'bhaiya', 'साहब': 'sahab',
  'सर': 'sir', 'श्री': 'shri', 'सेठ': 'seth',
  'हिसाब': 'hisaab', 'बताओ': 'batao', 'कितना': 'kitna', 'कितने': 'kitna',
  'दिखाओ': 'dikhao', 'आज': 'aaj', 'कमाई': 'kamai', 'टोटल': 'total',
  'खाता': 'khata', 'चेक': 'check', 'बैलेंस': 'balance', 'मुनीम': 'munim',
  'सुनाओ': 'sunao', 'रोकड़': 'rokad', 'रोकड': 'rokad', 'नकद': 'nagad', 'नगद': 'nagad',
  'वसूली': 'vasooli', 'वसूल': 'vasool', 'उगाही': 'ugrahi', 'खर्च': 'kharch',
  'लिखो': 'likho', 'लिख': 'likh', 'भेजा': 'bheja', 'लेना': 'lena',
};

const CONS_MAP: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',
  'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f',
};

const INDEP_VOWEL: Record<string, string> = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
};

const MATRA_MAP: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
  'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
};

function isDevanagariWord(word: string): boolean {
  return /[\u0900-\u097F]/.test(word);
}

export function transliterateDevanagari(word: string): string {
  let clean = word.normalize('NFC');
  if (DEVANAGARI_WORD_MAP[clean]) {
    return DEVANAGARI_WORD_MAP[clean];
  }
  clean = clean
    .replace(/ज\u093C/g, 'ज़')
    .replace(/फ\u093C/g, 'फ़')
    .replace(/ड\u093C/g, 'ड़')
    .replace(/ढ\u093C/g, 'ढ़')
    .replace(/क\u093C/g, 'क़')
    .replace(/ख\u093C/g, 'ख़')
    .replace(/ग\u093C/g, 'ग़');

  if (DEVANAGARI_WORD_MAP[clean]) {
    return DEVANAGARI_WORD_MAP[clean];
  }

  const chars = Array.from(clean);
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = i + 1 < chars.length ? chars[i + 1] : '';

    if (INDEP_VOWEL[ch]) {
      out += INDEP_VOWEL[ch];
      if (next === 'ं' || next === 'ँ') {
        out += 'n';
        i++;
      }
      continue;
    }

    if (CONS_MAP[ch]) {
      out += CONS_MAP[ch];
      if (next === '्') {
        i++;
        continue;
      }
      if (MATRA_MAP[next]) {
        out += MATRA_MAP[next];
        i++;
        if (i + 1 < chars.length && (chars[i + 1] === 'ं' || chars[i + 1] === 'ँ')) {
          out += 'n';
          i++;
        }
        continue;
      }
      if (next === 'ं' || next === 'ँ') {
        out += 'an';
        i++;
        continue;
      }
      const isFinal = i === chars.length - 1;
      if (!isFinal) {
        out += 'a';
      }
      continue;
    }

    if (ch === 'ं' || ch === 'ँ') {
      out += 'n';
    } else if (DEVANAGARI_DIGITS[ch]) {
      out += DEVANAGARI_DIGITS[ch];
    } else if (/[a-zA-Z0-9]/.test(ch)) {
      out += ch;
    }
  }
  return out;
}

const UNITS: Record<string, number> = {
  ek: 1, do: 2, teen: 3, tin: 3, char: 4, chaar: 4, paanch: 5, panch: 5,
  chhe: 6, che: 6, chhah: 6, saat: 7, sat: 7, aath: 8, ath: 8,
  nau: 9, das: 10, gyarah: 11, gyara: 11, barah: 12, bara: 12,
  terah: 13, tera: 13, chaudah: 14, chauda: 14, pandrah: 15, pandra: 15,
  solah: 16, satrah: 17, atharah: 18, unnees: 19, bees: 20, bis: 20,
  ikkees: 21, bais: 22, teis: 23, chaubis: 24,
  pachchees: 25, pachees: 25, pachis: 25, tees: 30, tis: 30,
  chalees: 40, chalis: 40, pachaas: 50, pachas: 50,
  saath: 60, sath: 60, sattar: 70, assi: 80, nabbe: 90,
};

const SCALES: Record<string, number> = {
  sau: 100, so: 100,
  hazaar: 1000, hazar: 1000, hajjar: 1000, hajar: 1000,
  lakh: 100000, lac: 100000, laakh: 100000,
  crore: 10000000, karod: 10000000,
};

const ABS_FRACTIONS: Record<string, number> = {
  dedh: 1.5,
  dhai: 2.5, dhaai: 2.5,
  adha: 0.5, aadha: 0.5, aadhe: 0.5,
};

const MOD_FRACTIONS: Record<string, 'sava' | 'paune' | 'sadhe'> = {
  sava: 'sava', sawa: 'sava',
  paune: 'paune', pone: 'paune',
  sadhe: 'sadhe', saadhe: 'sadhe',
};

const CREDIT_WORDS: Record<string, boolean> = {
  udhaar: true, udhar: true, udhari: true, udhaari: true,
  diya: true, di: true, dia: true,
  dena: true, dene: true,
  bakaya: true, baaki: true, baki: true,
  bheja: true, lena: true, kharch: true, kharcha: true,
};

const DEBIT_WORDS: Record<string, boolean> = {
  mila: true, mile: true, mili: true,
  jama: true, jamaa: true,
  payment: true,
  wapas: true, wapis: true, wapaas: true, vaapas: true, vapis: true,
  liya: true, li: true,
  aaya: true, aaye: true, aayi: true,
  vasool: true, vasooli: true, wasool: true, wasooli: true, ugrahi: true,
  rokad: true, nagad: true, nakad: true,
};

const STOP_WORDS: Record<string, boolean> = {
  ke: true, ko: true, se: true, ka: true, ki: true,
  hai: true, hain: true, hu: true, hun: true, hoon: true,
  haan: true, rs: true, rupaye: true, rupees: true, rupay: true,
  rupaiya: true, rupee: true, inr: true,
  aur: true, ne: true, tha: true, the: true, thi: true,
  ji: true, bhai: true, bhaiya: true, sahab: true, saheb: true,
  sir: true, shri: true, seth: true, madam: true,
  mein: true, me: true, par: true, pe: true,
  likh: true, likho: true, likhna: true, kardo: true, karo: true,
  de: true, entry: true, hisab: true, hisaab: true,
};

function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function normalizeDigitsAndPunctuation(raw: string): string {
  const str = String(raw || '').normalize('NFC');
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    out += DEVANAGARI_DIGITS[c] ? DEVANAGARI_DIGITS[c] : c;
  }
  out = out.replace(/₹/g, ' ');
  out = out.replace(/(\d),(?=\d)/g, '$1');
  out = out.replace(/\b(rs|inr)\.?(\d+)/gi, '$1 $2');
  out = out.replace(/[.,!?;:'"()\/\-]+/g, ' ');
  return out.trim();
}

type TokenClass =
  | { kind: 'empty'; norm: string }
  | { kind: 'num'; norm: string; val: number }
  | { kind: 'scale'; norm: string; val: number }
  | { kind: 'frac_abs'; norm: string; val: number }
  | { kind: 'frac_mod'; norm: string; op: 'sava' | 'paune' | 'sadhe' }
  | { kind: 'type'; norm: string; txType: ParsedTxType }
  | { kind: 'stop'; norm: string }
  | { kind: 'name'; norm: string };

function classifyToken(rawToken: string): TokenClass {
  const lower = isDevanagariWord(rawToken)
    ? transliterateDevanagari(rawToken).toLowerCase()
    : rawToken.toLowerCase();

  if (!lower) return { kind: 'empty', norm: '' };
  if (/^\d+(\.\d+)?$/.test(lower)) {
    return { kind: 'num', norm: lower, val: parseFloat(lower) };
  }
  if (Object.prototype.hasOwnProperty.call(UNITS, lower)) {
    return { kind: 'num', norm: lower, val: UNITS[lower] };
  }
  if (Object.prototype.hasOwnProperty.call(SCALES, lower)) {
    return { kind: 'scale', norm: lower, val: SCALES[lower] };
  }
  if (Object.prototype.hasOwnProperty.call(ABS_FRACTIONS, lower)) {
    return { kind: 'frac_abs', norm: lower, val: ABS_FRACTIONS[lower] };
  }
  if (Object.prototype.hasOwnProperty.call(MOD_FRACTIONS, lower)) {
    return { kind: 'frac_mod', norm: lower, op: MOD_FRACTIONS[lower] };
  }
  if (CREDIT_WORDS[lower]) {
    return { kind: 'type', norm: lower, txType: 'credit' };
  }
  if (DEBIT_WORDS[lower]) {
    return { kind: 'type', norm: lower, txType: 'debit' };
  }
  if (STOP_WORDS[lower]) {
    return { kind: 'stop', norm: lower };
  }
  return { kind: 'name', norm: lower };
}

function computeAmount(numTokens: Array<Extract<TokenClass, { kind: 'num' | 'scale' | 'frac_abs' | 'frac_mod' }>>): number {
  let total = 0;
  let current = 0;
  let pendingMod: 'sava' | 'paune' | 'sadhe' | null = null;

  for (let i = 0; i < numTokens.length; i++) {
    const tok = numTokens[i];

    if (tok.kind === 'frac_mod') {
      pendingMod = tok.op;
    } else if (tok.kind === 'num' || tok.kind === 'frac_abs') {
      let v = tok.val;
      if (pendingMod === 'sava') {
        v = v + 0.25;
        pendingMod = null;
      } else if (pendingMod === 'paune') {
        v = Math.max(0, v - 0.25);
        pendingMod = null;
      } else if (pendingMod === 'sadhe') {
        v = v + 0.5;
        pendingMod = null;
      }
      current += v;
    } else if (tok.kind === 'scale') {
      if (pendingMod) {
        let base = 1;
        if (pendingMod === 'sava') base = 1.25;
        else if (pendingMod === 'paune') base = 0.75;
        else if (pendingMod === 'sadhe') base = 1.5;
        pendingMod = null;
        current = base * tok.val;
      } else {
        if (current === 0) current = 1;
        current = current * tok.val;
      }
      if (tok.val >= 1000) {
        total += current;
        current = 0;
      }
    }
  }

  if (pendingMod) {
    if (pendingMod === 'sava') current += 1.25;
    else if (pendingMod === 'paune') current += 0.75;
    else if (pendingMod === 'sadhe') current += 1.5;
  }

  total += current;
  return Math.round(total * 100) / 100;
}

export function parseHinglishEntry(input: string): ParsedHinglishEntry {
  const cleaned = normalizeDigitsAndPunctuation(input);
  if (!cleaned) {
    return { name: '', amount: 0, type: 'credit', raw: String(input || '') };
  }

  const parts = cleaned.split(/\s+/);
  const numTokens: Array<Extract<TokenClass, { kind: 'num' | 'scale' | 'frac_abs' | 'frac_mod' }>> = [];
  let name = '';
  const extraWords: string[] = [];
  let txType: ParsedTxType = 'credit';

  for (let i = 0; i < parts.length; i++) {
    const cls = classifyToken(parts[i]);
    if (cls.kind === 'num' || cls.kind === 'scale' || cls.kind === 'frac_abs' || cls.kind === 'frac_mod') {
      numTokens.push(cls);
    } else if (cls.kind === 'type') {
      if (cls.txType === 'debit') {
        txType = 'debit';
      }
    } else if (cls.kind === 'name') {
      if (!name) {
        name = capitalize(cls.norm);
      } else {
        extraWords.push(capitalize(cls.norm));
      }
    }
  }

  const amount = computeAmount(numTokens);
  const note = extraWords.length > 0 ? extraWords.join(' ').slice(0, 80) : undefined;
  return {
    name,
    amount,
    type: txType,
    ...(note ? { note } : {}),
    raw: String(input || ''),
  };
}

const QUERY_WORDS = new Set([
  'hisaab',
  'hisab',
  'batao',
  'btao',
  'kitna',
  'kitni',
  'dikhao',
  'balance',
  'status',
  'check',
  'khata',
  'sunao',
  'summary',
]);

const SUMMARY_CONTEXT_WORDS = new Set([
  'aaj',
  'today',
  'kamai',
  'total',
  'closing',
  'munim',
  'summary',
]);

export function parseVoiceCommand(input: string): VoiceCommandResult {
  const raw = String(input || '').trim();
  if (!raw) {
    return {
      intent: 'entries',
      entries: [{ name: '', amount: 0, type: 'credit', raw: '' }],
      raw: '',
    };
  }

  const normalizedTokens = normalizeDigitsAndPunctuation(raw)
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const cls = classifyToken(tok);
      return cls.norm;
    })
    .filter(Boolean);

  const hasSummaryWord = normalizedTokens.some((t) => SUMMARY_CONTEXT_WORDS.has(t));
  const hasQueryWord = normalizedTokens.some((t) => QUERY_WORDS.has(t));

  if (
    hasSummaryWord &&
    (hasQueryWord || normalizedTokens.includes('today') || normalizedTokens.includes('summary'))
  ) {
    return { intent: 'daily_summary', raw };
  }

  const singleParsed = parseHinglishEntry(raw);
  if (hasQueryWord && singleParsed.amount === 0) {
    const candidateName = normalizedTokens.find((tok) => {
      if (QUERY_WORDS.has(tok) || SUMMARY_CONTEXT_WORDS.has(tok)) return false;
      const cls = classifyToken(tok);
      return cls.kind === 'name';
    });
    return {
      intent: 'balance_query',
      customerName: candidateName ? capitalize(candidateName) : singleParsed.name,
      raw,
    };
  }

  const primaryChunks = raw
    .replace(/([0-9])\s*,\s*(?=[0-9]{3}\b)/g, '$1')
    .split(/[;\n|,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const expandedChunks: string[] = [];
  for (const chunk of primaryChunks) {
    const transliteratedForSplit = chunk
      .split(/\s+/)
      .map((w) => (w.normalize('NFC') === 'और' ? 'aur' : w))
      .join(' ');
    const aurParts = transliteratedForSplit.split(/\s+aur\s+/i);
    if (aurParts.length > 1) {
      const parsedParts = aurParts.map((p) => parseHinglishEntry(p));
      const allComplete = parsedParts.every((p) => Boolean(p.name) && p.amount > 0);
      if (allComplete) {
        expandedChunks.push(...aurParts);
        continue;
      }
    }
    expandedChunks.push(chunk);
  }

  const entries = (expandedChunks.length > 0 ? expandedChunks : [raw]).map((segment) =>
    parseHinglishEntry(segment)
  );
  return {
    intent: 'entries',
    entries,
    raw,
  };
}

export function amountToHinglishWords(num: number): string {
  let n = Math.round(Number(num) || 0);
  if (n <= 0) return 'shunya';
  const ones = [
    '', 'ek', 'do', 'teen', 'char', 'paanch', 'chhe', 'saat', 'aath', 'nau',
    'das', 'gyarah', 'barah', 'terah', 'chaudah', 'pandrah', 'solah', 'satrah', 'atharah', 'unnees',
  ];
  const tens = ['', '', 'bees', 'tees', 'chalees', 'pachaas', 'saath', 'sattar', 'assi', 'nabbe'];

  function twoDigits(v: number): string {
    if (v < 20) return ones[v];
    const t = Math.floor(v / 10);
    const o = v % 10;
    if (o === 0) return tens[t];
    return tens[t] + ' ' + ones[o];
  }

  function underThousand(v: number): string {
    const h = Math.floor(v / 100);
    const r = v % 100;
    let s = '';
    if (h > 0) s += ones[h] + ' sau';
    if (r > 0) s += (s ? ' ' : '') + twoDigits(r);
    return s;
  }

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const hazaar = Math.floor(n / 1000);
  n %= 1000;

  if (crore > 0) parts.push(underThousand(crore) + ' crore');
  if (lakh > 0) parts.push(underThousand(lakh) + ' lakh');
  if (hazaar > 0) parts.push(underThousand(hazaar) + ' hazaar');
  if (n > 0) parts.push(underThousand(n));

  return parts.join(' ').trim();
}

export const TEST_CASES: ParserTestCase[] = [
  { input: 'Ramesh do hazaar udhaar', name: 'Ramesh', amount: 2000, type: 'credit' },
  { input: 'Suresh ko paanch sau diya', name: 'Suresh', amount: 500, type: 'credit' },
  { input: 'Mohan se dedh sau mila', name: 'Mohan', amount: 150, type: 'debit' },
  { input: 'Dhai hazaar Ramesh udhaar', name: 'Ramesh', amount: 2500, type: 'credit' },
  { input: 'Paune do hazaar Suresh ko diya', name: 'Suresh', amount: 1750, type: 'credit' },
  { input: 'रमेश दो हज़ार उधार', name: 'Ramesh', amount: 2000, type: 'credit' },
  { input: 'मोहन से ढाई सौ मिला', name: 'Mohan', amount: 250, type: 'debit' },
  { input: 'Ramesh 2000 udhaar', name: 'Ramesh', amount: 2000, type: 'credit' },
  { input: 'Suresh 500 diya', name: 'Suresh', amount: 500, type: 'credit' },
  { input: 'Pachchees hazaar Mohan se jama', name: 'Mohan', amount: 25000, type: 'debit' },
  { input: 'Do lakh pachaas hazaar Ramesh udhaar', name: 'Ramesh', amount: 250000, type: 'credit' },
  { input: 'Sava sau Suresh udhaar', name: 'Suresh', amount: 125, type: 'credit' },
  { input: 'Ek hazaar do sau Ramesh diya', name: 'Ramesh', amount: 1200, type: 'credit' },
  { input: 'Teen sau pachaas Mohan mila', name: 'Mohan', amount: 350, type: 'debit' },
  { input: 'Dedh hazaar Ramesh udhaar', name: 'Ramesh', amount: 1500, type: 'credit' },
  { input: 'Vikram ko char sau rupaye diya', name: 'Vikram', amount: 400, type: 'credit' },
  { input: 'Dinesh ne chaar hazaar wapas liya', name: 'Dinesh', amount: 4000, type: 'debit' },
  { input: 'Mahesh ke chhe sau baaki hai', name: 'Mahesh', amount: 600, type: 'credit' },
  { input: 'Rajesh se saat hazaar payment aaya', name: 'Rajesh', amount: 7000, type: 'debit' },
  { input: 'Mukesh ko aath sau rupay dena hai', name: 'Mukesh', amount: 800, type: 'credit' },
  { input: 'Sanjay se nau sau wapis mila', name: 'Sanjay', amount: 900, type: 'debit' },
  { input: 'Ajay das hazaar udhar', name: 'Ajay', amount: 10000, type: 'credit' },
  { input: 'Vijay gyarah sau rupaye jama', name: 'Vijay', amount: 1100, type: 'debit' },
  { input: 'Pankaj ko barah hazaar dene hai', name: 'Pankaj', amount: 12000, type: 'credit' },
  { input: 'Deepak se terah sau rupay aaye', name: 'Deepak', amount: 1300, type: 'debit' },
  { input: 'Anil chaudah hazaar bakaya', name: 'Anil', amount: 14000, type: 'credit' },
  { input: 'Sunil se pandrah sau liya', name: 'Sunil', amount: 1500, type: 'debit' },
  { input: 'Manoj bees hazaar Rs diya', name: 'Manoj', amount: 20000, type: 'credit' },
  { input: 'Kiran ko paune teen hazaar mila', name: 'Kiran', amount: 2750, type: 'debit' },
  { input: 'Gopal sava do hazaar udhaar', name: 'Gopal', amount: 2250, type: 'credit' },
  { input: 'Babu aadha hazaar diya', name: 'Babu', amount: 500, type: 'credit' },
  { input: 'Raju adha sau rupaye mile', name: 'Raju', amount: 50, type: 'debit' },
  { input: 'Suresh ek lakh rupaye udhaar', name: 'Suresh', amount: 100000, type: 'credit' },
  { input: 'Mohan se ek lac jamaa', name: 'Mohan', amount: 100000, type: 'debit' },
  { input: 'Ramesh ko paanch hajjar dia', name: 'Ramesh', amount: 5000, type: 'credit' },
  { input: 'Anita ke teen hazar aur char sau bakaya', name: 'Anita', amount: 3400, type: 'credit' },
  { input: 'Geeta se 1,500 rupees wapaas aaya', name: 'Geeta', amount: 1500, type: 'debit' },
  { input: 'Patel ko ₹3,200 di', name: 'Patel', amount: 3200, type: 'credit' },
  { input: 'Sharma se Rs. 750 li', name: 'Sharma', amount: 750, type: 'debit' },
  { input: 'Verma ek sau rupaye', name: 'Verma', amount: 100, type: 'credit' },
  { input: 'Gupta paune sau udhaar', name: 'Gupta', amount: 75, type: 'credit' },
  { input: 'Yadav ko sava hazaar diya', name: 'Yadav', amount: 1250, type: 'credit' },
  { input: 'सुरेश को पांच सौ दिया', name: 'Suresh', amount: 500, type: 'credit' },
  { input: 'दिनेश से डेढ़ हज़ार वापस', name: 'Dinesh', amount: 1500, type: 'debit' },
  { input: 'महेश सवा दो सौ उधार', name: 'Mahesh', amount: 225, type: 'credit' },
  { input: 'विजय पौने तीन सौ जमा', name: 'Vijay', amount: 275, type: 'debit' },
  { input: 'अजय दो लाख उधार', name: 'Ajay', amount: 200000, type: 'credit' },
  { input: 'संजय 1500 बाकी', name: 'Sanjay', amount: 1500, type: 'credit' },
  { input: 'पंकज से २५०० मिला', name: 'Pankaj', amount: 2500, type: 'debit' },
  { input: 'Haan Ramesh ko panch sau rupaye udhaar tha', name: 'Ramesh', amount: 500, type: 'credit' },
  { input: 'Rahul ugrahi se 4000 mila', name: 'Rahul', amount: 4000, type: 'debit' },
  { input: 'Karan se pachaas sau jama', name: 'Karan', amount: 5000, type: 'debit' },
  { input: 'Amit ko do hazaar khata likho', name: 'Amit', amount: 2000, type: 'credit' },
  { input: 'Sahil se tin hazaar cash mila', name: 'Sahil', amount: 3000, type: 'debit' },
  { input: 'Pooja ko chhe sau udhaar diya', name: 'Pooja', amount: 600, type: 'credit' },
  { input: 'Neha se saat sau payment aayi', name: 'Neha', amount: 700, type: 'debit' },
  { input: 'Tarun aath hazaar udhar baki', name: 'Tarun', amount: 8000, type: 'credit' },
  { input: 'Varun se nau sau wapas mila', name: 'Varun', amount: 900, type: 'debit' },
  { input: 'Manish das hazar rupay diya', name: 'Manish', amount: 10000, type: 'credit' },
  { input: 'Deepak gyarah hazaar udhaar', name: 'Deepak', amount: 11000, type: 'credit' },
];
