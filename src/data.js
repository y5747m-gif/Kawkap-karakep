export const cats=[
  ['الكرتون والورق','PackageOpen',128,'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=500&q=75'],
  ['المعادن','Anvil',93,'https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=500&q=75'],
  ['البلاستيك','Bottle',76,'https://images.unsplash.com/photo-1605600659873-d808a13e4d2a?auto=format&fit=crop&w=500&q=75'],
  ['العلب','Container',54,'https://images.unsplash.com/photo-1591193686104-fddba4d0e4d8?auto=format&fit=crop&w=500&q=75'],
  ['الإلكترونيات','Cpu',112,'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=500&q=75'],
  ['الأجهزة الكهربائية','WashingMachine',68,'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=500&q=75'],
  ['زيوت مستعملة','Droplets',31,'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=500&q=75'],
  ['أجهزة رياضية','Dumbbell',40,'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=500&q=75'],
  ['قطع غيار','Settings',87,'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=500&q=75'],
  ['أثاث ومعدات','Armchair',59,'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=500&q=75'],
  ['أخشاب','Trees',34,'https://images.unsplash.com/photo-1528190336454-13cd56b45b5a?auto=format&fit=crop&w=500&q=75'],
  ['مواد قابلة لإعادة الاستخدام','Recycle',145,'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=500&q=75']
];

/* نماذج عرض لفرص البيع التي وافق عليها مالك المنصة. */
export const products=[
  {id:1,name:'خردة نحاس أحمر نظيف',cat:'المعادن',price:85,unit:'كجم',qty:25,distance:2.4,seller:'محمود للخردة',rating:4.9,place:'مدينة نصر، القاهرة',condition:'مستعمل - جيد',img:'https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=800&q=80'},
  {id:2,name:'كرتون مضغوط وجاف',cat:'الكرتون والورق',price:12,unit:'كجم',qty:80,distance:1.8,seller:'نقطة جمع خضراء',rating:4.7,place:'المعادي، القاهرة',condition:'جاهز للتدوير',img:'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=800&q=80'},
  {id:3,name:'غسالة أوتوماتيك قديمة',cat:'الأجهزة الكهربائية',price:1800,unit:'قطعة',qty:1,distance:4.1,seller:'أحمد سامي',rating:4.8,place:'الهرم، الجيزة',condition:'تحتاج صيانة بسيطة',img:'https://images.unsplash.com/photo-1604335399105-a0c585fd81a1?auto=format&fit=crop&w=800&q=80'},
  {id:4,name:'قطع كمبيوتر متنوعة',cat:'الإلكترونيات',price:650,unit:'مجموعة',qty:1,distance:3.2,seller:'تك ستور',rating:4.6,place:'الدقي، الجيزة',condition:'مستعمل',img:'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80'},
  {id:5,name:'علب ألومنيوم مكبوسة',cat:'العلب',price:48,unit:'كجم',qty:40,distance:5.6,seller:'روّاد التدوير',rating:4.9,place:'شبرا، القاهرة',condition:'جاهز للتدوير',img:'https://images.unsplash.com/photo-1591193686104-fddba4d0e4d8?auto=format&fit=crop&w=800&q=80'},
  {id:6,name:'كرسي خشب زان قديم',cat:'أثاث ومعدات',price:420,unit:'قطعة',qty:2,distance:6.1,seller:'بيت العتيق',rating:4.5,place:'مصر الجديدة، القاهرة',condition:'جيد قابل للترميم',img:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80'}
];

export const starterTraders=[
  {id:'tr-1',name:'محمود للخردة',initial:'م',rating:4.9,reviews:128,specialty:'المعادن',city:'مدينة نصر، القاهرة',status:'active',verified:true,reply:'يرد خلال دقائق'},
  {id:'tr-2',name:'نقطة جمع خضراء',initial:'ن',rating:4.7,reviews:84,specialty:'الكرتون والورق',city:'المعادي، القاهرة',status:'active',verified:true,reply:'يرد خلال ساعة'},
  {id:'tr-3',name:'تك ستور',initial:'ت',rating:4.6,reviews:61,specialty:'الإلكترونيات',city:'الدقي، الجيزة',status:'active',verified:true,reply:'يرد اليوم'},
  {id:'tr-4',name:'روّاد التدوير',initial:'ر',rating:4.9,reviews:97,specialty:'العلب والبلاستيك',city:'شبرا، القاهرة',status:'active',verified:true,reply:'يرد خلال ساعتين'},
  {id:'tr-5',name:'بيت العتيق',initial:'ب',rating:4.5,reviews:42,specialty:'الأثاث والمعدات',city:'مصر الجديدة، القاهرة',status:'active',verified:true,reply:'يرد اليوم'}
];

export const starterSaleRequests=[
  {id:'S-2048',title:'خردة نحاس أحمر نظيف',category:'المعادن',quantity:'25 كجم',location:'مدينة نصر، القاهرة',status:'assigned',traderId:'tr-1',createdAt:'اليوم، ٠٩:٢٠',image:products[0].img},
  {id:'S-2047',title:'كرتون مضغوط وجاف',category:'الكرتون والورق',quantity:'80 كجم',location:'المعادي، القاهرة',status:'assigned',traderId:'tr-2',createdAt:'أمس، ٠٤:١٠',image:products[1].img},
  {id:'S-2046',title:'غسالة أوتوماتيك قديمة',category:'الأجهزة الكهربائية',quantity:'قطعة واحدة',location:'الهرم، الجيزة',status:'review',traderId:null,createdAt:'أمس، ٠١:٤٠',image:products[2].img},
  {id:'S-2045',title:'قطع كمبيوتر متنوعة',category:'الإلكترونيات',quantity:'مجموعة',location:'الدقي، الجيزة',status:'review',traderId:null,createdAt:'الأحد، ١١:٣٠',image:products[3].img}
];
