/*
  طبقة تخزين آمنة + إدارة حسابات محلية لكوكب كراكيب.

  سبب وجود الملف: الوصول المباشر إلى localStorage/sessionStorage يرمي استثناءً
  في وضع التصفح الخاص، وداخل الإطارات (iframe)، وعند منع تخزين الطرف الثالث.
  كان هذا الاستثناء يكسر دخول المالك ويمنع حفظ التسجيل. كل الوصول صار هنا
  محاطًا بـ try/catch مع بديل في الذاكرة حتى تستمر الواجهة في العمل.
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
   تجزئة محلية بسيطة لتفادي حفظ كلمة المرور كنص صريح في المتصفح.
   في الإنتاج يجب أن تتم المصادقة على الخادم (Supabase Auth أو Edge Function). */

export const hashPassword = (value) => {
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
  name: String(name ?? '').trim(),
  phone: normalizePhone(phone),
  password: hashPassword(password),
  city: String(city ?? '').trim(),
  specialty: String(specialty ?? '').trim(),
  about: String(about ?? '').trim(),
  traderId,
  createdAt: new Date().toISOString(),
});

export const findAccountByPhone = (accounts, phone) => {
  const normalized = normalizePhone(phone);
  if (!normalized) return undefined;
  return (accounts || []).find((account) => normalizePhone(account.phone) === normalized);
};

export const verifyPassword = (account, password) =>
  !!account && account.password === hashPassword(password);

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
