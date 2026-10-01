/* يضبط الوضع الداكن قبل أول رسم للصفحة حتى لا يومض الثيم الفاتح
   عند فتح الموقع على جهاز اختر الوضع الداكن فيه. */
(function () {
  try {
    var stored = window.localStorage ? window.localStorage.getItem('kawkap_dark') : null;
    if (stored === '1') document.documentElement.classList.add('dark');
  } catch (e) {
    /* التخزين محجوب: نكمل بالوضع الفاتح الافتراضي */
  }
})();
