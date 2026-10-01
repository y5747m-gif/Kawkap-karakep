/**
 * مصدر واحد لهوية كوكب كراكيب.
 * لتغيير اللوجو الرسمي: استبدل الملف في public/ ثم حدّث المسار هنا فقط،
 * وسينعكس على الهيدر، صفحة المالك، الـfavicon، الـmanifest وبطاقة الهيرو.
 */
export const BRAND = {
  name: 'كوكب كراكيب',
  tagline: 'سوق إعادة الاستخدام',
  logo: '/logo.svg', // اللوجو الرسمي
  logoMark: '/logo.svg', // نسخة مربعة للأيقونات
  poster: '/storyboard/hero-poster.jpg', // لقطة الهيرو البديلة
  colors: {
    green: '#087f5b',
    mint: '#d9f8eb',
    amber: '#f5b942',
    navy: '#050a18',
    cyan: '#3fd0ff',
    pink: '#ff2e86',
  },
};

export default BRAND;
