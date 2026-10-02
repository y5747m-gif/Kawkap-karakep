import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{BrowserRouter,useLocation,useNavigate,useParams}from'react-router-dom';
import*as I from'lucide-react';
import{cats,products,starterPriceOffers,starterSaleRequests,starterTraderPrices,starterTraders}from'./data';
import{safeGet,safeSet,safeRemove,readJson,writeJson,normalizePhone,phoneError,passwordError,makeAccount,findAccountByPhone,verifyPassword,buildStarterAccounts,checkOwnerCredentials,OWNER_SESSION_KEY,OWNER_USERNAME,OWNER_USES_DEFAULTS,DEMO_TRADER_PASSWORD,DATA_VERSION,migrateKawkapStorage,throttleStatus,registerFailedAttempt,clearAttempts}from'./auth';
import'./styles.css';
import'./ux-refresh.css';

const number=n=>new Intl.NumberFormat('ar-EG').format(n);
const clampText=(value,max)=>String(value??'').trim().slice(0,max);
const UNITS=['كجم','قطعة','مجموعة','طن'];
const OWNER_PHONE='01013178718';
const OWNER_WHATSAPP_NUMBER='201013178718';
const ownerWhatsappUrl=request=>{
  const text=[
    'طلب بيع جديد من كوكب كراكيب',
    `رقم الطلب: ${request.id}`,
    `اسم العميل: ${request.customerName}`,
    `رقم العميل: ${request.phone}`,
    `المطلوب: ${request.title}`,
    `التصنيف: ${request.category}`,
    `الكمية: ${request.quantity}`,
    `المنطقة: ${request.location}`,
    `العنوان التفصيلي: ${request.address}`,
    `الوقت المناسب: ${request.pickupTime}`,
    `الوصف: ${request.description}`,
  ].join('\n');
  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
};
const PAGE_TITLES={'/sell':'أرسل طلب بيع','/orders':'طلبات البيع','/cart':'طلبات البيع','/traders':'دليل التجار الموثوقين','/chat':'المحادثات','/market':'فرص بيع معتمدة','/register':'إنشاء حساب','/login':'تسجيل الدخول','/signin':'تسجيل الدخول','/trader-login':'بوابة التاجر','/trader':'بوابة التاجر','/notifications':'الإشعارات','/profile':'حسابي','/owner-login':'بوابة مالك الموقع','/admin':'بوابة مالك الموقع','/about':'عن المنصة'};
function useStored(key,fallback){const[value,setValue]=useState(()=>readJson(key,fallback));useEffect(()=>{writeJson(key,value)},[key,value]);return[value,setValue]}
function Logo(){return <div className="logo" aria-label="كوكب كراكيب"><span className="logoMark" aria-hidden="true"><img src="/logo.svg" alt="" width="48" height="48"/></span><span className="logoCopy"><span className="logoName">كوكب <b>كراكيب</b></span><small>بيع أسهل · قيمة أكبر</small></span></div>}
const requestState={review:['قيد مراجعة المالك','review'],assigned:['أُسند إلى تاجر','assigned'],contacted:['بانتظار اتفاق التاجر','contacted'],completed:['اكتمل البيع','completed'],rejected:['يحتاج تعديل','rejected']};
function Status({value}){const[label,kind]=requestState[value]||requestState.review;return <span className={'statusPill '+kind}><i></i>{label}</span>}
function Stars({rating}){return <span className="stars"><I.Star fill="currentColor"/> {Number(rating).toFixed(1)}</span>}
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return{error}}
  componentDidUpdate(prev){if(prev.resetKey!==this.props.resetKey&&this.state.error)this.setState({error:null})}
  render(){if(this.state.error)return <section className="wrap page crashPage"><div className="crashCard"><I.ShieldAlert/><h1>حدث خطأ غير متوقع</h1><p>نعتذر، تعذر عرض هذه الصفحة. بياناتك المحفوظة سليمة، ويمكنك إعادة المحاولة أو العودة للرئيسية.</p><div className="authActions"><button className="primary" onClick={()=>window.location.reload()}><I.RotateCcw/> إعادة تحميل</button><button className="secondary" onClick={()=>{this.setState({error:null});this.props.go&&this.props.go('/')}}><I.House/> الرئيسية</button></div></div></section>;return this.props.children}
}
function useEscape(close){useEffect(()=>{if(!close)return;const onKey=e=>{if(e.key==='Escape')close()};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[close])}

function App(){
  const nav=useNavigate();const{pathname,search}=useLocation();
  const[dark,setDark]=useState(()=>safeGet('kawkap_dark')==='1');
  const[toast,setToast]=useState('');
  const[traders,setTraders]=useStored('kawkap_traders',starterTraders);
  const[requests,setRequests]=useStored('kawkap_sale_requests',starterSaleRequests);
  const[priceOffers,setPriceOffers]=useStored('kawkap_price_offers',starterPriceOffers);
  const[traderPrices,setTraderPrices]=useStored('kawkap_trader_prices',starterTraderPrices);
  const[notifications,setNotifications]=useStored('kawkap_notifications',[{id:'notice-owner-start',audience:'owner',title:'طلبات بيع تحتاج مراجعتك',body:'توجد طلبات بانتظار قرارك وإسنادها إلى تاجر مناسب.',time:'الآن',read:false,type:'request'}]);
  const[clientCount,setClientCount]=useStored('kawkap_client_count',12840);
  const[currentUser,setCurrentUser]=useStored('kawkap_current_user',null);
  const[ratedTraders,setRatedTraders]=useStored('kawkap_rated_traders',[]);
  const[accounts,setAccounts]=useStored('kawkap_accounts',buildStarterAccounts(starterTraders));
  const[ownerSession,setOwnerSession]=useState(()=>safeGet(OWNER_SESSION_KEY,{session:true})==='active');
  const[installPrompt,setInstallPrompt]=useState(null);
  useEffect(()=>{document.documentElement.classList.toggle('dark',dark);safeSet('kawkap_dark',dark?'1':'0')},[dark]);
  useEffect(()=>{const base=pathname.startsWith('/request/')?'تفاصيل طلب البيع':PAGE_TITLES[pathname]||(pathname==='/'?'منصة بيع الكراكيب بإشراف موثوق':'الصفحة غير موجودة');document.title=`${base} | كوكب كراكيب`},[pathname]);
  useEffect(()=>{window.scrollTo({top:0,left:0,behavior:'instant'})},[pathname]);
  const notify=text=>{setToast(text);window.clearTimeout(window.kawkapToast);window.kawkapToast=window.setTimeout(()=>setToast(''),3200)};
  useEffect(()=>{const capture=e=>{e.preventDefault();setInstallPrompt(e)};const installed=()=>{setInstallPrompt(null);notify('تم تثبيت كوكب كراكيب كتطبيق على جهازك')};window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',installed);return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',installed)}},[]);
  const activeAudience=ownerSession?'owner':currentUser?.role==='trader'?'trader':'client';
  const visibleNotifications=notifications.filter(n=>n.audience==='all'||n.audience===activeAudience||n.audience==='trader'&&n.traderId===currentUser?.traderId);
  const pushNotifications=list=>setNotifications(prev=>[...list.map(n=>({id:`notice-${Date.now()}-${Math.random().toString(16).slice(2)}`,time:'الآن',read:false,...n})),...prev]);
  const requestNotificationPermission=async()=>{try{if(!('Notification'in window)){notify('إشعارات الجهاز غير مدعومة في هذا المتصفح');return}if(Notification.permission==='granted'){notify('إشعارات الجهاز مفعّلة بالفعل لهذا الحساب');return}if(Notification.permission==='denied'){notify('الإشعارات محجوبة من إعدادات المتصفح لهذا الموقع');return}const permission=await Notification.requestPermission();if(permission==='granted'){notify('تم تفعيل إشعارات الجهاز لهذا الحساب');try{new Notification('كوكب كراكيب',{body:'سيصلك تنبيه عند حدوث تحديث جديد.'})}catch{/* إشعار محجوب من المتصفح */}}else notify('يمكنك تفعيل الإشعارات لاحقًا من إعدادات المتصفح')}catch{notify('تعذر طلب إذن الإشعارات في هذا المتصفح')}};
  const installApp=async()=>{if(installPrompt){installPrompt.prompt();const result=await installPrompt.userChoice;if(result.outcome==='accepted')notify('يجري تثبيت التطبيق على جهازك');setInstallPrompt(null)}else notify('لتثبيت التطبيق: افتح قائمة المتصفح ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».')};
  const createRequest=data=>{
    const clean={
      customerName:clampText(data.customerName,80),
      title:clampText(data.title,80),
      category:clampText(data.category,40),
      quantity:clampText(data.quantity,30),
      location:clampText(data.location,80),
      description:clampText(data.description,600),
      phone:normalizePhone(data.phone),
      address:clampText(data.address,300),
      pickupTime:clampText(data.pickupTime,100),
    };
    if(clean.customerName.length<2)return{ok:false,error:'اكتب اسم العميل كاملًا (حرفان على الأقل).'};
    if(clean.title.length<3)return{ok:false,error:'اكتب عنوانًا واضحًا للطلب (٣ أحرف على الأقل).'};
    if(!clean.category)return{ok:false,error:'اختر تصنيف الكراكيب.'};
    if(clean.description.length<5)return{ok:false,error:'اكتب وصفًا مختصرًا لما تريد بيعه.'};
    const badPhone=phoneError(clean.phone);
    if(badPhone)return{ok:false,error:badPhone};
    if(!clean.location)return{ok:false,error:'أدخل المنطقة والمحافظة.'};
    if(!clean.address)return{ok:false,error:'أدخل العنوان التفصيلي للاستلام.'};
    if(!clean.pickupTime)return{ok:false,error:'أدخل الوقت المناسب للتواصل أو الاستلام.'};
    const id=`S-${Date.now().toString(36).slice(-4).toUpperCase()}${Math.floor(Math.random()*36).toString(36).toUpperCase()}`;
    const request={...clean,id,status:'review',traderId:null,createdAt:'منذ لحظات',image:data.image};
    setRequests(prev=>[request,...prev]);
    pushNotifications([{audience:'owner',type:'request',title:'طلب بيع جديد يحتاج مراجعة',body:`${clean.customerName} — ${clean.title} في ${clean.location}`},{audience:'client',type:'request',title:'تم استلام طلب البيع',body:'وصل طلبك إلى المالك وسيتم إشعارك عند الموافقة والإسناد.'}]);
    notify(`تم تجهيز الطلب وإرساله للمالك عبر واتساب ${OWNER_PHONE}`);
    return{ok:true,id,whatsappUrl:ownerWhatsappUrl(request)};
  };
  const register=({role,data})=>{
    const name=String(data.name||'').trim();
    const password=String(data.password||'');
    const confirm=String(data.confirm||'');
    if(name.length<2)return{ok:false,error:'أدخل الاسم كاملًا (حرفان على الأقل).'};
    const badPhone=phoneError(data.phone);
    if(badPhone)return{ok:false,error:badPhone};
    const badPassword=passwordError(password);
    if(badPassword)return{ok:false,error:badPassword};
    if(password!==confirm)return{ok:false,error:'كلمتا المرور غير متطابقتين.'};
    const phone=normalizePhone(data.phone);
    if(findAccountByPhone(accounts,phone))return{ok:false,error:'هذا الرقم مسجّل بالفعل. سجّل الدخول بدلًا من إنشاء حساب جديد.'};
    if(role==='client'){
      const account=makeAccount({role:'client',name,phone,password,city:data.city});
      setAccounts(prev=>[account,...prev]);
      setClientCount(v=>(Number(v)||0)+1);
      setCurrentUser({role:'client',accountId:account.id});
      pushNotifications([{audience:'client',type:'welcome',title:'أهلًا بك في كوكب كراكيب',body:'تم تسجيلك بخصوصية. يمكنك الآن إرسال طلب بيع.'},{audience:'owner',type:'client',title:'عميل جديد في العداد',body:'تم تحديث عداد العملاء من دون إظهار أي بيانات شخصية.'}]);
      notify('تم إنشاء حسابك كعميل بنجاح. خصوصيتك محفوظة.');
      return{ok:true,role:'client'};
    }
    const city=String(data.city||'').trim();
    if(!city)return{ok:false,error:'أدخل المدينة أو المنطقة.'};
    const specialty=String(data.specialty||'').trim()||cats[0][0];
    const about=String(data.about||'').trim();
    const id=`tr-${Date.now()}`;
    const trader={id,name,initial:name.charAt(0)||'ت',rating:0,reviews:0,specialty,city,phone,about,status:'pending',verified:false,reply:'بانتظار اعتماد المالك'};
    const account=makeAccount({role:'trader',name,phone,password,city,specialty,about,traderId:id});
    setTraders(prev=>[trader,...prev]);
    setAccounts(prev=>[account,...prev]);
    setCurrentUser({role:'trader',traderId:id,accountId:account.id});
    pushNotifications([{audience:'owner',type:'trader',title:'طلب تسجيل تاجر جديد',body:`${name} بانتظار الاعتماد في سجل التجار — ${phone}`},{audience:'trader',traderId:id,type:'trader',title:'تم استلام تسجيلك كتاجر',body:'سيُتاح لك المتجر المصغّر بعد اعتماد مالك الموقع.'}]);
    notify('تم تسجيل طلب التاجر وسيظهر لمالك الموقع لاعتماده');
    return{ok:true,role:'trader'};
  };
  const login=({phone,password})=>{
    const normalized=normalizePhone(phone);
    if(!normalized)return{ok:false,error:'أدخل رقم الهاتف المسجّل.'};
    const throttle=throttleStatus('login:'+normalized);
    if(throttle.locked)return{ok:false,error:throttle.message};
    if(!String(password||''))return{ok:false,error:'أدخل كلمة المرور.'};
    const account=findAccountByPhone(accounts,normalized);
    if(!account){registerFailedAttempt('login:'+normalized);return{ok:false,error:'لا يوجد حساب بهذا الرقم. أنشئ حسابًا جديدًا أولًا.'}}
    if(!verifyPassword(account,password)){
      registerFailedAttempt('login:'+normalized);
      const next=throttleStatus('login:'+normalized);
      if(next.locked)return{ok:false,error:next.message};
      return{ok:false,error:next.remaining<=2?`كلمة المرور غير صحيحة. بقي لديك ${number(next.remaining)} ${next.remaining===1?'محاولة':'محاولات'} قبل الإيقاف المؤقت.`:'كلمة المرور غير صحيحة.'};
    }
    clearAttempts('login:'+normalized);
    if(account.role==='trader'){
      const trader=traders.find(t=>t.id===account.traderId);
      if(!trader)return{ok:false,error:'تعذر العثور على ملف المتجر المرتبط بهذا الحساب. تواصل مع مالك الموقع.'};
      setCurrentUser({role:'trader',traderId:trader.id,accountId:account.id});
      notify(`أهلًا بعودتك، ${trader.name}`);
      return{ok:true,role:'trader'};
    }
    setCurrentUser({role:'client',accountId:account.id});
    notify('تم تسجيل الدخول بنجاح');
    return{ok:true,role:'client'};
  };
  const logout=()=>{setCurrentUser(null);notify('تم تسجيل الخروج من حسابك')};
  const ownerLogin=(username,password)=>{
    const throttle=throttleStatus('owner');
    if(throttle.locked)return{ok:false,error:throttle.message};
    const result=checkOwnerCredentials(username,password);
    if(!result.ok){registerFailedAttempt('owner');const next=throttleStatus('owner');if(next.locked)return{ok:false,error:next.message};return result}
    clearAttempts('owner');
    safeSet(OWNER_SESSION_KEY,'active',{session:true});
    setOwnerSession(true);
    notify('تم تسجيل دخول مالك الموقع');
    requestNotificationPermission();
    return{ok:true};
  };
  const ownerLogout=()=>{safeRemove(OWNER_SESSION_KEY,{session:true});setOwnerSession(false);notify('تم تسجيل خروج المالك بأمان')};
  const assignRequest=(requestId,traderId)=>{
    const request=requests.find(r=>r.id===requestId);
    if(!request){notify('الطلب غير موجود');return}
    if(!traderId){notify('اختر تاجرًا من القائمة أولًا');return}
    const trader=traders.find(t=>t.id===traderId);
    if(!trader||trader.status!=='active'){notify('اختر تاجرًا نشطًا ومعتمدًا أولًا');return}
    setRequests(prev=>prev.map(r=>r.id===requestId?{...r,status:'assigned',traderId}:r));
    pushNotifications([{audience:'client',type:'approved',title:'وافق المالك على طلب البيع',body:`تم توجيه طلب «${request.title}» إلى ${trader.name}.`},{audience:'trader',traderId,type:'assignment',title:'تم إسناد طلب بيع جديد إليك',body:`الطلب «${request.title}» جاهز لتضع عرض شراءك.`},{audience:'owner',type:'assignment',title:'تم إسناد الطلب بنجاح',body:`تم توجيه ${request.id} إلى ${trader.name}.`}]);
    notify(`تمت إحالة الطلب إلى ${trader.name}`);
  };
  const savePriceOffer=data=>{
    const request=requests.find(r=>r.id===data.requestId);
    if(!request||request.traderId!==data.traderId){notify('لا يمكن إضافة عرض شراء لطلب غير مُسند إليك');return}
    const amount=Number(data.amount);
    if(!Number.isFinite(amount)||amount<0||amount>10000000){notify('أدخل سعرًا صحيحًا بين صفر و١٠ ملايين');return}
    const clean={...data,amount,unit:UNITS.includes(data.unit)?data.unit:'كجم',note:clampText(data.note,300)};
    setPriceOffers(prev=>{const old=prev.find(o=>o.requestId===clean.requestId&&o.traderId===clean.traderId);return old?prev.map(o=>o.id===old.id?{...o,...clean,updatedAt:'الآن'}:o):[{...clean,id:`offer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`,updatedAt:'الآن'},...prev]});
    pushNotifications([{audience:'client',type:'price',title:'وصل عرض شراء من التاجر',body:`قدّم التاجر سعر ${number(clean.amount)} ج.م / ${clean.unit} لطلب «${request.title}».`},{audience:'owner',type:'price',title:'تاجر أضاف أو عدّل سعرًا',body:`تم تحديث عرض الشراء للطلب ${request.id}.`}]);
    notify('تم حفظ سعر الشراء وإرسال إشعار للأطراف المعنية');
  };
  const saveTraderPrice=data=>{
    const name=clampText(data.name,60);
    if(name.length<2){notify('أدخل اسم المادة أو الخدمة');return}
    const amount=Number(data.amount);
    if(!Number.isFinite(amount)||amount<0||amount>10000000){notify('أدخل سعرًا صحيحًا بين صفر و١٠ ملايين');return}
    const clean={...data,name,amount,unit:UNITS.includes(data.unit)?data.unit:'كجم',category:cats.some(c=>c[0]===data.category)?data.category:cats[0][0]};
    setTraderPrices(prev=>data.id?prev.map(p=>p.id===data.id?{...p,...clean}:p):[{...clean,id:`price-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`},...prev]);
    notify('تم حفظ السعر في قائمة متجرك');
  };
  const rateTrader=(traderId,rating)=>{
    const score=Math.min(5,Math.max(1,Math.round(Number(rating)||0)));
    if(!score){notify('اختر تقييمًا من نجمة إلى خمس نجوم');return}
    if(ratedTraders.includes(traderId)){notify('قيّمت هذا التاجر بالفعل من هذا الجهاز');return}
    setRatedTraders(prev=>[...prev,traderId]);
    setTraders(prev=>prev.map(t=>{if(t.id!==traderId)return t;const reviews=Number(t.reviews)||0;const current=Number(t.rating)||0;const next=(current*reviews+score)/(reviews+1);return{...t,rating:Math.round(next*10)/10,reviews:reviews+1}}));
    pushNotifications([{audience:'trader',traderId,type:'rating',title:'وصل تقييم جديد لمتجرك',body:`قام عميل بإضافة تقييم ${score} من ٥.`}]);
    notify('شكرًا لتقييمك، تم حفظه للتاجر');
  };
  const addTrader=data=>{
    const name=clampText(data.name,60);
    if(name.length<2){notify('أدخل اسم التاجر أو المنشأة كاملًا');return}
    const city=clampText(data.city,60);
    if(!city){notify('أدخل المدينة أو المنطقة');return}
    const phone=normalizePhone(data.phone);
    if(phone&&phoneError(phone)){notify(phoneError(phone));return}
    if(phone&&traders.some(t=>normalizePhone(t.phone)===phone)){notify('يوجد تاجر مسجّل بنفس رقم التواصل بالفعل');return}
    const rating=Math.min(5,Math.max(0,Number(data.rating)||0));
    const specialty=cats.some(c=>c[0]===data.specialty)?data.specialty:cats[0][0];
    const id=`tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
    setTraders(prev=>[{id,name,initial:name.charAt(0)||'ت',specialty,city,phone,rating,reviews:0,status:'active',verified:true,reply:'تاجر مضاف من المالك'},...prev]);
    pushNotifications([{audience:'owner',type:'trader',title:'تمت إضافة تاجر يدويًا',body:`تم اعتماد ${name} وإضافته إلى الدليل.`}]);
    notify('تمت إضافة التاجر واعتماده');
  };
  const markAllRead=()=>setNotifications(prev=>prev.map(n=>visibleNotifications.some(v=>v.id===n.id)?{...n,read:true}:n));
  const adminProps={go:nav,traders,setTraders,requests,assignRequest,clientCount,addTrader,requestNotificationPermission,ownerSession,ownerLogin,onLogout:ownerLogout};
  let page;
  if(pathname==='/')page=<Home go={nav} clientCount={clientCount} traders={traders}/>;
  else if(pathname==='/market')page=<Marketplace go={nav} requests={requests} traders={traders}/>;
  else if(pathname.startsWith('/request/'))page=<RequestDetail go={nav} requests={requests} traders={traders} priceOffers={priceOffers} currentUser={currentUser} isOwner={ownerSession}/>;
  else if(pathname==='/sell')page=<Sell go={nav} createRequest={createRequest}/>;
  else if(pathname==='/orders'||pathname==='/cart')page=<SaleRequests go={nav} requests={requests} traders={traders} priceOffers={priceOffers}/>;
  else if(pathname==='/traders')page=<Traders go={nav} traders={traders} rateTrader={rateTrader} ratedTraders={ratedTraders}/>;
  else if(pathname==='/chat')page=<Chat key={search} go={nav} traders={traders}/>;
  else if(pathname==='/register')page=<Registration go={nav} register={register} requestNotificationPermission={requestNotificationPermission}/>;
  else if(pathname==='/trader-login'||pathname==='/trader')page=<TraderAccess go={nav} traders={traders} currentUser={currentUser} login={login} logout={logout} requests={requests} priceOffers={priceOffers} traderPrices={traderPrices} savePriceOffer={savePriceOffer} saveTraderPrice={saveTraderPrice} requestNotificationPermission={requestNotificationPermission}/>;
  else if(pathname==='/login'||pathname==='/signin')page=<Login go={nav} login={login} logout={logout} currentUser={currentUser} traders={traders}/>;
  else if(pathname==='/notifications')page=<NotificationsPage go={nav} notifications={visibleNotifications} audience={activeAudience} markAllRead={markAllRead} requestNotificationPermission={requestNotificationPermission}/>;
  else if(pathname==='/profile')page=<Profile go={nav} clientCount={clientCount} currentUser={currentUser} traders={traders} logout={logout}/>;
  else if(pathname==='/owner-login'||pathname==='/admin')page=<OwnerAccess {...adminProps}/>;
  else if(pathname==='/about')page=<About/>;
  else page=<NotFound go={nav}/>;
  const unread=visibleNotifications.filter(n=>!n.read).length;
  return <ErrorBoundary resetKey={pathname} go={nav}><a className="skipLink" href="#main">تجاوز إلى المحتوى الرئيسي</a><Header go={nav} path={pathname} dark={dark} setDark={setDark} unread={unread} onInstall={installApp} currentUser={currentUser} isOwner={ownerSession} onLogout={logout} onOwnerLogout={ownerLogout}/><main id="main">{page}</main><Footer go={nav}/><Bottom go={nav} path={pathname}/>{toast&&<div className="toast" role="status" aria-live="polite"><I.CircleCheck/> {toast}</div>}</ErrorBoundary>;
}
function Header({go,path,dark,setDark,unread,onInstall,currentUser,isOwner,onLogout,onOwnerLogout}){
  const[open,setOpen]=useState(false);
  const visit=to=>{setOpen(false);go(to)};
  const act=fn=>{setOpen(false);fn()};
  const active=to=>to==='/'?path==='/':path===to||to==='/orders'&&path==='/cart';
  const accountPath=isOwner?'/owner-login':currentUser?.role==='trader'?'/trader':'/profile';
  const accountLabel=isOwner?'لوحة المالك':currentUser?'حسابي':'دخول';
  useEscape(open?()=>setOpen(false):null);
  const navItems=[['/','الرئيسية'],['/sell','بيع كراكيبك'],['/orders','طلباتي'],['/traders','التجار']];
  return <header><div className="top">
    <button type="button" className="logoButton" onClick={()=>visit('/')} aria-label="العودة إلى الرئيسية"><Logo/></button>
    <nav className="mainNav" aria-label="التنقل الرئيسي">{navItems.map(([to,label])=><button type="button" key={to} className={active(to)?'active':''} aria-current={active(to)?'page':undefined} onClick={()=>visit(to)}>{label}</button>)}</nav>
    <div className="headerActions">
      <button type="button" className="headerSell" onClick={()=>visit('/sell')}><I.Camera/> <span>ابدأ البيع</span></button>
      <button type="button" className={'icon notificationButton '+(unread?'hasUnread':'')} onClick={()=>visit('/notifications')} aria-label="الإشعارات"><I.Bell/>{unread>0&&<em>{unread>9?'٩+':number(unread)}</em>}</button>
      <button type="button" className="headerAccount" onClick={()=>visit(accountPath)}>{isOwner?<I.LayoutDashboard/>:<I.UserRound/>}<span>{accountLabel}</span></button>
      <button type="button" className="icon themeButton" onClick={()=>setDark(!dark)} aria-label={dark?'استخدام الوضع الفاتح':'استخدام الوضع الداكن'}>{dark?<I.Sun/>:<I.Moon/>}</button>
      <div className="moreMenu"><button type="button" className="icon menuButton" aria-label={open?'إغلاق القائمة':'فتح القائمة'} aria-expanded={open} aria-controls="site-menu" onClick={()=>setOpen(!open)}>{open?<I.X/>:<I.Menu/>}</button>{open&&<div className="menuPanel" id="site-menu"><b>روابط سريعة</b><button onClick={()=>visit('/market')}><I.Search/> استكشف فرص البيع</button><button onClick={()=>visit('/chat')}><I.MessageCircle/> المحادثات</button>{!currentUser&&<><button onClick={()=>visit('/register')}><I.UserPlus/> إنشاء حساب</button><button onClick={()=>visit('/login')}><I.LogIn/> تسجيل الدخول</button></>}<button onClick={()=>visit('/trader-login')}><I.Store/> بوابة التاجر</button><button onClick={()=>act(onInstall)}><I.Download/> تثبيت التطبيق</button><button onClick={()=>visit('/about')}><I.Info/> عن المنصة</button>{isOwner?<button className="ownerMenu" onClick={()=>visit('/owner-login')}><I.LayoutDashboard/> لوحة المالك</button>:<button className="ownerMenu" onClick={()=>visit('/owner-login')}><I.LockKeyhole/> دخول المالك</button>}{currentUser&&<button onClick={()=>act(onLogout)}><I.LogOut/> خروج من الحساب</button>}{isOwner&&<button onClick={()=>act(onOwnerLogout)}><I.LogOut/> خروج المالك</button>}</div>}</div>
    </div>
  </div></header>;
}
function Footer({go}){return <footer className="siteFooter"><div className="wrap footerGrid"><div className="footerBrand"><button type="button" className="logoButton" onClick={()=>go('/')}><Logo/></button><p>نحوّل الكراكيب إلى قيمة بخطوات واضحة، وتحت إشراف موثوق من أول طلب حتى الاتفاق.</p><a href={`https://wa.me/${OWNER_WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><I.MessageCircle/> تواصل عبر واتساب</a></div><div className="footerLinks"><b>ابدأ الآن</b><button onClick={()=>go('/sell')}>أرسل طلب بيع</button><button onClick={()=>go('/orders')}>تابع طلباتك</button><button onClick={()=>go('/traders')}>دليل التجار</button></div><div className="footerLinks"><b>كوكب كراكيب</b><button onClick={()=>go('/about')}>عن المنصة</button><button onClick={()=>go('/register')}>إنشاء حساب</button><button onClick={()=>go('/trader-login')}>بوابة التاجر</button></div></div><div className="wrap footerBottom"><span>© {new Date().getFullYear()} كوكب كراكيب</span><span><I.ShieldCheck/> خصوصيتك أولويتنا</span></div></footer>}
function Bottom({go,path}){const links=[[I.House,'الرئيسية','/'],[I.Send,'بيع','/sell'],[I.ClipboardList,'طلباتي','/orders'],[I.Store,'التجار','/traders'],[I.UserRound,'حسابي','/profile']];const active=to=>path===to||to==='/orders'&&path==='/cart';return <nav className="bottom" aria-label="التنقل السفلي">{links.map(([C,label,to])=><button className={active(to)?'active':''} aria-current={active(to)?'page':undefined} onClick={()=>go(to)} key={to}><span><C/></span>{label}</button>)}</nav>}
function NotFound({go}){return <section className="wrap page"><div className="empty notFound"><I.SearchX/><h1>الصفحة غير موجودة</h1><p>ربما تغيّر الرابط أو حُذفت الصفحة. يمكنك العودة للرئيسية أو استكشاف بقية المنصة.</p><div className="authActions"><button className="primary" onClick={()=>go('/')}><I.House/> العودة للرئيسية</button><button className="secondary" onClick={()=>go('/sell')}><I.Send/> أرسل طلب بيع</button></div></div></section>}

function Home({go,clientCount,traders}){const active=traders.filter(t=>t.status==='active');return <>
  <section className="hero wrap sellHero">
    <div className="heroText"><span className="eyebrow"><I.Sparkles/> أسهل طريقة تبيع بها كراكيبك</span><h1>كراكيبك لها قيمة.<br/><mark>نوصّلها للتاجر الصح.</mark></h1><p>صوّر ما تريد بيعه وأرسل بيانات بسيطة. يراجع المالك طلبك، يختار التاجر المناسب، وتتابع كل خطوة من مكان واحد.</p><div className="heroPromises"><span><I.Timer/> طلبك في دقيقتين</span><span><I.EyeOff/> بياناتك غير معلنة</span><span><I.BadgeCheck/> تجار تحت المراجعة</span></div><div className="actions"><button className="primary heroCta" onClick={()=>go('/sell')}><I.Camera/> صوّر وابدأ البيع <I.ArrowLeft/></button><button className="secondary" onClick={()=>go('/orders')}><I.ClipboardList/> تابع طلبك</button></div><div className="trust"><span><b>+{number(clientCount)}</b> عميل مسجّل بخصوصية</span><span><b>{number(active.length)}</b> تاجر موثوق ونشط</span><span><b>٤ خطوات</b> من الطلب إلى العرض</span></div></div>
    <div className="heroVisual" aria-label="رحلة طلب البيع في كوكب كراكيب"><div className="heroBrandMark"><img src="/logo.svg" alt="شعار كوكب كراكيب"/><span>بيع منظم وآمن</span></div><div className="journeyCard"><div className="journeyHead"><span><I.Route/></span><div><small>رحلة طلبك</small><b>كل خطوة واضحة أمامك</b></div><em>٤ خطوات</em></div><ol><li className="done"><span><I.Check/></span><div><b>أرسل الصور والتفاصيل</b><small>لن تُنشر بياناتك للعامة</small></div></li><li className="current"><span>٢</span><div><b>مراجعة الطلب</b><small>يتأكد المالك من التفاصيل</small></div></li><li><span>٣</span><div><b>اختيار التاجر المناسب</b><small>حسب النوع والمنطقة والتقييم</small></div></li><li><span>٤</span><div><b>استلم عرض الشراء</b><small>وتواصل مع التاجر بأمان</small></div></li></ol></div><div className="heroSafe"><I.LockKeyhole/><span><b>خصوصية كاملة</b><small>بياناتك تظهر للمختص فقط</small></span></div></div>
  </section>
  <section className="wrap quickStart" aria-labelledby="quick-title"><div className="sectionTitle"><div><small>وصول سريع</small><h2 id="quick-title">اختر ما تريد إنجازه</h2></div><p>ثلاثة اختيارات واضحة توصّلك مباشرة إلى هدفك.</p></div><div className="quickGrid"><button className="quickPrimary" onClick={()=>go('/sell')}><span><I.Camera/></span><div><b>أبيع كراكيب الآن</b><small>أرسل الصور والتفاصيل للمالك</small></div><I.ArrowLeft/></button><button onClick={()=>go('/orders')}><span><I.ClipboardList/></span><div><b>أتابع طلبًا سابقًا</b><small>شاهد حالة المراجعة وعرض التاجر</small></div><I.ArrowLeft/></button><button onClick={()=>go('/traders')}><span><I.Store/></span><div><b>أتصفح التجار</b><small>قارن التخصصات والتقييمات</small></div><I.ArrowLeft/></button></div></section>
  <section className="wrap workflowSection"><div className="sectionTitle"><div><small>من البداية إلى الاتفاق</small><h2>أربع خطوات بدون تعقيد</h2></div><span className="processNote"><I.LockKeyhole/> المالك يراجع قبل أي تواصل</span></div><div className="workflow">{[[I.Camera,'١. صوّر وأرسل','أضف صور الكراكيب والنوع والكمية والمنطقة في نموذج واحد.'],[I.ClipboardCheck,'٢. نراجع الطلب','يتأكد مالك الموقع من البيانات ويحافظ على خصوصيتها.'],[I.UserRoundCog,'٣. نختار التاجر','يُسند الطلب إلى تاجر موثوق ومناسب للتخصص والمنطقة.'],[I.MessagesSquare,'٤. استلم العرض','شاهد عرض الشراء ونسّق الاستلام مع التاجر المكلّف.']].map(([C,title,text])=><article key={title}><span><C/></span><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  <section className="wrap section traderPreview"><Title over="اختيارات موثقة" title="تجار بتقييمات حقيقية" action={()=>go('/traders')}/><div className="traderGrid">{active.slice(0,3).map(t=><TraderCard trader={t} key={t.id} go={go}/>)}</div></section>
  <section className="rescue wrap"><div><span className="eyebrow light"><I.EyeOff/> خصوصية العميل أولًا</span><h2>بياناتك لا تظهر للعامة</h2><p>نعرض عدد العملاء فقط. أما اسمك وهاتفك وعنوانك فتظل خاصة، ولا يراها إلا المالك والتاجر الذي اختاره لمتابعة طلبك.</p><button onClick={()=>go('/register')}>أنشئ حسابك بسهولة <I.ArrowLeft/></button></div><div className="ecoStats"><span><I.UsersRound/><b>{number(clientCount)}</b><small>عميل مسجّل</small></span><span><I.BadgeCheck/><b>{number(active.length)}</b><small>تاجر موثوق</small></span><span><I.ShieldCheck/><b>١٠٠٪</b><small>مراجعة قبل التواصل</small></span></div></section>
</>}
function Title({over,title,action}){return <div className="sectionTitle"><div><small>{over}</small><h2>{title}</h2></div>{action&&<button onClick={action}>عرض الكل <I.ArrowLeft/></button>}</div>}

function TraderCard({trader,go,admin=false,onActivate,onSuspend}){return <article className={'traderCard '+(trader.status!=='active'?'pendingTrader':'')}><div className="traderTop"><span className="traderAvatar">{trader.initial}</span><div><h3>{trader.name}{trader.verified&&<I.BadgeCheck/>}</h3><p><I.MapPin/> {trader.city}</p></div><StatusTrader value={trader.status}/></div><div className="traderFacts"><span><I.BriefcaseBusiness/><small>التخصص</small><b>{trader.specialty}</b></span><span><I.Star/><small>التقييم</small><b>{trader.reviews?`${Number(trader.rating).toFixed(1)} / ٥`:'جديد'}</b></span><span><I.MessageCircle/><small>الاستجابة</small><b>{trader.reply}</b></span></div>{admin&&(trader.phone||trader.about)&&<div className="traderContactPrivate"><I.LockKeyhole/><span>{trader.phone&&<b>{trader.phone}</b>}{trader.about&&<em>{trader.about}</em>}</span></div>}{admin?<div className="traderAdminActions">{trader.status==='pending'&&<button className="primary" onClick={()=>onActivate(trader.id)}><I.Check/> اعتماد التاجر</button>}{trader.status==='active'&&<button className="secondary warning" onClick={()=>onSuspend(trader.id)}><I.PauseCircle/> إيقاف مؤقت</button>}{trader.status==='suspended'&&<button className="secondary" onClick={()=>onActivate(trader.id)}><I.RotateCcw/> إعادة التفعيل</button>}</div>:<div className="traderCardFoot"><Stars rating={trader.rating}/><span>{number(trader.reviews)} تقييم</span><button onClick={()=>go('/sell')} disabled={trader.status!=='active'}><I.Route/> اطلب إحالة</button></div>}</article>}
function StatusTrader({value}){const labels={active:'موثّق',pending:'بانتظار الاعتماد',suspended:'موقوف مؤقتًا'};return <span className={'traderStatus '+value}>{labels[value]||value}</span>}

function Marketplace({go,requests,traders}){const{search:queryString}=useLocation();const[search,setSearch]=useState(()=>new URLSearchParams(queryString).get('q')||'');const[category,setCategory]=useState('');const trimmedQuery=search.trim();const list=useMemo(()=>requests.filter(r=>r.status==='assigned').filter(r=>(!category||r.category===category)&&(!trimmedQuery||r.title.includes(trimmedQuery)||r.category.includes(trimmedQuery)||r.location.includes(trimmedQuery))),[requests,trimmedQuery,category]);return <section className="wrap page"><div className="pageHead"><div><small>الفرص التي مرت بمراجعة المنصة</small><h1>فرص بيع مُسندة</h1><p>طلبات اختار لها المالك تاجرًا متخصصًا؛ لا توجد عملية بيع مباشرة خارج الإشراف.</p></div><button className="primary" onClick={()=>go('/sell')}><I.Send/> أرسل طلب بيع</button></div><div className="marketSearch"><I.Search/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث بالنوع أو المنطقة..." aria-label="البحث في فرص البيع"/><button onClick={()=>setSearch('')} aria-label="مسح البحث"><I.X/> مسح</button></div><div className="chips"><button className={!category?'active':''} onClick={()=>setCategory('')}>الكل</button>{cats.slice(0,7).map(c=><button className={category===c[0]?'active':''} onClick={()=>setCategory(c[0])} key={c[0]}>{c[0]}</button>)}</div><div className="resultbar"><b>{number(list.length)} فرصة معتمدة</b><span className="ownerRule"><I.ShieldCheck/> تُسند للتاجر من لوحة المالك فقط</span></div>{list.length?<div className="requestGrid">{list.map(r=><RequestCard request={r} trader={traders.find(t=>t.id===r.traderId)} go={go} key={r.id}/>)}</div>:<Empty go={go}/>}</section>}
function RequestCard({request,trader,go}){return <article className="requestCard"><div className="requestImage"><img src={request.image||products[0].img} alt={request.title} loading="lazy" decoding="async"/><Status value={request.status}/></div><div className="requestBody"><small>{request.category}</small><h3>{request.title}</h3><p><I.Scale/> {request.quantity} <span><I.MapPin/> {request.location}</span></p>{trader?<div className="assignedTrader"><span className="mini">{trader.initial}</span><div><small>التاجر الذي أسنده المالك</small><b>{trader.name} {trader.verified&&<I.BadgeCheck/>}</b></div><Stars rating={trader.rating}/></div>:<div className="awaiting"><I.Clock3/> بانتظار إسناد المالك</div>}<button onClick={()=>go('/request/'+request.id)}>عرض التفاصيل <I.ArrowUpLeft/></button></div></article>}
function Empty({go}){return <div className="empty"><I.SearchX/><h2>لا توجد فرص مطابقة الآن</h2><p>يمكنك إرسال طلب بيع جديد وسيراجعه مالك الموقع.</p><button className="primary" onClick={()=>go('/sell')}>أرسل طلب بيع</button></div>}
function RequestDetail({go,requests,traders,priceOffers,currentUser,isOwner}){const{id}=useParams();const request=requests.find(r=>r.id===id);if(!request)return <Empty go={go}/>;const trader=traders.find(t=>t.id===request.traderId);const offer=priceOffers.find(o=>o.requestId===request.id&&o.traderId===request.traderId);const isAssignedTrader=currentUser?.role==='trader'&&currentUser.traderId===request.traderId;const canViewContact=isAssignedTrader||isOwner;return <section className="wrap page requestDetail"><button className="backLink" onClick={()=>go('/market')}><I.ArrowRight/> العودة لفرص البيع</button><div className="requestDetailGrid"><div className="detailImage"><img src={request.image||products[0].img} alt={request.title} loading="lazy" decoding="async"/></div><div className="requestDetailInfo"><Status value={request.status}/><small>{request.id} · {request.category}</small><h1>{request.title}</h1><p>هذا طلب بيع يمر عبر كوكب كراكيب. لا يبدأ أي اتفاق إلا بعد مراجعة المالك وتوجيه الطلب إلى تاجر مناسب.</p><div className="detailFacts"><span><I.Scale/><small>الكمية</small><b>{request.quantity}</b></span><span><I.MapPin/><small>المنطقة</small><b>{request.location}</b></span><span><I.CalendarClock/><small>أُرسل</small><b>{request.createdAt}</b></span></div>{trader?<><div className="assignedDetail"><div><span className="traderAvatar">{trader.initial}</span><div><small>التاجر المكلّف من المالك</small><b>{trader.name} <I.BadgeCheck/></b><p>{trader.specialty} · <Stars rating={trader.rating}/> · {number(trader.reviews)} تقييم</p></div></div><button className="primary" onClick={()=>go('/chat?trader='+trader.id)}><I.MessageCircle/> ابدأ المحادثة</button></div>{offer?<div className="priceOfferBox"><span><I.Banknote/></span><div><small>عرض شراء التاجر</small><b>{number(offer.amount)} ج.م <em>/ {offer.unit}</em></b><p>{offer.note||'لا توجد ملاحظات إضافية.'}</p></div><time>{offer.updatedAt}</time></div>:<div className="awaitingOffer"><I.BadgeDollarSign/><span>التاجر لم يضف سعر الشراء بعد</span></div>}{canViewContact&&<div className="contactAccess"><div className="contactAccessHead"><I.ContactRound/><div><b>بيانات الاستلام الخاصة</b><small>مرئية للتاجر المُسند ومالك الموقع فقط</small></div></div><p><I.UserRound/> <b>اسم العميل:</b> {request.customerName||'غير مذكور'}</p><p><I.Phone/> <b>الهاتف:</b> {request.phone||'غير متاح'}</p><p><I.MapPinned/> <b>العنوان:</b> {request.address||request.location}</p><p><I.Clock3/> <b>وقت مناسب للتواصل:</b> {request.pickupTime||'يُنسّق عبر المحادثة'}</p></div>}</>:<div className="reviewNotice"><I.ClipboardClock/><div><b>طلبك ما زال لدى المالك</b><p>سيظهر التاجر ويفتح التواصل فور اعتماد الطلب وإسناده.</p></div></div>}</div></div></section>}

function Sell({go,createRequest}){const[files,setFiles]=useState([]);const[error,setError]=useState('');const[done,setDone]=useState('');const[whatsappUrl,setWhatsappUrl]=useState('');
  const pickFiles=e=>{
    setError('');
    const chosen=[...e.target.files];
    if(chosen.length>8){setError('يمكنك إرفاق ٨ صور كحد أقصى.');return}
    for(const file of chosen){
      if(!['image/jpeg','image/png'].includes(file.type)){setError('الصور يجب أن تكون بصيغة JPG أو PNG فقط.');return}
      if(file.size>5*1024*1024){setError('حجم كل صورة يجب ألا يزيد عن ٥ ميجابايت.');return}
    }
    setFiles(chosen);
  };
  const submit=e=>{
    e.preventDefault();
    setError('');
    const form=new FormData(e.currentTarget);
    const quantity=Number(form.get('quantity'));
    if(!Number.isFinite(quantity)||quantity<1||quantity>1000000){setError('أدخل كمية صحيحة (من ١ إلى مليون).');return}
    const category=form.get('category');
    const image=cats.find(c=>c[0]===category)?.[3]||products[0].img;
    const result=createRequest({customerName:form.get('customerName'),title:form.get('title'),category,quantity:`${quantity} ${form.get('unit')}`,location:form.get('location'),description:form.get('description'),phone:form.get('phone'),address:form.get('address'),pickupTime:form.get('pickupTime'),image});
    if(!result||!result.ok){setError((result&&result.error)||'تعذر إرسال الطلب، راجع البيانات وحاول مرة أخرى.');return}
    setFiles([]);
    setWhatsappUrl(result.whatsappUrl||'');
    if(result.whatsappUrl)window.open(result.whatsappUrl,'_blank','noopener,noreferrer');
    setDone(result.id);
  };
if(done)return <section className="success saleSuccess"><span><I.Send/></span><h1>وصل طلب البيع إلى المالك</h1><p>رقم طلبك <b>#{done}</b>. تم تجهيز كل بياناتك وفتح واتساب لإرسالها إلى المالك على الرقم <b dir="ltr">{OWNER_PHONE}</b>.</p>{whatsappUrl&&<a className="primary whatsappAction" href={whatsappUrl} target="_blank" rel="noreferrer"><I.MessageCircle/> إعادة إرسال الطلب للمالك على واتساب</a>}<div className="successPath"><span><I.ClipboardCheck/> مراجعة المالك</span><I.ArrowLeft/><span><I.UserRoundCog/> إسناد لتاجر</span><I.ArrowLeft/><span><I.MessageCircle/> محادثة آمنة</span></div><button className="primary" onClick={()=>go('/orders')}>متابعة طلبات البيع</button></section>;return <section className="wrap page narrow sellPage"><div className="pageHead"><div><small>خطوتك الأولى للبيع</small><h1>أرسل طلب بيع</h1><p>لن يُنشر الطلب ولن يصل إلى أي تاجر قبل موافقة مالك الموقع.</p></div><span className="secureBadge"><I.ShieldCheck/> مراجعة قبل الإسناد</span></div><div className="ownerGate"><span><I.Crown/></span><div><b>إرسال مباشر وسهل للمالك</b><p>بعد الضغط على زر الإرسال، تُفتح رسالة واتساب جاهزة بكل بياناتك للمالك على الرقم <a href={`tel:${OWNER_PHONE}`} dir="ltr">{OWNER_PHONE}</a>، ثم يراجع الطلب ويختار التاجر المناسب.</p></div></div><form className="formCard sellform" onSubmit={submit}><label className="upload"><I.ImagePlus/><b>أضف صور الكراكيب</b><span>حتى ٨ صور بصيغة JPG أو PNG وبحد ٥ ميجابايت للصورة</span><input type="file" accept="image/png,image/jpeg" multiple onChange={pickFiles}/></label>{files.length>0&&<div className="previews">{files.map((file,i)=><span key={file.name+i}><I.Image/>{file.name}<small>{i===0?'صورة رئيسية':''}</small></span>)}</div>}{error&&<div className="loginError" role="alert"><I.CircleAlert/>{error}</div>}<div className="formgrid"><label className="wide">اسم العميل <i>مطلوب</i><input name="customerName" required minLength="2" maxLength="80" autoComplete="name" placeholder="اكتب اسمك بالكامل"/></label><label>ماذا تريد أن تبيع؟ <i>مطلوب</i><input name="title" required maxLength="80" placeholder="مثال: خردة نحاس نظيف"/></label><label>التصنيف <i>مطلوب</i><select name="category" required>{cats.map(c=><option key={c[0]}>{c[0]}</option>)}</select></label><label>الكمية <i>مطلوب</i><input name="quantity" required type="number" min="1" max="1000000" placeholder="0" inputMode="numeric"/></label><label>الوحدة <i>مطلوب</i><select name="unit">{UNITS.map(u=><option key={u}>{u}</option>)}</select></label><label className="wide">وصف الحالة <i>مطلوب</i><textarea name="description" required maxLength="600" placeholder="اكتب الحالة وأي تفاصيل تساعد المالك على اختيار التاجر المناسب"/></label><label>رقم الهاتف للتواصل <i>مطلوب</i><input name="phone" required type="tel" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx"/></label><label>المنطقة والمحافظة <i>مطلوب</i><input name="location" required maxLength="80" placeholder="مثال: مدينة نصر، القاهرة"/></label><label className="wide">العنوان التفصيلي للاستلام <i>مطلوب</i><textarea name="address" required maxLength="300" placeholder="اسم الشارع، رقم المبنى، الدور، وأقرب علامة مميزة"/></label><label className="wide">الوقت الأنسب للتواصل أو الاستلام <i>مطلوب</i><input name="pickupTime" required maxLength="100" placeholder="مثال: يوميًا من ٤ م إلى ٨ م"/></label></div><div className="privateContactNote"><I.LockKeyhole/><span><b>بيانات التواصل والعنوان خاصة.</b> لا تظهر للعامة أو للتجار غير المكلّفين؛ يراها مالك الموقع والتاجر الذي يسند إليه الطلب فقط.</span></div><label className="privacyCheck"><input required type="checkbox"/> أؤكد أن البيانات صحيحة، وأوافق على مراجعة مالك الموقع للطلب قبل إحالته إلى أي تاجر.</label><button className="primary submit whatsappSubmit">إرسال الطلب عبر واتساب <I.MessageCircle/></button></form></section>}

function SaleRequests({go,requests,traders,priceOffers}){return <section className="wrap page narrow"><div className="pageHead"><div><small>بيعك تحت المتابعة</small><h1>طلبات البيع</h1><p>تتابع حالة الموافقة والإسناد وعرض شراء التاجر هنا.</p></div><button className="primary" onClick={()=>go('/sell')}><I.Plus/> طلب بيع جديد</button></div><div className="privacyStrip"><I.EyeOff/><span>خصوصيتك محفوظة: لا تظهر بيانات التواصل والعنوان إلا للمالك والتاجر الذي يُسند إليه الطلب.</span></div><div className="saleRequestList">{requests.map(r=>{const trader=traders.find(t=>t.id===r.traderId);const offer=priceOffers.find(o=>o.requestId===r.id&&o.traderId===r.traderId);return <article key={r.id}><img src={r.image||products[0].img} alt={r.title} loading="lazy" decoding="async"/><div className="saleReqMain"><small>{r.id} · {r.createdAt}</small><h3>{r.title}</h3><p><I.Scale/> {r.quantity} · <I.MapPin/> {r.location}</p>{offer&&<span className="inlineOffer"><I.Banknote/> عرض التاجر: {number(offer.amount)} ج.م / {offer.unit}</span>}</div><Status value={r.status}/><div className="saleReqTrader">{trader?<><span className="mini">{trader.initial}</span><span><small>التاجر المُسند</small><b>{trader.name}</b></span></>:<span className="unassigned"><I.ClipboardClock/> ينتظر قرار المالك</span>}</div><button onClick={()=>go('/request/'+r.id)}>التفاصيل <I.ChevronLeft/></button></article>})}</div></section>}

function Traders({go,traders,rateTrader,ratedTraders}){const[query,setQuery]=useState('');const[target,setTarget]=useState(null);const list=traders.filter(t=>t.status==='active').filter(t=>!query||t.name.includes(query)||t.specialty.includes(query)||t.city.includes(query));return <section className="wrap page"><div className="pageHead"><div><small>مراجَعون من مالك المنصة</small><h1>دليل التجار الموثوقين</h1><p>اطّلع على تخصص كل تاجر وتقييم عملائه. التواصل يُفعّل بعد أن يسند المالك الطلب.</p></div><button className="secondary" onClick={()=>go('/register')}><I.UserPlus/> سجّل كتاجر</button></div><div className="traderSearch"><I.Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم التاجر أو تخصصه أو منطقته" aria-label="البحث في دليل التجار"/></div><div className="traderGrid directory">{list.map(t=><article className="traderCard" key={t.id}><div className="traderTop"><span className="traderAvatar">{t.initial}</span><div><h3>{t.name}{t.verified&&<I.BadgeCheck/>}</h3><p><I.MapPin/> {t.city}</p></div><StatusTrader value={t.status}/></div><div className="traderFacts"><span><I.BriefcaseBusiness/><small>التخصص</small><b>{t.specialty}</b></span><span><I.Star/><small>التقييم</small><b>{t.reviews?`${Number(t.rating).toFixed(1)} / ٥`:'جديد'}</b></span><span><I.MessageCircle/><small>الاستجابة</small><b>{t.reply}</b></span></div><div className="traderCardFoot"><span className="ratingCount"><Stars rating={t.rating}/>{number(t.reviews)} تقييم</span><div>{ratedTraders?.includes(t.id)?<span className="ratedDone"><I.CircleCheck/> تم تقييمك</span>:<button className="rateBtn" onClick={()=>setTarget(t)}><I.Star/> قيّم</button>}<button onClick={()=>go('/sell')}><I.Route/> اطلب إحالة</button></div></div></article>)}</div>{!list.length&&<Empty go={go}/>} {target&&<RatingDialog trader={target} close={()=>setTarget(null)} submit={rating=>{rateTrader(target.id,rating);setTarget(null)}}/>}</section>}
function RatingDialog({trader,close,submit}){const[rating,setRating]=useState(5);const[text,setText]=useState('');useEscape(close);return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="ratingModal" role="dialog" aria-modal="true" aria-label={`تقييم ${trader.name}`} onSubmit={e=>{e.preventDefault();submit(rating)}}><button type="button" className="modalClose" onClick={close} autoFocus aria-label="إغلاق نافذة التقييم"><I.X/></button><span className="traderAvatar large">{trader.initial}</span><h2>قيّم {trader.name}</h2><p>يساعد تقييمك العملاء والمالك في اختيار التاجر الأفضل.</p><div className="starPicker" role="radiogroup" aria-label="عدد النجوم">{[1,2,3,4,5].map(n=><button type="button" key={n} aria-label={`${n} نجوم`} className={n<=rating?'selected':''} onClick={()=>setRating(n)}><I.Star fill="currentColor"/></button>)}</div><b>{rating} من ٥</b><textarea value={text} onChange={e=>setText(e.target.value)} maxLength="300" placeholder="ملاحظة اختيارية عن التجربة" aria-label="ملاحظة اختيارية عن التجربة"/><button className="primary">حفظ التقييم <I.Check/></button></form></div>}

function Chat({go,traders}){const{search}=useLocation();const requested=new URLSearchParams(search).get('trader');const active=traders.filter(t=>t.status==='active');const[picked,setPicked]=useState(null);const[msg,setMsg]=useState('');const[messages,setMessages]=useState({
  'tr-1':[{body:'مرحبًا، تم إسناد طلبك لي من مالك كوكب كراكيب.',mine:false,time:'١٠:٣٠'},{body:'شكرًا، هل يمكن الاتفاق على موعد المعاينة؟',mine:true,time:'١٠:٣٢'}],
  'tr-2':[{body:'أهلًا، أنا جاهز لمتابعة طلب الكرتون المُحال إليّ.',mine:false,time:'أمس'}]
});const trader=active.find(t=>t.id===picked)||(requested&&active.find(t=>t.id===requested))||active[0];if(!trader)return <section className="wrap page"><Empty go={go}/></section>;const list=messages[trader.id]||[];const send=e=>{e.preventDefault();if(!msg.trim())return;setMessages(prev=>({...prev,[trader.id]:[...(prev[trader.id]||[]),{body:msg,mine:true,time:'الآن'}]}));setMsg('')};return <section className="wrap page chatPage"><div className="chatNotice"><I.ShieldCheck/><span><b>محادثة مرتبطة بإسناد المالك</b> — تستخدم لتنسيق المعاينة والعرض بعد توجيه الطلب إلى التاجر، وليست لبدء بيع مباشر.</span></div><div className="chat"><aside><div className="chatAsideHead"><h1>المحادثات</h1><span>{active.length} تجار</span></div>{active.map(t=><button className={t.id===trader.id?'active':''} onClick={()=>setPicked(t.id)} key={t.id}><span className="avatar">{t.initial}</span><div><b>{t.name}</b><small><Stars rating={t.rating}/> · {t.reply}</small></div>{t.id==='tr-1'&&<time>١٠:٣٢</time>}</button>)}</aside><div className="chatbox"><div className="chathead"><span className="avatar">{trader.initial}</span><div><b>{trader.name} {trader.verified&&<I.BadgeCheck/>}</b><small><Stars rating={trader.rating}/> · {number(trader.reviews)} تقييم · {trader.specialty}</small></div><button aria-label="عرض التاجر" onClick={()=>go('/traders')}><I.Info/></button></div><div className="messages">{list.map((message,i)=><p key={i} className={message.mine?'me':'them'}>{message.body}<small>{message.time}</small></p>)}</div><form onSubmit={send}><button type="button" aria-label="إرفاق ملف (قريبًا)"><I.Paperclip/></button><input value={msg} onChange={e=>setMsg(e.target.value)} placeholder="اكتب رسالتك للتاجر..." aria-label="رسالتك للتاجر" maxLength="1000"/><button aria-label="إرسال الرسالة"><I.Send/></button></form></div></div></section>}

function Registration({go,register,requestNotificationPermission}){
  const[role,setRole]=useState('client');
  const[error,setError]=useState('');
  const[show,setShow]=useState(false);
  const[busy,setBusy]=useState(false);
  const[done,setDone]=useState(null);
  const switchRole=next=>{setRole(next);setError('')};
  const submit=e=>{
    e.preventDefault();
    if(busy)return;
    const form=e.currentTarget;
    const data=Object.fromEntries(new FormData(form));
    if(!data.terms){setError(role==='client'?'يجب الموافقة على سياسة الخصوصية قبل إنشاء الحساب.':'يجب الموافقة على مراجعة مالك الموقع لبياناتك.');return}
    setBusy(true);
    const result=register({role,data});
    setBusy(false);
    if(!result||!result.ok){setError((result&&result.error)||'تعذر إكمال التسجيل، حاول مرة أخرى.');return}
    setError('');
    form.reset();
    setDone(result.role);
    requestNotificationPermission();
  };
  if(done)return <section className="success registrationSuccess"><span>{done==='client'?<I.UserCheck/>:<I.Store/>}</span><h1>{done==='client'?'أهلًا بك في كوكب كراكيب':'تم استلام تسجيل التاجر'}</h1><p>{done==='client'?'تم إنشاء حسابك وتسجيل دخولك. تمت إضافتك إلى عداد العملاء فقط، ولا يُعرض اسمك أو أي بيانات تخصك في المنصة.':'أُضيف طلبك إلى سجل التجار لدى المالك؛ يمكنك الدخول إلى بوابة التاجر الآن، وتُفعَّل الأسعار والطلبات بعد الاعتماد.'}</p><p className="loginNote"><I.LockKeyhole/> احفظ رقم هاتفك وكلمة المرور؛ هما بيانات الدخول في المرات القادمة.</p><button className="primary" onClick={()=>go(done==='client'?'/sell':'/trader-login')}>{done==='client'?'أرسل أول طلب بيع':'دخول بوابة التاجر'} <I.ArrowLeft/></button></section>;
  return <section className="wrap page registrationPage">
    <div className="registrationIntro"><span className="eyebrow"><I.UserPlus/> تسجيل العميل أو التاجر</span><h1>سجّل بالطريقة التي تناسبك</h1><p>التسجيل متاح للعميل والتاجر فقط. مالك الموقع لديه بوابة خاصة ولا يحتاج إلى إنشاء حساب من هذه الصفحة.</p><div className="registerBenefits"><span><I.EyeOff/> خصوصية العميل</span><span><I.ClipboardCheck/> مراجعة التجار</span><span><I.Star/> تقييمات موثوقة</span></div></div>
    <form className="formCard registrationCard" onSubmit={submit} noValidate>
      <div className="roleTabs">
        <button type="button" className={role==='client'?'selected':''} onClick={()=>switchRole('client')}><span><I.UserRound/></span><b>عميل</b><small>أبيع كراكيبي</small></button>
        <button type="button" className={role==='trader'?'selected':''} onClick={()=>switchRole('trader')}><span><I.Store/></span><b>تاجر</b><small>أستقبل طلبات مُسندة</small></button>
      </div>
      {role==='client'
        ?<div className="roleExplanation clientRole"><span><I.EyeOff/></span><div><h2>تسجيل العميل بخصوصية</h2><p>يُحدَّث عداد العملاء فقط. لا يظهر اسمك أو رقمك أو أي معلومة شخصية في صفحات الموقع أو قائمة المالك العامة.</p></div></div>
        :<div className="roleExplanation traderRole"><span><I.BadgeCheck/></span><div><h2>تسجيل تاجر تحت المراجعة</h2><p>سيظهر طلبك في سجل التجار الخاص بمالك الموقع. بعد الاعتماد فقط يمكن إسناد طلبات البيع إليك.</p></div></div>}
      {error&&<div className="loginError" role="alert"><I.CircleAlert/>{error}</div>}
      <div className="formgrid">
        <label className={role==='client'?'wide':''}>{role==='client'?'اسمك':'اسم التاجر أو المنشأة'} <i>مطلوب</i><input name="name" autoComplete="name" maxLength="60" placeholder={role==='client'?'الاسم لن يظهر لأي مستخدم آخر':'الاسم الظاهر في الدليل'}/></label>
        <label>رقم الهاتف <i>مطلوب</i><input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx"/></label>
        <label>{role==='client'?'المحافظة':'المدينة أو المنطقة'} <i>{role==='client'?'اختياري':'مطلوب'}</i>{role==='client'
          ?<select name="city" defaultValue="القاهرة"><option>القاهرة</option><option>الجيزة</option><option>الإسكندرية</option><option>محافظة أخرى</option></select>
          :<input name="city" maxLength="60" placeholder="مثال: المعادي، القاهرة"/>}</label>
        <label>كلمة المرور <i>مطلوب</i><div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="new-password" maxLength="72" placeholder="٦ خانات على الأقل وتحتوي حروفًا وأرقامًا"/><button type="button" aria-label="إظهار كلمة المرور" onClick={()=>setShow(!show)}>{show?<I.EyeOff/>:<I.Eye/>}</button></div></label>
        <label>تأكيد كلمة المرور <i>مطلوب</i><input name="confirm" type={show?'text':'password'} autoComplete="new-password" maxLength="72" placeholder="أعد كتابة كلمة المرور"/></label>
        {role==='client'
          ?<label>اهتمامك الأساسي <i>اختياري</i><select name="interest"><option>بيع كراكيب متنوعة</option><option>مواد قابلة للتدوير</option><option>أجهزة ومعدات</option></select></label>
          :<><label>التخصص <i>مطلوب</i><select name="specialty">{cats.map(c=><option key={c[0]}>{c[0]}</option>)}</select></label><label className="wide">نبذة عن الخبرة <i>اختياري</i><textarea name="about" maxLength="300" placeholder="اذكر المواد التي تتعامل بها وخبرتك فيها"/></label></>}
      </div>
      <label className="privacyCheck"><input required type="checkbox" name="terms"/> {role==='client'?'أفهم أن التسجيل لا يعرض أي بياناتي الشخصية للعامة.':'أوافق على مراجعة بياناتي من مالك الموقع قبل اعتماد حساب التاجر.'}</label>
      <button className="primary submit" disabled={busy}>{busy?'جارٍ الحفظ...':role==='client'?'تسجيل كعميل':'إرسال تسجيل التاجر'} <I.ArrowLeft/></button>
      <button type="button" className="textLink" onClick={()=>go('/login')}>لديك حساب بالفعل؟ سجّل الدخول</button>
    </form>
  </section>;
}

function Login({go,login,logout,currentUser,traders}){
  const[error,setError]=useState('');
  const[show,setShow]=useState(false);
  const trader=traders.find(t=>t.id===currentUser?.traderId);
  const submit=e=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const result=login({phone:form.get('phone'),password:form.get('password')});
    if(!result||!result.ok){setError((result&&result.error)||'تعذر تسجيل الدخول.');return}
    setError('');
    go(result.role==='trader'?'/trader':'/profile');
  };
  if(currentUser)return <section className="wrap page narrow"><div className="pendingStoreCard"><span><I.UserCheck/></span><h1>أنت مسجّل الدخول بالفعل</h1><p>{currentUser.role==='trader'?`حساب التاجر «${trader?.name||'متجرك'}» نشط على هذا الجهاز.`:'حسابك كعميل نشط على هذا الجهاز، ويمكنك إرسال طلبات البيع ومتابعتها.'}</p><div className="authActions"><button className="primary" onClick={()=>go(currentUser.role==='trader'?'/trader':'/sell')}>{currentUser.role==='trader'?'الذهاب إلى متجري':'إرسال طلب بيع'} <I.ArrowLeft/></button><button className="secondary" onClick={logout}><I.LogOut/> تسجيل الخروج</button></div></div></section>;
  return <section className="wrap page traderLoginPage">
    <div className="traderLoginIntro"><span className="eyebrow"><I.LogIn/> دخول الحساب</span><h1>سجّل الدخول<br/>إلى كوكب كراكيب</h1><p>استخدم رقم الهاتف وكلمة المرور اللذين أنشأت بهما الحساب. يعرف النظام تلقائيًا إن كنت عميلًا أو تاجرًا.</p><div className="traderLoginFeatures"><span><I.ShieldCheck/> بيانات محمية</span><span><I.Send/> متابعة الطلبات</span><span><I.BellRing/> تنبيهات فورية</span></div></div>
    <form className="formCard traderLoginCard" onSubmit={submit} noValidate>
      <span className="modalIcon"><I.LogIn/></span><small>دخول العملاء والتجار</small><h2>أهلًا بعودتك</h2><p>أدخل بياناتك للمتابعة.</p>
      {error&&<div className="loginError" role="alert"><I.CircleAlert/>{error}</div>}
      <label>رقم الهاتف<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx"/></label>
      <label>كلمة المرور<div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="current-password" placeholder="كلمة المرور"/><button type="button" aria-label="إظهار كلمة المرور" onClick={()=>setShow(!show)}>{show?<I.EyeOff/>:<I.Eye/>}</button></div></label>
      <button className="primary submit">دخول <I.ArrowLeft/></button>
      <button type="button" className="textLink" onClick={()=>go('/register')}>ليس لديك حساب؟ أنشئ حسابًا</button>
      <div className="ownerHelp"><I.Info/><span>حسابات التجار التجريبية: الأرقام من 01000000001 حتى 01000000005 وكلمة المرور {DEMO_TRADER_PASSWORD}.</span></div>
    </form>
  </section>;
}

function TraderAccess({go,traders,currentUser,login,logout,requests,priceOffers,traderPrices,savePriceOffer,saveTraderPrice,requestNotificationPermission}){
  const[error,setError]=useState('');
  const[show,setShow]=useState(false);
  const trader=traders.find(t=>t.id===currentUser?.traderId);
  const submit=e=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const result=login({phone:form.get('phone'),password:form.get('password')});
    if(!result||!result.ok){setError((result&&result.error)||'تعذر تسجيل الدخول.');return}
    setError('');
    if(result.role!=='trader'){go('/profile');return}
    requestNotificationPermission();
  };
  if(currentUser?.role==='trader'&&trader)return <TraderDashboard go={go} trader={trader} requests={requests} priceOffers={priceOffers} traderPrices={traderPrices} savePriceOffer={savePriceOffer} saveTraderPrice={saveTraderPrice} requestNotificationPermission={requestNotificationPermission} logout={logout}/>;
  return <section className="wrap page traderLoginPage">
    <div className="traderLoginIntro"><span className="eyebrow"><I.Store/> مساحة التاجر</span><h1>متجرك المصغّر<br/>في كوكب كراكيب</h1><p>اعرض قائمة أسعارك، عدّلها متى شئت، واستقبل طلبات البيع التي أحالها إليك مالك الموقع لتقديم عروض شراء واضحة.</p><div className="traderLoginFeatures"><span><I.Tags/> إدارة الأسعار</span><span><I.BadgeDollarSign/> عروض شراء</span><span><I.BellRing/> تنبيهات فورية</span></div></div>
    <form className="formCard traderLoginCard" onSubmit={submit} noValidate>
      <span className="modalIcon"><I.LogIn/></span><small>دخول التاجر</small><h2>ادخل إلى متجرك</h2><p>سجّل الدخول برقم الهاتف وكلمة المرور الخاصين بحساب التاجر.</p>
      {error&&<div className="loginError" role="alert"><I.CircleAlert/>{error}</div>}
      <label>رقم هاتف التاجر<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="01xxxxxxxxx"/></label>
      <label>كلمة المرور<div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="current-password" placeholder="كلمة المرور"/><button type="button" aria-label="إظهار كلمة المرور" onClick={()=>setShow(!show)}>{show?<I.EyeOff/>:<I.Eye/>}</button></div></label>
      <button className="primary submit">دخول متجر التاجر <I.ArrowLeft/></button>
      <button type="button" className="textLink" onClick={()=>go('/register')}>ليس لديك حساب؟ سجّل كتاجر</button>
      <div className="ownerHelp"><I.Info/><span>حسابات العرض: 01000000001 … 01000000005 وكلمة المرور {DEMO_TRADER_PASSWORD}. في الإنتاج اربط هذا النموذج بمصادقة Supabase.</span></div>
    </form>
  </section>;
}
function TraderDashboard({go,trader,requests,priceOffers,traderPrices,savePriceOffer,saveTraderPrice,requestNotificationPermission,logout}){const[editing,setEditing]=useState(null);const assigned=requests.filter(r=>r.traderId===trader.id);const prices=traderPrices.filter(p=>p.traderId===trader.id);const submitPrice=e=>{e.preventDefault();const form=new FormData(e.currentTarget);saveTraderPrice({id:editing?.id,traderId:trader.id,name:form.get('name'),category:form.get('category'),amount:Number(form.get('amount')),unit:form.get('unit')});setEditing(null);e.currentTarget.reset()};if(trader.status!=='active')return <section className="wrap page narrow traderPending"><div className="pendingStoreCard"><span><I.Store/></span><h1>متجرك بانتظار اعتماد المالك</h1><p>يمكنك الدخول إلى البوابة، لكن إضافة الأسعار أو استقبال طلبات البيع يتاحان بعد أن يعتمد مالك الموقع حسابك.</p><StatusTrader value={trader.status}/><button className="secondary" onClick={logout}>تسجيل الخروج</button></div></section>;return <section className="wrap page traderDashboard"><div className="traderStoreHero"><div><span className="traderAvatar large">{trader.initial}</span><div><small>متجر تاجر موثّق</small><h1>{trader.name} <I.BadgeCheck/></h1><p><I.MapPin/> {trader.city} · <I.BriefcaseBusiness/> {trader.specialty} · <Stars rating={trader.rating}/></p></div></div><div className="storeActions"><button className="secondary" onClick={requestNotificationPermission}><I.BellRing/> تفعيل الإشعارات</button><button className="secondary" onClick={logout}><I.LogOut/> خروج</button></div></div><div className="storeKpis"><span><I.ClipboardList/><small>طلبات مُسندة</small><b>{number(assigned.length)}</b></span><span><I.Tags/><small>أسعار منشورة</small><b>{number(prices.length)}</b></span><span><I.BadgeDollarSign/><small>عروض شراء وضعتها</small><b>{number(priceOffers.filter(o=>o.traderId===trader.id).length)}</b></span><span><I.Star/><small>تقييم المتجر</small><b>{Number(trader.rating).toFixed(1)}</b></span></div><section className="storeSection"><div className="adminSectionHead"><div><small>مهمات يحددها مالك الموقع</small><h2>طلبات البيع المُسندة إليك</h2><p>أضف أو عدّل عرض الشراء الخاص بك؛ سيصل إشعار للعميل والمالك فور الحفظ.</p></div></div>{assigned.length?<div className="traderAssignments">{assigned.map(request=>{const offer=priceOffers.find(o=>o.requestId===request.id&&o.traderId===trader.id);return <article key={request.id}><img src={request.image||products[0].img} alt={request.title} loading="lazy" decoding="async"/><div className="traderAssignmentInfo"><span>{request.id} · {request.category}</span><h3>{request.title}</h3><p><I.Scale/> {request.quantity} · <I.MapPin/> {request.location}</p><div className="merchantContact"><I.LockKeyhole/><span><b>بيانات العميل الخاصة:</b> {request.customerName||'اسم غير مذكور'} · {request.phone} · {request.address}</span></div><button className="textLink" onClick={()=>go('/request/'+request.id)}>عرض تفاصيل العميل والطلب <I.ArrowLeft/></button></div><form className="offerEditor" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);savePriceOffer({requestId:request.id,traderId:trader.id,amount:Number(f.get('amount')),unit:f.get('unit'),note:f.get('note')})}}><span><I.Banknote/> {offer?'تعديل عرض الشراء':'أضف عرض شراء'}</span><label>السعر<input name="amount" required min="0" max="10000000" type="number" inputMode="decimal" defaultValue={offer?.amount??''} placeholder="0"/></label><label>لكل<select name="unit" defaultValue={offer?.unit||'كجم'}>{UNITS.map(u=><option key={u}>{u}</option>)}</select></label><textarea name="note" maxLength="300" defaultValue={offer?.note||''} placeholder="ملاحظة للعميل عن السعر أو الاستلام"/><button className="primary">{offer?'حفظ التعديل':'إرسال عرض الشراء'} <I.Send/></button>{offer&&<small>آخر تحديث: {offer.updatedAt}</small>}</form></article>})}</div>:<div className="queueEmpty"><I.ClipboardCheck/><div><b>لا توجد طلبات مسندة حاليًا</b><p>سيصلك إشعار فور أن يوجه مالك الموقع طلب بيع إلى متجرك.</p></div></div>}</section><section className="storeSection priceListSection"><div className="adminSectionHead"><div><small>واجهة متجرك العامة</small><h2>قائمة أسعار المتجر</h2><p>أضف أسعارك الإرشادية وعدّلها متى شئت. يبقى عرض الشراء النهائي مرتبطًا بكل طلب مُسند.</p></div><button className="primary" onClick={()=>setEditing({name:'',category:trader.specialty,amount:'',unit:'كجم'})}><I.Plus/> إضافة سعر</button></div><div className="merchantPriceGrid">{prices.map(price=><article key={price.id}><span><I.Tags/></span><div><small>{price.category}</small><b>{price.name}</b><p>{number(price.amount)} ج.م <em>/ {price.unit}</em></p></div><button onClick={()=>setEditing(price)}><I.Pencil/> تعديل</button></article>)}{!prices.length&&<div className="emptyPrices"><I.Tags/><span>لم تضف أسعارًا بعد.</span></div>}</div>{editing&&<div className="inlinePriceEditor"><div><b>{editing.id?'تعديل سعر في المتجر':'إضافة سعر جديد'}</b><button onClick={()=>setEditing(null)} aria-label="إغلاق محرر السعر"><I.X/></button></div><form onSubmit={submitPrice}><input name="name" required maxLength="60" defaultValue={editing.name} placeholder="اسم المادة أو الخدمة"/><select name="category" defaultValue={editing.category}>{cats.map(c=><option key={c[0]}>{c[0]}</option>)}</select><input name="amount" type="number" min="0" max="10000000" required inputMode="decimal" defaultValue={editing.amount} placeholder="السعر بالجنيه"/><select name="unit" defaultValue={editing.unit}>{UNITS.map(u=><option key={u}>{u}</option>)}</select><button className="primary">حفظ السعر <I.Save/></button></form></div>}</section></section>}
function NotificationsPage({go,notifications,audience,markAllRead,requestNotificationPermission}){const label={owner:'مالك الموقع',client:'العميل',trader:'التاجر'}[audience]||'الحساب';const icons={request:I.ClipboardClock,approved:I.CircleCheck,assignment:I.Route,price:I.BadgeDollarSign,trader:I.Store,client:I.UsersRound,welcome:I.Sparkles,rating:I.Star};return <section className="wrap page narrow notificationsPage"><div className="pageHead"><div><small>تنبيهات {label}</small><h1>الإشعارات</h1><p>تصل التحديثات المهمة للأطراف المعنية فور حدوثها.</p></div><div className="notificationActions"><button className="secondary" onClick={requestNotificationPermission}><I.BellRing/> تفعيل إشعارات الجهاز</button><button className="textLink" onClick={markAllRead}>تحديد الكل كمقروء</button></div></div><div className="notificationPermission"><I.BellRing/><div><b>لا تفوّت أي تحديث</b><p>اسمح بإشعارات الجهاز لتعرف فورًا بوجود طلب جديد أو موافقة أو عرض سعر.</p></div><button onClick={requestNotificationPermission}>السماح</button></div><div className="notificationList">{notifications.length?notifications.map(n=>{const C=icons[n.type]||I.Bell;return <article className={n.read?'read':''} key={n.id}><span><C/></span><div><b>{n.title}</b><p>{n.body}</p><small>{n.time}</small></div>{!n.read&&<i/>}</article>}):<div className="empty"><I.BellOff/><h2>لا توجد إشعارات جديدة</h2><p>ستظهر هنا تحديثات طلبات البيع والمتجر والتقييمات.</p><button className="primary" onClick={()=>go('/')}>العودة للرئيسية</button></div>}</div></section>}

function Profile({go,clientCount,currentUser,traders,logout}){
  const role=currentUser?.role;
  const trader=traders?.find(t=>t.id===currentUser?.traderId);
  if(!currentUser)return <section className="wrap page narrow"><div className="pendingStoreCard"><span><I.UserRound/></span><h1>لا يوجد حساب مسجّل على هذا الجهاز</h1><p>أنشئ حسابًا كعميل أو تاجر، أو سجّل الدخول بحسابك الحالي لمتابعة طلباتك وإشعاراتك.</p><div className="authActions"><button className="primary" onClick={()=>go('/register')}><I.UserPlus/> إنشاء حساب</button><button className="secondary" onClick={()=>go('/login')}><I.LogIn/> تسجيل الدخول</button></div></div></section>;
  return <section className="wrap page narrow">
    <div className="profileHero privacyProfile"><span className="bigavatar">{role==='trader'?<I.Store/>:<I.UserRound/>}</span><div><small>{role==='trader'?'حساب تاجر قيد الإدارة':'حساب عميل خاص'}</small><h1>{role==='trader'?trader?.name||'تاجر كوكب كراكيب':'عميل كوكب كراكيب'}</h1><p><I.EyeOff/> لا تظهر بياناتك في واجهة الموقع</p></div><button onClick={logout}><I.LogOut/> تسجيل الخروج</button></div>
    <div className="profilePrivacyCard"><I.ShieldCheck/><div><b>خصوصيتك محفوظة</b><p>يوجد الآن {number(clientCount)} عميلًا مسجلًا. هذا الرقم هو المعلومة الوحيدة المعروضة عن العملاء، من دون أسماء أو بيانات تعريفية.</p></div></div>
    <div className="profilegrid">{[[role==='trader'?I.Store:I.Send,role==='trader'?'متجري المصغّر':'طلبات البيع',role==='trader'?'إدارة الأسعار وعروض الشراء':'أرسل وتابع طلباتك',role==='trader'?'/trader':'/orders'],[I.Store,'التجار الموثوقون','تقييمات وتخصصات التجار','/traders'],[I.Bell,'الإشعارات','موافقات وطلبات وعروض أسعار','/notifications'],[I.MessageCircle,'المحادثات','تنسيق آمن بعد الإسناد','/chat'],[I.Info,'عن المنصة','كيف تحمي كوكب كراكيب العملية','/about']].map(([C,title,desc,path])=><button onClick={()=>go(path)} key={title}><span><C/></span><div><b>{title}</b><small>{desc}</small></div><I.ChevronLeft/></button>)}</div>
  </section>;
}

function OwnerAccess({go,traders,setTraders,requests,assignRequest,clientCount,addTrader,ownerSession,ownerLogin,onLogout}){
  const[show,setShow]=useState(false);
  const[error,setError]=useState('');
  const[hint,setHint]=useState(false);
  const submit=e=>{
    e.preventDefault();
    const form=new FormData(e.currentTarget);
    const result=ownerLogin(form.get('username'),form.get('password'));
    if(!result||!result.ok){setError((result&&result.error)||'تعذر تسجيل الدخول.');return}
    setError('');
  };
  if(ownerSession)return <Admin go={go} traders={traders} setTraders={setTraders} requests={requests} assignRequest={assignRequest} clientCount={clientCount} addTrader={addTrader} onLogout={onLogout}/>;
  return <section className="ownerLogin">
    <div className="loginBrand"><Logo/><span className="privateMark"><I.LockKeyhole/> منطقة خاصة</span><div><span className="eyebrow light"><I.ShieldCheck/> وصول المالك فقط</span><h1>كل طلب بيع<br/>تحت إشرافك</h1><p>راجع طلبات العملاء، اختر التاجر المؤهل، واعتمد التجار من لوحة واحدة. لا يستطيع أي عميل أو تاجر بدء عملية خارج هذه البوابة.</p></div><div className="loginFeatures"><span><I.ClipboardCheck/><b>مراجعة الطلبات</b></span><span><I.UserRoundCog/><b>إسناد التجار</b></span><span><I.EyeOff/><b>حماية العملاء</b></span></div></div>
    <div className="loginSide"><form className="ownerLoginForm" onSubmit={submit} noValidate>
      <span className="lockIcon"><I.Fingerprint/></span><small>بوابة الإدارة الخاصة</small><h2>دخول مالك الموقع</h2><p>أدخل بيانات الحساب المعتمدة للوصول إلى سجلات التجار وطلبات البيع.</p>
      {error&&<div className="loginError" role="alert"><I.CircleAlert/>{error}</div>}
      <label>اسم المستخدم<input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="اسم مستخدم المالك"/></label>
      <label>كلمة المرور<div className="passwordField"><input name="password" type={show?'text':'password'} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="كلمة المرور"/><button type="button" aria-label="إظهار كلمة المرور" onClick={()=>setShow(!show)}>{show?<I.EyeOff/>:<I.Eye/>}</button></div></label>
      <div className="loginMeta"><span><I.ShieldAlert/> محاولات الدخول مسجلة</span><span>وصول خاص فقط</span></div>
      <button className="primary loginSubmit">دخول لوحة المالك <I.LogIn/></button>
      {OWNER_USES_DEFAULTS&&<div className="ownerHelp"><I.Info/><span>{hint?<>بيانات النسخة التجريبية: اسم المستخدم <b>{OWNER_USERNAME}</b> وكلمة المرور <b>Kawkap@2026</b>. غيّرها في الإنتاج عبر متغيرات البيئة VITE_OWNER_USERNAME وVITE_OWNER_PASSWORD.</>:<>لم تُضبط بيانات مالك مخصّصة بعد، لذا تعمل البوابة ببيانات النسخة التجريبية. <button type="button" className="textLink" onClick={()=>setHint(true)}>إظهار بيانات الدخول</button></>}</span></div>}
      <div className="ownerHelp"><I.Info/><span>هذه الواجهة معروضة كتجربة. في الإنتاج يجب ربط الدخول بنظام مصادقة وصلاحيات إدارة آمن.</span></div>
    </form></div>
  </section>;
}

function Admin({go,traders,setTraders,requests,assignRequest,clientCount,addTrader,onLogout}){
  const[openAdd,setOpenAdd]=useState(false);
  const active=traders.filter(t=>t.status==='active');
  const pending=traders.filter(t=>t.status==='pending');
  const review=requests.filter(r=>r.status==='review');
  const activate=id=>setTraders(list=>list.map(t=>t.id===id?{...t,status:'active',verified:true,reply:'يرد خلال ساعة'}:t));
  const suspend=id=>setTraders(list=>list.map(t=>t.id===id?{...t,status:'suspended',verified:false}:t));
  return <section className="wrap page admin adminDashboard">
    {OWNER_USES_DEFAULTS&&<div className="adminWarning" role="alert"><I.ShieldAlert/><div><b>تعمل الآن ببيانات الدخول التجريبية</b><p>غيّر VITE_OWNER_USERNAME وVITE_OWNER_PASSWORD قبل النشر الفعلي، أو اربط الدخول بمصادقة خادم آمنة.</p></div></div>}
    <div className="pageHead"><div><small>لوحة المالك</small><h1>كل الطلبات أمامك</h1><p>راجع بيانات العميل، ثم اختر التاجر واضغط «اعتماد وإسناد».</p></div><div className="adminActions"><button className="secondary" onClick={()=>setOpenAdd(true)}><I.UserPlus/> إضافة تاجر</button><button className="logoutBtn" onClick={onLogout}><I.LogOut/> خروج آمن</button></div></div>
    <div className="ownerGuide"><span><I.ListChecks/></span><div><b>طريقة الاستخدام في ٣ خطوات</b><p>١. افتح بيانات الطلب · ٢. اختر تاجرًا نشطًا · ٣. اضغط اعتماد وإسناد. سيصل العميل والتاجر إشعارًا فورًا.</p></div><a className="ownerPhonePill" href={`https://wa.me/${OWNER_WHATSAPP_NUMBER}`} target="_blank" rel="noreferrer"><I.MessageCircle/> واتساب المالك <b dir="ltr">{OWNER_PHONE}</b></a></div>
    <nav className="ownerControlHub" aria-label="أدوات تحكم المالك"><button onClick={()=>go('/market')}><I.Store/> معاينة السوق</button><button onClick={()=>go('/orders')}><I.ClipboardList/> كل الطلبات</button><button onClick={()=>go('/traders')}><I.UsersRound/> دليل التجار</button><button onClick={()=>go('/notifications')}><I.BellRing/> إشعارات الإدارة</button><button onClick={()=>setOpenAdd(true)}><I.UserPlus/> إضافة تاجر</button></nav>
    <div className="kpis ownerKpis"><article><span><I.UsersRound/></span><small>العملاء المسجلون</small><b>{number(clientCount)}</b><em>عداد فقط</em></article><article><span><I.Store/></span><small>التجار النشطون</small><b>{number(active.length)}</b><em>{number(pending.length)} بانتظار الاعتماد</em></article><article><span><I.ClipboardClock/></span><small>طلبات تحتاج قرارك</small><b>{number(review.length)}</b><em>راجعها من القائمة أدناه</em></article><article><span><I.MessageCircle/></span><small>طلبات مُسندة</small><b>{number(requests.filter(r=>r.status==='assigned').length)}</b><em>جاهزة للتواصل</em></article></div>
    <div className="adminPrivacy"><span><I.LockKeyhole/></span><div><b>بيانات العميل تظهر لك أنت فقط</b><p>ستجد الاسم والهاتف والعنوان والوقت المناسب داخل كل طلب. هذه البيانات لا تظهر في الدليل العام.</p></div><span className="privacyCount">{number(review.length)} يحتاج قرارًا</span></div>
    <OwnerRequestQueue requests={requests} traders={active} assignRequest={assignRequest}/>
    <section className="adminSection"><div className="adminSectionHead"><div><small>إدارة التجار</small><h2>التجار المسجلون</h2><p>اعتمد التاجر أو أوقفه مؤقتًا من الأزرار الواضحة داخل كل بطاقة.</p></div><button className="primary" onClick={()=>setOpenAdd(true)}><I.Plus/> إضافة تاجر يدويًا</button></div><div className="adminTraderGrid">{traders.map(t=><TraderCard key={t.id} trader={t} admin onActivate={activate} onSuspend={suspend}/>)}</div></section>
    {openAdd&&<AddTrader close={()=>setOpenAdd(false)} add={data=>{addTrader(data);setOpenAdd(false)}}/>}
  </section>
}
function OwnerRequestQueue({requests,traders,assignRequest}){
  const[choices,setChoices]=useState({});
  const awaiting=requests.filter(r=>r.status==='review');
  const assigned=requests.filter(r=>r.status==='assigned');
  return <section className="adminSection requestQueue"><div className="adminSectionHead"><div><small>الخطوة الأولى</small><h2>طلبات تحتاج مراجعتك</h2><p>كل بطاقة تحتوي على بيانات العميل اللازمة للتواصل. اختر تاجرًا مناسبًا ثم اعتمد الطلب.</p></div><span className="queueCount">{number(awaiting.length)} طلب</span></div>{awaiting.length?<div className="assignmentList">{awaiting.map(r=><article key={r.id}><img src={r.image||products[0].img} alt={r.title} loading="lazy" decoding="async"/><div className="assignmentInfo"><span>{r.id} · طلب خاص</span><h3>{r.title}</h3><p><I.BriefcaseBusiness/> {r.category} · <I.Scale/> {r.quantity} · <I.MapPin/> {r.location}</p><div className="ownerRequestDetails"><span><I.UserRound/><b>العميل</b> {r.customerName||'لم يُذكر بعد'}</span><span><I.Phone/><b>الهاتف</b> <a href={`tel:${r.phone||''}`} dir="ltr">{r.phone||'غير متاح'}</a></span><span><I.MapPinned/><b>العنوان</b> {r.address||r.location}</span><span><I.Clock3/><b>الوقت</b> {r.pickupTime||'يُنسّق مع العميل'}</span><span className="ownerDescription"><I.NotebookPen/><b>الوصف</b> {r.description||'لا يوجد وصف إضافي.'}</span></div></div><div className="assignControl"><label>اختر التاجر<select value={choices[r.id]||''} onChange={e=>setChoices({...choices,[r.id]:e.target.value})} aria-label={`اختر تاجرًا للطلب ${r.id}`}><option value="">اختر تاجرًا لإسناد المهمة</option>{traders.map(t=><option value={t.id} key={t.id}>{t.name} — {t.specialty} ({Number(t.rating).toFixed(1)}★)</option>)}</select></label><button className="primary" onClick={()=>assignRequest(r.id,choices[r.id])}><I.Route/> اعتماد وإسناد</button></div></article>)}</div>:<div className="queueEmpty"><I.CircleCheck/><div><b>ممتاز، لا توجد طلبات معلّقة</b><p>ستظهر هنا تلقائيًا عند إرسال عميل طلبًا جديدًا.</p></div></div>}<div className="assignedSummary"><b><I.Send/> آخر الطلبات المُسندة</b>{assigned.slice(0,3).map(r=>{const t=traders.find(x=>x.id===r.traderId);return <span key={r.id}>{r.id}: {r.title} <I.ArrowLeft/> {t?.name||'تاجر'}</span>})}</div></section>
}
function AddTrader({close,add}){useEscape(close);const submit=e=>{e.preventDefault();add(Object.fromEntries(new FormData(e.currentTarget)))};return <div className="modalBackdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}><form className="addTraderModal" role="dialog" aria-modal="true" aria-label="إضافة تاجر يدويًا" onSubmit={submit}><button type="button" className="modalClose" onClick={close} autoFocus aria-label="إغلاق نافذة إضافة تاجر"><I.X/></button><span className="modalIcon"><I.Store/></span><small>منطقة المالك الخاصة</small><h2>إضافة تاجر يدويًا</h2><p>هذا النموذج لا يظهر في التسجيل الخارجي، ويمنح التاجر اعتمادًا مباشرًا بعد الإضافة.</p><div className="formgrid"><label>اسم التاجر أو المنشأة <i>مطلوب</i><input name="name" required maxLength="60" placeholder="مثال: مركز المستقبل للتدوير"/></label><label>التخصص <i>مطلوب</i><select name="specialty">{cats.map(c=><option key={c[0]}>{c[0]}</option>)}</select></label><label>المدينة أو المنطقة <i>مطلوب</i><input name="city" required maxLength="60" placeholder="القاهرة، مصر"/></label><label>رقم التواصل <i>اختياري</i><input name="phone" type="tel" inputMode="tel" maxLength="15" placeholder="01xxxxxxxxx"/></label><label className="wide">التقييم المبدئي<select name="rating"><option value="0">تاجر جديد — بلا تقييم</option><option value="4.5">٤٫٥</option><option value="4.8">٤٫٨</option><option value="5">٥٫٠</option></select></label></div><div className="modalActions"><button type="button" className="secondary" onClick={close}>إلغاء</button><button className="primary"><I.UserPlus/> إضافة واعتماد التاجر</button></div></form></div>}

function About(){return <section className="wrap page about"><span className="eyebrow"><I.Leaf/> مهمتنا</span><h1>عن كوكب كراكيب</h1><p className="lead">منصة منظَّمة لبيع الكراكيب والمواد القابلة لإعادة الاستخدام. العميل يرسل طلبه، ومالك الموقع يراجعه ويختار التاجر المناسب، ثم يفتح التواصل بصورة واضحة وآمنة.</p><div className="aboutgrid"><article><I.Crown/><h2>قرار المالك أولًا</h2><p>كل طلب بيع يمر بالمراجعة قبل الإسناد، ولا يتم توجيهه تلقائيًا إلى أي تاجر.</p></article><article><I.Star/><h2>تاجر يُقاس بالتجربة</h2><p>لكل تاجر تخصص وتقييمات ظاهرة تساعد على بناء ثقة حقيقية بعد كل تعامل.</p></article><article><I.EyeOff/><h2>عميل ببيانات محمية</h2><p>نكتفي بعدّ العملاء المسجلين في الواجهة؛ لا نعرض أسماءهم أو بياناتهم الخاصة.</p></article></div></section>}

migrateKawkapStorage(DATA_VERSION);
createRoot(document.getElementById('root')).render(<BrowserRouter><App/></BrowserRouter>);
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));
