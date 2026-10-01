/*
  طبقة تخزين آمنة + إدارة حسابات محلية لكوكب كراكيب.

  سبب وجود الملف: الوصول المباشر إلى localStorage/sessionStorage يرمي استثناءً
  في وضع التصفح الخاص، وداخل الإطارات (iframe)، وعند منع تخزين الطرف الثالث.
  كان هذا الاستثناء يكسر دخول المالك ويمنع حفظ التسجيل. كل الوصول صار هنا
  محاطًا بـ try/catch مع بديل في الذاكرة حتى تستمر الواجهة في العمل.

  ملاحظة إنتاجية: المصادقة الحقيقية يجب أن تكون على خادم (Supabase Auth أو
  Edge Function). هذه الطبقة موجودة لتشغيل نسخة العرض بأمان معقول محليًا:
  كلمات المرور مُجزَّأة بـ SHA-256 مع ملح عشوائي، وهناك خفض لمحاولات الدخول
  الخاطئة، ولا تُحفظ أي كلمة مرور كنص صريح.
*/

const memory = new Map();

const pick = (session) => {
  try {
    const store = session ? window.sessionStorage : window.localStorage;
    if (!store) return null;
    const probe = '__kawkap_probe__';
    store.setItem(probe, '1');
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
};

const memKey = (key, session) => (session ? `s:${key}` : `l:${key}`);

export const safeGet = (key, { session = false } = {}) => {
  const store = pick(session);
  if (store) {
    try {
      const value = store.getItem(key);
      if (value !== null) return value;
    } catch {
      /* تجاهل: نرجع للذاكرة */
    }
  }
  const fallback = memory.get(memKey(key, session));
  return fallback === undefined ? null : fallback;
};

export const safeSet = (key, value, { session = false } = {}) => {
  memory.set(memKey(key, session), String(value));
  const store = pick(session);
  if (!store) return false;
  try {
    store.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
};

export const safeRemove = (key, { session = false } = {}) => {
  memory.delete(memKey(key, session));
  const store = pick(session);
  if (!store) return;
  try {
    store.removeItem(key);
  } catch {
    /* تجاهل */
  }
};

export const readJson = (key, fallback) => {
  const raw = safeGet(key);
  if (raw === null || raw === '') return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed === undefined || parsed === null ? fallback : parsed;
  } catch {
    return fallback;
  }
};

export const writeJson = (key, value) => safeSet(key, JSON.stringify(value));

/* ===== ترحيل بيانات النسخة =====
   عند تغيير بنية بيانات العرض نبدّل رقم النسخة هنا فتُمسح بيانات النسخة
   القديمة من المتصفح وتُعاد بيانات العرض الافتراضية، بدل تعطل الواجهة
   بسبب أشكال بيانات قديمة. لا نمسح تفضيل الوضع الداكن. */

export const DATA_VERSION = '3';
const DATA_VERSION_KEY = 'kawkap_data_version';

export const migrateKawkapStorage = (version) => {
  try {
    if (safeGet(DATA_VERSION_KEY) === String(version)) return false;
    const store = pick(false);
    if (store) {
      const doomed = [];
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        if (
          key &&
          key.startsWith('kawkap_') &&
          key !== 'kawkap_dark' &&
          key !== DATA_VERSION_KEY
        ) {
          doomed.push(key);
        }
      }
      doomed.forEach((key) => {
        try {
          store.removeItem(key);
        } catch {
          /* تجاهل */
        }
      });
    }
    [...memory.keys()]
      .filter((k) => k.startsWith('l:kawkap_') && k !== 'l:kawkap_dark')
      .forEach((k) => memory.delete(k));
    safeSet(DATA_VERSION_KEY, String(version));
    return true;
  } catch {
    return false;
  }
};

/* ===== خفض محاولات الدخول (Brute-force throttling) =====
   بعد ٥ محاولات خاطئة لنفس المفتاح (رقم هاتف أو بوابة المالك) نوقف
   المحاولات ٥ دقائق. تُحفظ الحالة في جلسة المتصفح فقط. */

const THROTTLE_MAX_ATTEMPTS = 5;
const THROTTLE_LOCK_MS = 5 * 60 * 1000;

const readThrottle = (key) => {
  try {
    return JSON.parse(safeGet(`kawkap_throttle_${key}`, { session: true }) || 'null');
  } catch {
    return null;
  }
};

export const throttleStatus = (key) => {
  const data = readThrottle(key);
  const now = Date.now();
  if (data && data.until && data.until > now) {
    const minutes = Math.max(1, Math.ceil((data.until - now) / 60000));
    return { locked: true, remaining: 0, message: `محاولات كثيرة خاطئة. انتظر ${minutes} دقيقة ثم أعد المحاولة.` };
  }
  const used = data && !data.until ? Number(data.count) || 0 : 0;
  return { locked: false, remaining: Math.max(0, THROTTLE_MAX_ATTEMPTS - used), message: '' };
};

export const registerFailedAttempt = (key) => {
  const now = Date.now();
  const data = readThrottle(key);
  const count = data && !data.until ? (Number(data.count) || 0) + 1 : 1;
  const next =
    count >= THROTTLE_MAX_ATTEMPTS
      ? { count: 0, until: now + THROTTLE_LOCK_MS }
      : { count, until: 0 };
  safeSet(`kawkap_throttle_${key}`, JSON.stringify(next), { session: true });
};

export const clearAttempts = (key) => safeRemove(`kawkap_throttle_${key}`, { session: true });

/* ===== الأرقام والهواتف ===== */

const digitMap = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

export const toLatinDigits = (value) =>
  String(value ?? '').replace(/[٠-٩۰-۹]/g, (d) => digitMap[d] || d);

export const normalizePhone = (value) => {
  let v = toLatinDigits(value).replace(/[\s\-().]/g, '');
  if (v.startsWith('+')) v = v.slice(1);
  if (v.startsWith('0020')) v = v.slice(4);
  else if (v.startsWith('20') && v.length >= 12) v = v.slice(2);
  v = v.replace(/\D/g, '');
  if (v.length === 10 && v.startsWith('1')) v = `0${v}`;
  return v;
};

export const phoneError = (value) => {
  const raw = toLatinDigits(value).trim();
  if (!raw) return 'أدخل رقم الهاتف.';
  const v = normalizePhone(raw);
  if (!v) return 'رقم الهاتف يجب أن يحتوي على أرقام.';
  if (v.startsWith('01') && v.length !== 11)
    return 'رقم الهاتف المصري يجب أن يتكون من ١١ رقمًا ويبدأ بـ 01.';
  if (v.length < 8 || v.length > 15) return 'رقم الهاتف غير صحيح.';
  return '';
};

/* ===== كلمات المرور =====
   التجزئة محليًا عبر SHA-256 نقي بملح عشوائي لكل حساب (k2$)، مع دعم
   التحقق من الحسابات القديمة المُجزَّأة بالخوارزمية السابقة (k1$).
   في الإنتاج يجب أن تتم المصادقة على الخادم (Supabase Auth أو Edge Function). */

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x, n) => (x >>> n) | (x << (32 - n));

const utf8Bytes = (text) => {
  const bytes = [];
  for (let i = 0; i < text.length; i += 1) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i += 1;
      }
    }
    if (code < 0x80) bytes.push(code);
    else if (code < 0x800) bytes.push(0xc0 | (code >> 6), 0x80 | (code & 63));
    else if (code < 0x10000)
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
    else
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 63),
        0x80 | ((code >> 6) & 63),
        0x80 | (code & 63),
      );
  }
  return bytes;
};

const sha256Hex = (text) => {
  const bytes = utf8Bytes(text);
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  bytes.push(
    (hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff,
    (lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff,
  );
  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
  const w = new Array(64);
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      const j = offset + i * 4;
      w[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }
  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => (x >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

const randomSalt = () => {
  let out = '';
  try {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const buf = new Uint8Array(8);
      crypto.getRandomValues(buf);
      out = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* تجاهل */
  }
  if (!out) {
    for (let i = 0; i < 8; i += 1) out += Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
  }
  return out;
};

const hashWithSalt = (salt, value) => `k2$${salt}$${sha256Hex(`${salt}::kawkap::${String(value ?? '')}`)}`;

export const hashPassword = (value) => hashWithSalt(randomSalt(), value);

const legacyHashPassword = (value) => {
  const text = `kawkap::${String(value ?? '')}`;
  let a = 0x811c9dc5;
  let b = 0x1b873593;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 16777619) >>> 0;
    b = (Math.imul(b + code + i, 2654435761) ^ (a >>> 7)) >>> 0;
  }
  return `k1$${a.toString(36)}${b.toString(36)}`;
};

export const passwordError = (value) => {
  const v = String(value ?? '');
  if (!v) return 'أدخل كلمة المرور.';
  if (v.length < 6) return 'كلمة المرور يجب ألا تقل عن ٦ خانات.';
  if (v.length > 72) return 'كلمة المرور طويلة جدًا.';
  if (!/[0-9٠-٩]/.test(v) || !/[a-zA-Z\u0600-\u06FF]/.test(v))
    return 'اجعل كلمة المرور تحتوي حروفًا وأرقامًا معًا.';
  return '';
};

/* ===== الحسابات ===== */

export const ACCOUNTS_KEY = 'kawkap_accounts';
export const OWNER_SESSION_KEY = 'kawkap_owner';

const newId = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const makeAccount = ({
  role,
  name,
  phone,
  password,
  city = '',
  specialty = '',
  about = '',
  traderId = null,
}) => ({
  id: newId('acc'),
  role,
  name: String(name ?? '').trim().slice(0, 60),
  phone: normalizePhone(phone),
  password: hashPassword(password),
  city: String(city ?? '').trim().slice(0, 60),
  specialty: String(specialty ?? '').trim().slice(0, 40),
  about: String(about ?? '').trim().slice(0, 300),
  traderId,
  createdAt: new Date().toISOString(),
});

export const findAccountByPhone = (accounts, phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return (accounts || []).find((account) => normalizePhone(account.phone) === normalized);
};

export const verifyPassword = (account, password) => {
  if (!account) return false;
  const stored = String(account.password || '');
  if (stored.startsWith('k2$')) {
    const parts = stored.split('$');
    return parts.length === 3 && hashWithSalt(parts[1], password) === stored;
  }
  /* توافق مع حسابات النسخة السابقة المُجزَّأة بالخوارزمية القديمة */
  return stored === legacyHashPassword(password);
};

/* حسابات تجريبية للتجار الافتراضيين حتى تعمل بوابة التاجر بدخول حقيقي
   بدلًا من قائمة اختيار تسمح بانتحال أي متجر. */
export const DEMO_TRADER_PASSWORD = 'Trader@2026';

export const buildStarterAccounts = (traders = []) =>
  traders.map((trader, index) => ({
    id: `acc-seed-${index + 1}`,
    role: 'trader',
    name: trader.name,
    phone: `0100000000${index + 1}`,
    password: hashPassword(DEMO_TRADER_PASSWORD),
    city: trader.city,
    specialty: trader.specialty,
    about: '',
    traderId: trader.id,
    createdAt: 'seed',
  }));

/* ===== بيانات مالك الموقع ===== */

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};

export const OWNER_USERNAME = String(env.VITE_OWNER_USERNAME || 'owner').trim();
export const OWNER_PASSWORD = String(env.VITE_OWNER_PASSWORD || 'Kawkap@2026');
export const OWNER_USES_DEFAULTS =
  OWNER_USERNAME === 'owner' && OWNER_PASSWORD === 'Kawkap@2026';

export const checkOwnerCredentials = (username, password) => {
  const user = toLatinDigits(username).trim().toLowerCase();
  const pass = String(password ?? '').trim();
  if (!user && !pass) return { ok: false, error: 'أدخل اسم المستخدم وكلمة المرور.' };
  if (!user) return { ok: false, error: 'أدخل اسم المستخدم.' };
  if (!pass) return { ok: false, error: 'أدخل كلمة المرور.' };
  if (user !== OWNER_USERNAME.toLowerCase() || pass !== OWNER_PASSWORD)
    return { ok: false, error: 'بيانات الدخول غير صحيحة. هذه البوابة مخصصة لمالك الموقع فقط.' };
  return { ok: true };
};
