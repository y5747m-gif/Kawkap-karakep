# كوكب كراكيب
منصة Marketplace عربية، RTL وMobile First، لبيع وشراء وإعادة استخدام المواد المستعملة والقابلة للتدوير.

## التشغيل
```bash
npm install
cp .env.example .env.local
npm run dev
```
ثم افتح `http://localhost:5173`. للإنتاج: `npm run build`.

## البنية
- `src/main.jsx`: الواجهات، التنقل، السلة، المفضلة والنماذج التفاعلية.
- `src/data.js`: بيانات العرض المنفصلة عن الإنتاج.
- `src/styles.css`: نظام التصميم المتجاوب والوضع الداكن.
- `supabase/schema.sql`: مخطط PostgreSQL وسياسات RLS الأساسية.
- `public/`: الشعار، PWA manifest، Service Worker وSEO.

## Supabase
1. أنشئ مشروعًا وشغّل `supabase/schema.sql` في SQL Editor.
2. فعّل Email/Phone في Authentication، وأضف رابط الموقع إلى Redirect URLs.
3. أنشئ bucket باسم `product-images`، بحد 8 صور وMIME: `image/jpeg,image/png,image/webp`، وأضف سياسات الرفع للمستخدم الموثق.
4. ضع URL وanon key في `.env.local`. لا تضع service-role key في الواجهة.

## الخرائط
الواجهة جاهزة لطبقة مزود. استخدم OpenStreetMap عبر Leaflet أو ضع Mapbox public token في `VITE_MAPBOX_TOKEN`. يجب حفظ الإحداثيات الفعلية فقط بعد موافقة المستخدم؛ بيانات العرض الحالية ليست مواقع إنتاج.

## النشر على Vercel
اربط المستودع، اختر Vite، Build Command: `npm run build`، Output: `dist`، ثم أضف متغيرات البيئة. أضف rewrite من `/(.*)` إلى `/index.html` لتوجيه SPA، وسجّل نطاق الإنتاج في Supabase Auth.

## الأمان والإنتاج
RLS مفعّل كبداية. أضف Edge Functions للـ rate limiting، فحص الملفات server-side، صلاحيات admin claims، والتحقق بـ Zod قبل الإطلاق. الدفع الإلكتروني غير مفعل؛ الواجهة تعرض الدفع عند الاستلام فقط. الصور التجريبية من Unsplash وتُستبدل بملفات Storage في الإنتاج.
