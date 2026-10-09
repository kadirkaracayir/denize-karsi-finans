import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.join(rootDir, 'data', 'denize_karsi.db');
const uploadsDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// Helper to crop thumbnail from screenshot
async function cropThumbnail(imageFile, top, filename, options = {}) {
  const left = options.left ?? 521;
  const width = options.width ?? 188;
  const height = options.height ?? 168;
  const src = path.join(rootDir, 'menü', imageFile);
  const dest = path.join(uploadsDir, filename);

  try {
    if (!fs.existsSync(src)) {
      console.warn(`Source file not found: ${src}`);
      return null;
    }
    await sharp(src)
      .extract({ left, top, width, height })
      .resize(400, 400, { fit: 'cover' })
      .jpeg({ quality: 88 })
      .toFile(dest);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error(`Error cropping ${filename} from ${imageFile} (top: ${top}):`, err.message);
    return null;
  }
}

// Master Categories Definition
const CATEGORIES = [
  { slug: 'kahvalti', name: 'Kahvaltılar', icon: 'Egg', description: 'Güne enfes Akdeniz manzarası ve zengin lezzetlerle başlayın', sort_order: 1 },
  { slug: 'izgara-et', name: 'Izgaralar & Et Yemekleri', icon: 'Flame', description: 'Usta ellerden çıkan sulu ızgara etler ve antrikot çeşitleri', sort_order: 2 },
  { slug: 'tavuk-yemekleri', name: 'Tavuk Yemekleri', icon: 'Drumstick', description: 'Özel marinasyonlu, enfes soslu taze tavuk tabakları', sort_order: 3 },
  { slug: 'deniz-urunleri', name: 'Deniz Ürünleri', icon: 'Fish', description: 'Taptaze Akdeniz balıkları, karides ve somon lezzetleri', sort_order: 4 },
  { slug: 'burgerler', name: 'Burgerler', icon: 'Sandwich', description: 'El yapımı burger köftesi, özel soslar ve çıtır patates', sort_order: 5 },
  { slug: 'pizzalar', name: 'Pizza Çeşitleri', icon: 'Pizza', description: 'Taş fırın kıvamında çıtır İtalyan hamuru ve zengin malzemeler', sort_order: 6 },
  { slug: 'wrap-fajita', name: 'Wrap, Fajita & Quesadilla', icon: 'Flame', description: 'Döküm tavada cızırdayan fajitalar, zengin quesadilla ve dürümler', sort_order: 7 },
  { slug: 'makarna-noodle', name: 'Makarna & Noodle', icon: 'Utensils', description: 'Taze soslu İtalyan makarnaları ve wok tavada lezzetli noodlelar', sort_order: 8 },
  { slug: 'salatalar-bowllar', name: 'Salatalar & Bowllar', icon: 'Salad', description: 'Taptaze Akdeniz yeşillikleri, sağlıklı kinoa ve falafel bowllar', sort_order: 9 },
  { slug: 'tostlar-gozlemeler', name: 'Tostlar & Gözlemeler', icon: 'Croissant', description: 'Çıtır standart tostlar, bazlama tostlar ve el açması gözlemeler', sort_order: 10 },
  { slug: 'sandvic-atistirmalik', name: 'Sandviçler & Atıştırmalıklar', icon: 'Cookie', description: 'Pratik, lezzetli çıtır sepetler, börekler ve doyurucu sandviçler', sort_order: 11 },
  { slug: 'tatlilar-dondurma', name: 'Tatlılar & Dondurma', icon: 'IceCream', description: 'Özel San Sebastian, sufle, waffle, magnolialar ve dondurma', sort_order: 12 },
  { slug: 'cay-semaver', name: 'Çay & Semaver', icon: 'Coffee', description: 'Odun ateşinde demli çay ve dost sohbetleri için semaver keyfi', sort_order: 13 },
  { slug: 'bitki-caylari', name: 'Bitki Çayları', icon: 'Sparkles', description: 'Doğal kış çayı, ıhlamur, nane limon ve şifalı bitki harmanları', sort_order: 14 },
  { slug: 'sicak-kahveler', name: 'Sıcak Kahveler', icon: 'Coffee', description: 'Közde Türk kahvesi, taze çekilmiş espresso ve latte çeşitleri', sort_order: 15 },
  { slug: 'soguk-kahveler', name: 'Soğuk Kahveler', icon: 'Coffee', description: 'Buz gibi Ice Latte, Ice Mocha ve ferahlatıcı Americano', sort_order: 16 },
  { slug: 'limonata-taze-sikma', name: 'Limonata & Taze Sıkma', icon: 'GlassWater', description: 'Ev yapımı ferah limonatalar ve taze sıkılmış Akdeniz meyve suları', sort_order: 17 },
  { slug: 'alkolsuz-kokteyller', name: 'Alkolsüz Kokteyller & Fresh', icon: 'Wine', description: 'Egzotik taze meyve püreleri, nane ve ferahlatıcı özel reçeteler', sort_order: 18 },
  { slug: 'milkshake-frozen', name: 'Milkshake, Frozen & Natural', icon: 'GlassWater', description: 'Buzlu meyve frozenları, yoğun dondurmalı milkshake ve Hindistan cevizi', sort_order: 19 },
  { slug: 'soguk-icecekler', name: 'Soğuk İçecekler & Meşrubat', icon: 'Beer', description: 'Kutu içecekler, maden suları, ayran ve enerji içecekleri', sort_order: 20 },
  { slug: 'nargile', name: 'Nargile Çeşitleri', icon: 'Flame', description: 'Özel aromalar, buzlu marpuç ve eşsiz deniz manzarası keyfi', sort_order: 21 }
];

// Product item specs
const PRODUCTS_DATA = [
  // --- KAHVALTILAR ---
  {
    cat: 'kahvalti',
    name: 'Serpme Kahvaltı',
    description: 'Yöresel peynirlerden zeytin çeşitlerine, taptaze domates ve salatalıklara, sıcak börek ve sınırsız çay keyfiyle zengin kahvaltı.',
    price: 1250,
    is_popular: 1, is_featured: 1, is_chef_special: 1, is_recommended: 1,
    crop: ['37.jpeg', 565, 'serpme_kahvalti.jpg']
  },
  {
    cat: 'kahvalti',
    name: 'Köy Kahvaltı Tabağı',
    description: 'Doğal köy peynirleri, petek bal, kaymak, köy yumurtası, reçeller ve sıcacık bazlama eşliğinde doyurucu tek kişilik tabak.',
    price: 620,
    is_popular: 1, is_featured: 0,
    crop: ['37.jpeg', 730, 'koy_kahvalti_tabagi.jpg']
  },
  {
    cat: 'kahvalti',
    name: 'Menemen',
    description: 'Geleneksel lezzetimiz menemen, taptaze domates ve biberlerin tereyağında kavrulup yumurtayla buluşmasıyla hazırlanır.',
    price: 250,
    is_popular: 1, is_featured: 0,
    crop: ['37.jpeg', 885, 'menemen.jpg']
  },
  {
    cat: 'kahvalti',
    name: 'Omlet',
    description: 'Kabarık ve yumuşacık, isteğe bağlı peynir, sucuk veya karışık garnitürlerle hazırlanan nefis tava omleti.',
    price: 250,
    is_popular: 0, is_featured: 0,
    crop: ['38.jpeg', 195, 'omlet.jpg']
  },
  {
    cat: 'kahvalti',
    name: 'Sucuklu Yumurta',
    description: 'Kaliteli sucuk dilimlerinin tereyağında kızarıp yumurtayla harmanlandığı, güne enerji dolu bir başlangıç.',
    price: 250,
    is_popular: 1, is_featured: 0,
    crop: ['38.jpeg', 360, 'sucuklu_yumurta.jpg']
  },

  // --- IZGARALAR & ET YEMEKLERİ ---
  {
    cat: 'izgara-et',
    name: 'Karışık Izgara (4 Kişilik)',
    description: 'Özel soslu tavuk göğüs, ızgara köfte, antrikot ve kuzu pirzolalardan oluşan, közlenmiş sebzeler ve pilav eşliğinde ziyafet tabağı.',
    price: 3100,
    is_popular: 1, is_featured: 1, is_chef_special: 1, is_new: 1,
    crop: ['38.jpeg', 765, 'karisik_izgara_4_kisilik.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Karışık Izgara (2 Kişilik)',
    description: 'Özel marine tavuk, ızgara köfte, antrikot ve pirzola çeşitleriyle zengin 2 kişilik karışık ızgara sunumu.',
    price: 1950,
    is_popular: 1, is_featured: 1, is_recommended: 1,
    crop: ['39.jpeg', 375, 'karisik_izgara_2_kisilik.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Izgara Tavuk',
    description: 'Özel sosla marine edilmiş sulu tavuk göğsü, yanında taptaze Akdeniz yeşillikleri ve çıtır patates kızartması ile.',
    price: 460,
    is_popular: 0, is_featured: 0,
    crop: ['39.jpeg', 215, 'izgara_tavuk.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Izgara Köfte',
    description: 'Dana etinden özenle hazırlanmış, sulu ve lezzetli köftelerin ızgarada pişirilip tırnak pide ve patatesle sunumu.',
    price: 460,
    is_popular: 1, is_featured: 0,
    crop: ['39.jpeg', 605, 'izgara_kofte.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Kuzu Pirzola',
    description: 'Özel baharatlarla marine edilmiş, kemik üzerinde nar gibi pişen, etin en lezzetli ve yumuşak hali.',
    price: 900,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['36.jpeg', 760, 'kuzu_pirzola.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Pesto Risottolu Antrikot',
    description: 'Kremamsı fesleğenli pesto risotto yatağında servis edilen, ızgara dana antrikot dilimleri.',
    price: 720,
    is_popular: 1, is_featured: 1,
    crop: ['35.jpeg', 195, 'pesto_risottolu_antrikot.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Basmati Eşliğinde Antrikot',
    description: 'Aromatik basmati pirinç pilavı ve közlenmiş taze sebzeler eşliğinde lokum kıvamında ızgara antrikot.',
    price: 720,
    is_popular: 0, is_featured: 0,
    crop: ['35.jpeg', 345, 'basmati_esliginde_antrikot.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Yoğurt ve Pideli Izgara Köfte',
    description: 'Tereyağlı tırnak pide üzerinde nefis ızgara köfteler, süzme yoğurt ve özel domates sosu ile.',
    price: 680,
    is_popular: 1, is_featured: 0,
    crop: ['35.jpeg', 490, 'yogurt_pideli_kofte.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Mantarlı Risotto Eşliğinde Kaşarlı Köfte',
    description: 'Yabani mantarlarla hazırlanan risotto eşliğinde içi erimiş kaşarlı enfes ızgara köfte tabağı.',
    price: 820,
    is_popular: 1, is_featured: 0,
    crop: ['35.jpeg', 635, 'mantarli_risotto_kasarli_kofte.jpg']
  },
  {
    cat: 'izgara-et',
    name: 'Karabuğdaylı Mantar Soslu Antrikot',
    description: 'Sağlıklı karabuğday garnitürü ve yoğun kremalı mantar sosuyla taçlandırılmış dana antrikot.',
    price: 740,
    is_popular: 0, is_featured: 0,
    crop: ['35.jpeg', 780, 'karabugdayli_antrikot.jpg']
  },

  // --- TAVUK YEMEKLERİ ---
  {
    cat: 'tavuk-yemekleri',
    name: 'Köri Soslu Tavuk',
    description: 'Mantar, soğan ve krema ile zenginleştirilmiş özel köri sosunda, yumuşacık marine tavuk parçaları.',
    price: 440,
    is_popular: 1, is_featured: 1,
    crop: ['29.jpeg', 205, 'kori_soslu_tavuk.jpg']
  },
  {
    cat: 'tavuk-yemekleri',
    name: 'Barbekü Soslu Tavuk',
    description: 'Izgara tavuğun hafif tatlı ve isli barbekü sosuyla harmanlandığı, farklı lezzet arayanlara özel lezzet.',
    price: 440,
    is_popular: 0, is_featured: 0,
    crop: ['29.jpeg', 370, 'barbeku_soslu_tavuk.jpg']
  },
  {
    cat: 'tavuk-yemekleri',
    name: 'Acı Tatlı Soslu Tavuk',
    description: 'Uzak Doğu mutfağının lezzetlerini taşıyan, tavuk parçalarının acı-tatlı sosla buluştuğu egzotik tabak.',
    price: 440,
    is_popular: 0, is_featured: 0,
    crop: ['29.jpeg', 535, 'aci_tatli_tavuk.jpg']
  },
  {
    cat: 'tavuk-yemekleri',
    name: 'Tavuk Pirzola',
    description: 'Kemikli tavuk pirzolanın ızgarada sulu pişirilerek patates kızartması ve salata eşliğinde servisi.',
    price: 500,
    is_popular: 1, is_featured: 0,
    crop: ['29.jpeg', 700, 'tavuk_pirzola.jpg']
  },
  {
    cat: 'tavuk-yemekleri',
    name: 'Kremalı Mantarlı Sebzeli Şinitzel',
    description: 'Altın sarısı çıtır şinitzel üzerine zengin kremalı mantar sosu, taze mevsim sebzeleri ve patates kızartması.',
    price: 450,
    is_popular: 1, is_featured: 1,
    crop: ['29.jpeg', 885, 'kremali_mantarli_sinitzel.jpg']
  },

  // --- DENİZ ÜRÜNLERİ ---
  {
    cat: 'deniz-urunleri',
    name: 'Çipura',
    description: 'Taze Akdeniz çipurasının ızgarada pişirilerek zeytinyağı ve limon sosuyla sıcak servisi.',
    price: 800,
    is_popular: 1, is_featured: 1,
    crop: ['30.jpeg', 230, 'cipura.jpg']
  },
  {
    cat: 'deniz-urunleri',
    name: 'Kiremitte Karides Tava',
    description: 'Tereyağında sotelenmiş taptaze karideslerin, sarımsak ve kaşarla kiremitte fırınlandığı deniz mahsulü lezzeti.',
    price: 850,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['30.jpeg', 420, 'kiremitte_karides_tava.jpg']
  },
  {
    cat: 'deniz-urunleri',
    name: 'Izgara Somon',
    description: 'Sağlıklı ve enfes somon balığının ızgarada mühürlenerek taze yeşillikler ve fırın patatesle sunumu.',
    price: 1200,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['30.jpeg', 625, 'izgara_somon.jpg']
  },

  // --- BURGERLER ---
  {
    cat: 'burgerler',
    name: 'Double Cheeseburger',
    description: 'İki kat hamburger köftesi ve bol erimiş cheddar peyniriyle hazırlanan, lezzet patlaması yaşatan dev burger.',
    price: 600,
    is_popular: 1, is_featured: 1,
    crop: ['28.jpeg', 690, 'double_cheeseburger.jpg']
  },
  {
    cat: 'burgerler',
    name: 'Double Burger',
    description: 'İki kat lezzet! İki kat doyurucu hamburger köftesi, marul, domates ve özel gurme sosuyla.',
    price: 580,
    is_popular: 0, is_featured: 0,
    crop: ['28.jpeg', 520, 'double_burger.jpg']
  },
  {
    cat: 'burgerler',
    name: 'Cheeseburger',
    description: 'Efsane hamburger köftesinin üzerinde erimiş cheddar peynirinin eşlik ettiği klasik gurme lezzet.',
    price: 470,
    is_popular: 1, is_featured: 0,
    crop: ['28.jpeg', 360, 'cheeseburger.jpg']
  },
  {
    cat: 'burgerler',
    name: 'Crispy Tender Burger',
    description: 'Çıtır pane kaplı tavuk fileto, taze marul ve domatesin özel sosla brioche ekmeğinde buluşması.',
    price: 400,
    is_popular: 1, is_featured: 0,
    crop: ['28.jpeg', 190, 'crispy_tender_burger.jpg']
  },
  {
    cat: 'burgerler',
    name: 'Hamburger',
    description: 'Taptaze hamburger köftesi, marul, domates, kornişon turşu ve özel soslarla hazırlanan klasik burger.',
    price: 420,
    is_popular: 0, is_featured: 0,
    crop: ['27.jpeg', 910, 'hamburger.jpg']
  },

  // --- PİZZA ÇEŞİTLERİ ---
  {
    cat: 'pizzalar',
    name: 'Barbekü Soslu Julyen Sosisli Cheddar Pizza',
    description: 'İnce çıtır hamur üzerinde barbekü sos, julyen sosis, bol mozzarella ve zengin cheddar peyniri.',
    price: 530,
    is_popular: 1, is_featured: 1, is_new: 1,
    crop: ['27.jpeg', 185, 'barbeku_sosisli_cheddar_pizza.jpg']
  },
  {
    cat: 'pizzalar',
    name: 'Karışık Pizza',
    description: 'Sucuk, salam, sosis, mantar, mısır ve zeytinin bir araya geldiği, bol malzemeli klasik pizza.',
    price: 530,
    is_popular: 1, is_featured: 1,
    crop: ['26.jpeg', 730, 'karisik_pizza.jpg']
  },
  {
    cat: 'pizzalar',
    name: 'Sucuklu Pizza',
    description: 'Bol kasap sucuk ve kaşar peynirinin birleştiği, geleneksel lezzeti sevenlere özel taş fırın pizza.',
    price: 480,
    is_popular: 0, is_featured: 0,
    crop: ['27.jpeg', 530, 'sucuklu_pizza.jpg']
  },
  {
    cat: 'pizzalar',
    name: 'Vejeteryan Pizza',
    description: 'Mantar, renkli biberler, mısır, zeytin ve taze domatesin birleşimiyle sebze severler için ideal seçim.',
    price: 450,
    is_popular: 0, is_featured: 0, is_vegan: 1,
    crop: ['27.jpeg', 360, 'vejeteryan_pizza.jpg']
  },
  {
    cat: 'pizzalar',
    name: 'Margarita Pizza',
    description: 'İtalyan domates sosu, bol mozzarella peyniri ve taze fesleğenin zarif uyumu.',
    price: 420,
    is_popular: 0, is_featured: 0,
    crop: ['26.jpeg', 895, 'margarita_pizza.jpg']
  },

  // --- WRAP, FAJİTA & QUESADİLLA ---
  {
    cat: 'wrap-fajita',
    name: 'Et Fajita',
    description: 'İnce kesilmiş dana bonfile etler, renkli biberler ve soğanlarla döküm tavada sotelenerek sıcacık tortilla ile sunulur.',
    price: 690,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['25.jpeg', 375, 'et_fajita.jpg']
  },
  {
    cat: 'wrap-fajita',
    name: 'Tavuk Fajita',
    description: 'Jülyen doğranmış tavuk parçaları, renkli biberler ve soğanlarla döküm tavada cızırdayan lezzet.',
    price: 450,
    is_popular: 1, is_featured: 0,
    crop: ['25.jpeg', 205, 'tavuk_fajita.jpg']
  },
  {
    cat: 'wrap-fajita',
    name: 'Et Quesadilla',
    description: 'Tortilla ekmeği arasına yerleştirilmiş dana et parçaları, bol peynir ve soslarla ızgara edilmiş Meksika lezzeti.',
    price: 440,
    is_popular: 1, is_featured: 0,
    crop: ['25.jpeg', 705, 'et_quesadilla.jpg']
  },
  {
    cat: 'wrap-fajita',
    name: 'Tavuk Quesadilla',
    description: 'Tortilla ekmeği arasına yerleştirilmiş marine tavuk parçaları, eritilmiş kaşar ve leziz salsa eşliğinde.',
    price: 380,
    is_popular: 0, is_featured: 0,
    crop: ['25.jpeg', 540, 'tavuk_quesadilla.jpg']
  },
  {
    cat: 'wrap-fajita',
    name: 'Tavuklu Wrap',
    description: 'Marine edilmiş tavuk parçaları, taze sebzeler ve özel sosların lavaşa sarıldığı doyurucu lezzet.',
    price: 385,
    is_popular: 1, is_featured: 0,
    crop: ['22.jpeg', 750, 'tavuklu_wrap.jpg']
  },
  {
    cat: 'wrap-fajita',
    name: 'Et Wrap',
    description: 'Jülyen etler, sotelenmiş sebzeler ve özel gurme sosların yumuşacık lavaşa sarıldığı enfes wrap.',
    price: 440,
    is_popular: 1, is_featured: 0,
    crop: ['22.jpeg', 915, 'et_wrap.jpg']
  },

  // --- MAKARNA & NOODLE ---
  {
    cat: 'makarna-noodle',
    name: 'Tavuklu Fettuchini Alfredo',
    description: 'Kremalı, mantarlı ve marine tavuklu enfes İtalyan fettuccine makarnası.',
    price: 360,
    is_popular: 1, is_featured: 1,
    crop: ['23.jpeg', 200, 'tavuklu_fettuchini_alfredo.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Spagetti Bolonez',
    description: 'Kıymalı ve baharatlı geleneksel İtalyan bolonez sosu ile harmanlanmış spagetti.',
    price: 440,
    is_popular: 1, is_featured: 0,
    crop: ['23.jpeg', 360, 'spagetti_bolonez.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Kremalı Bonfileli Penne',
    description: 'Kremalı sos ve sotelenmiş dana bonfile parçalarıyla zenginleştirilmiş penne makarnası.',
    price: 520,
    is_popular: 1, is_featured: 1,
    crop: ['23.jpeg', 525, 'kremali_bonfileli_penne.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Penne Arabiatta',
    description: 'Acı severler için özel acılı domates sosu, fesleğen ve zeytinle harmanlanan penne.',
    price: 340,
    is_popular: 0, is_featured: 0, is_spicy: 1,
    crop: ['24.jpeg', 690, 'penne_arabiatta.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Et Noodle',
    description: 'Dana etleri ve taze sebzelerin özel sosla harmanlandığı, wok tavada hazırlanan doyurucu noodle.',
    price: 540,
    is_popular: 1, is_featured: 0,
    crop: ['24.jpeg', 370, 'et_noodle.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Tavuklu Noodle',
    description: 'Taze sebzeler ve tavuk parçalarının wok tavada harmanlandığı Uzak Doğu esintili nefis lezzet.',
    price: 485,
    is_popular: 1, is_featured: 0,
    crop: ['24.jpeg', 205, 'tavuklu_noodle.jpg']
  },
  {
    cat: 'makarna-noodle',
    name: 'Vejeteryan Noodle',
    description: 'Taze sebzelerle zenginleştirilmiş, etsiz ve doyurucu wok noodle seçeneği.',
    price: 410,
    is_popular: 0, is_featured: 0, is_vegan: 1,
    crop: ['24.jpeg', 530, 'vejeteryan_noodle.jpg']
  },

  // --- SALATALAR & BOWLLAR ---
  {
    cat: 'salatalar-bowllar',
    name: 'Akdeniz Salata',
    description: 'Mevsim yeşillikleri, domates, salatalık, beyaz peynir ve zeytinlerle hazırlanan ferahlatıcı klasik.',
    price: 400,
    is_popular: 1, is_featured: 1,
    crop: ['23.jpeg', 810, 'akdeniz_salata.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Ton Balıklı Salata',
    description: 'Taze yeşillikler üzerine bol ton balığı, domates, mısır ve özel zeytinyağlı sos.',
    price: 440,
    is_popular: 1, is_featured: 0,
    crop: ['22.jpeg', 185, 'ton_balikli_salata.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Tavuklu Sezar Salata',
    description: 'Izgara tavuk parçaları, çıtır kruton ekmekler, parmesan ve özel Sezar sosu ile.',
    price: 500,
    is_popular: 1, is_featured: 1,
    crop: ['22.jpeg', 350, 'tavuklu_sezar_salata.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Lokum Etli Kinoa Bowl',
    description: 'Akdeniz yeşillikleri üzerine yerleştirilmiş lokum bonfile dilimleri, kinoa, avokado ve çeri domates.',
    price: 780,
    is_popular: 1, is_featured: 1, is_chef_special: 1, is_new: 1,
    crop: ['31.jpeg', 400, 'lokum_etli_kinoa_bowl.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Izgara Tavuklu Bowl',
    description: 'Akdeniz yeşillikleri üzerine yerleştirilmiş ızgara tavuk, çeri domates, mısır, zeytin ve özel bowl sosu.',
    price: 575,
    is_popular: 1, is_featured: 0, is_new: 1,
    crop: ['31.jpeg', 200, 'izgara_tavuklu_bowl.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Falafel Bowl',
    description: 'Akdeniz yeşillikleri üzerine yerleştirilmiş çıtır falafel topları, çeri domates ve tahin soslu sağlıklı kase.',
    price: 480,
    is_popular: 0, is_featured: 0, is_vegan: 1, is_new: 1,
    crop: ['31.jpeg', 600, 'falafel_bowl.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Kıymalı Nachos',
    description: 'Çıtır mısır cipsi üzerine baharatlı kıyma sosu, eritilmiş cheddar ve dip soslar eşliğinde.',
    price: 440,
    is_popular: 1, is_featured: 0, is_new: 1,
    crop: ['32.jpeg', 195, 'kiymali_nachos.jpg']
  },
  {
    cat: 'salatalar-bowllar',
    name: 'Tavuklu Nachos',
    description: 'Çıtır mısır cipsi üzerine sotelenmiş marine tavuk parçaları, eritilmiş cheddar ve salsa sosu.',
    price: 400,
    is_popular: 0, is_featured: 0, is_new: 1,
    crop: ['32.jpeg', 345, 'tavuklu_nachos.jpg']
  },

  // --- TOSTLAR & GÖZLEMELER ---
  {
    cat: 'tostlar-gozlemeler',
    name: 'Karışık Bazlama Tost',
    description: 'Sucuk, kaşar taptaze bazlama ekmeğinde buluştuğu, tam döküm pres tost lezzeti.',
    price: 370,
    is_popular: 1, is_featured: 1,
    crop: ['34.jpeg', 860, 'karisik_bazlama_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Sucuklu Bazlama Tost',
    description: 'İçi sulu, dışı çıtır sucuk dilimlerinin sıcacık bazlama ekmeğinde preslendiği doyurucu tost.',
    price: 360,
    is_popular: 0, is_featured: 0,
    crop: ['34.jpeg', 695, 'sucuklu_bazlama_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Kaşarlı Bazlama Tost',
    description: 'Bol erimiş kaşarın yumuşacık bazlamayla buluştuğu, sadeliğin en lezzetli hali.',
    price: 360,
    is_popular: 0, is_featured: 0,
    crop: ['40.jpeg', 185, 'kasarli_bazlama_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Karışık Standart Tost',
    description: 'Klasik tost sevenler için, sucuk ve kaşarın çıtır ekmekte birleştiği lezzet.',
    price: 340,
    is_popular: 1, is_featured: 0,
    crop: ['34.jpeg', 190, 'karisik_standart_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Sucuklu Standart Tost',
    description: 'Sucuğun altın sarısı kızarmış ekmekte buluştuğu pratik ve lezzetli bir öğün.',
    price: 320,
    is_popular: 0, is_featured: 0,
    crop: ['34.jpeg', 360, 'sucuklu_standart_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Kaşarlı Standart Tost',
    description: 'Sadece kaşar peyniriyle hazırlanan, sadelikten vazgeçemeyenler için çıtır tost.',
    price: 320,
    is_popular: 0, is_featured: 0,
    crop: ['34.jpeg', 525, 'kasarli_standart_tost.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Kaşarlı Gözleme',
    description: 'İncecik açılmış hamurda, bol erimiş kaşar peyniriyle hazırlanan çıtır çıtır sac gözlemesi.',
    price: 340,
    is_popular: 1, is_featured: 0,
    crop: ['32.jpeg', 720, 'kasarli_gozleme.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Sucuklu Kaşarlı Gözleme',
    description: 'Sucuk ve kaşarın gözleme hamurunda birleştiği sıcak ve lezzetli bir seçenek.',
    price: 360,
    is_popular: 1, is_featured: 0,
    crop: ['32.jpeg', 885, 'sucuklu_kasarli_gozleme.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Peynirli Gözleme',
    description: 'Yöresel peynirlerin iç harcını oluşturduğu otantik ve taze sac gözlemesi.',
    price: 300,
    is_popular: 0, is_featured: 0,
    crop: ['36.jpeg', 195, 'peynirli_gozleme.jpg']
  },
  {
    cat: 'tostlar-gozlemeler',
    name: 'Patatesli Gözleme',
    description: 'İçinde yumuşacık patates püresi ve baharatların olduğu doyurucu ve lezzetli sac gözlemesi.',
    price: 300,
    is_popular: 0, is_featured: 0,
    crop: ['36.jpeg', 360, 'patatesli_gozleme.jpg']
  },

  // --- SANDVİÇLER & ATIŞTIRMALIKLAR ---
  {
    cat: 'sandvic-atistirmalik',
    name: 'Füme Etli Sandviç',
    description: 'Özel baget ekmeğinde kaliteli dana füme et dilimleri, yeşillik ve trüflü sos.',
    price: 370,
    is_popular: 1, is_featured: 1,
    crop: ['26.jpeg', 345, 'fume_etli_sandvic.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Tavuklu Sandviç',
    description: 'Izgara tavuğun lezzeti, trüflü mayonez, taze yeşillikler ve kornişon turşu ile baget sandviç.',
    price: 350,
    is_popular: 0, is_featured: 0,
    crop: ['26.jpeg', 185, 'tavuklu_sandvic.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Falafel Sandviç',
    description: 'Nohut köftesinin nefis lezzeti, avokado sos, taze yeşillikler ve turşu ile çıtır baget.',
    price: 320,
    is_popular: 0, is_featured: 0, is_vegan: 1,
    crop: ['33.jpeg', 885, 'falafel_sandvic.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Karışık Sepet',
    description: 'Soğan halkası, sigara böreği, çıtır nugget ve patates kızartmasından oluşan zengin atıştırmalık sepeti.',
    price: 400,
    is_popular: 1, is_featured: 1,
    crop: ['40.jpeg', 575, 'karisik_sepet.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Çıtır Paneli Tavuk',
    description: 'Dışı çıtır çıtır, içi yumuşacık tavuk parçaları, özel panelenmiş sosu ve kızarmış patates ile.',
    price: 320,
    is_popular: 1, is_featured: 0,
    crop: ['40.jpeg', 740, 'citir_paneli_tavuk.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Sigara Böreği',
    description: 'İncecik yufkadan sarılmış, bol peynirli iç harcıyla çıtır çıtır kızartılmış klasik lezzet.',
    price: 260,
    is_popular: 0, is_featured: 0,
    crop: ['40.jpeg', 905, 'sigara_boregi.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Patates Kızartması',
    description: 'Çıtır çıtır kızartılmış, tuzlu ve sıcacık patates sepeti.',
    price: 220,
    is_popular: 1, is_featured: 0,
    crop: ['33.jpeg', 190, 'patates_kizartmasi.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Soğan Halkası',
    description: 'Altın sarısı, çıtır dış kabuğu ve içi yumuşak soğan halkaları.',
    price: 235,
    is_popular: 0, is_featured: 0,
    crop: ['33.jpeg', 360, 'sogan_halkasi.jpg']
  },
  {
    cat: 'sandvic-atistirmalik',
    name: 'Lüks Karışık Çerez',
    description: 'Taptaze kavrulmuş kaju, fındık, badem ve fıstıktan oluşan lüks çerez tabağı.',
    price: 250,
    is_popular: 1, is_featured: 0,
    crop: ['12.jpeg', 370, 'luks_karisik_cerez.jpg']
  },

  // --- TATLILAR & DONDURMA ---
  {
    cat: 'tatlilar-dondurma',
    name: 'San Sebastian Cheesecake',
    description: 'İçi akışkan ve kremsi, dışı hafifçe karamelize olmuş, sıcak Belçika çikolatasıyla servis edilen Bask usulü cheesecake.',
    price: 280,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['44.jpeg', 210, 'san_sebastian.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Frambuazlı Cheesecake',
    description: 'Kremsi cheesecake tabanının üzerinde, hafif ekşimsi frambuaz soslu taze dilim.',
    price: 240,
    is_popular: 1, is_featured: 0,
    crop: ['43.jpeg', 205, 'frambuazli_cheesecake.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Limonlu Cheesecake',
    description: 'Limonun ferahlatıcı tadıyla hafifletilmiş, özel soslu nefis cheesecake.',
    price: 240,
    is_popular: 0, is_featured: 0,
    crop: ['43.jpeg', 400, 'limonlu_cheesecake.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Dondurmalı Sufle',
    description: 'Sıcak akışkan çikolatalı sufle, yanında vanilyalı soğuk dondurmayla servis edilir.',
    price: 260,
    is_popular: 1, is_featured: 1,
    crop: ['42.jpeg', 885, 'dondurmali_sufle.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Magnolia Çilek',
    description: 'Kat kat dizilmiş kremsi puding ve taze çileklerle hazırlanan hafif ve leziz tatlı.',
    price: 240,
    is_popular: 1, is_featured: 0,
    crop: ['43.jpeg', 595, 'magnolia_cilek.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Magnolia Muz',
    description: 'Kremsi puding ve taze muz dilimleriyle hazırlanan klasik ve hafif tatlı.',
    price: 240,
    is_popular: 0, is_featured: 0,
    crop: ['43.jpeg', 760, 'magnolia_muz.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Magnolia Oreo',
    description: 'Kremsi puding arasına eklenmiş bol Oreo bisküvisiyle hazırlanan enfes kupa.',
    price: 240,
    is_popular: 1, is_featured: 0,
    crop: ['43.jpeg', 925, 'magnolia_oreo.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Triliçe Karamel',
    description: 'Üç farklı sütün bir araya geldiği hafif kekin üzerine karamel sosla lezzetlenen hafif Balkan tatlısı.',
    price: 250,
    is_popular: 1, is_featured: 0,
    crop: ['42.jpeg', 195, 'trilice_karamel.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Waffle Mix Meyveli Dondurmalı',
    description: 'Meyveli waffle üzerine eklenen bir top dondurmayla lezzeti katlayan özel tatlı.',
    price: 310,
    is_popular: 1, is_featured: 1,
    crop: ['42.jpeg', 540, 'waffle_mix_dondurmali.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Waffle Mix Meyveli',
    description: 'Taptaze hamur üzerinde çeşitli mevsim meyveleri ve çikolata sosuyla zenginleştirilmiş waffle.',
    price: 280,
    is_popular: 1, is_featured: 0,
    crop: ['42.jpeg', 375, 'waffle_mix_meyveli.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Waffle Sade Çikolatalı',
    description: 'Sade hamurun üzerine bol çikolata sosuyla hazırlanan klasik bir lezzet.',
    price: 240,
    is_popular: 0, is_featured: 0,
    crop: ['42.jpeg', 710, 'waffle_sade_cikolatali.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Tiramisu',
    description: 'Kahveye batırılmış kedi dilleri ve mascarpone kremasıyla hazırlanan İtalyan klasiği.',
    price: 260,
    is_popular: 1, is_featured: 0,
    crop: ['45.jpeg', 240, 'tiramisu.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Meyve Tabağı',
    description: 'Mevsimin en taze ve renkli meyvelerinin dilimlenerek sunulduğu ferahlatıcı meyve şöleni.',
    price: 480,
    is_popular: 0, is_featured: 0,
    crop: ['45.jpeg', 385, 'meyve_tabagi.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Tatlı Tuzlu Kurabiye',
    description: 'Çay ve kahvenin yanına eşlik eden enfes taze fırınlanmış tatlı ve tuzlu kurabiye tabağı.',
    price: 250,
    is_popular: 0, is_featured: 0,
    crop: ['45.jpeg', 720, 'tatli_tuzlu_kurabiye.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Tam Porsiyon Dondurma (4 Top)',
    description: 'Farklı aromalardan seçebileceğiniz dört top nefis Maraş usulü dondurma kadehi.',
    price: 400,
    is_popular: 1, is_featured: 0,
    crop: ['46.jpeg', 385, 'tam_porsiyon_dondurma.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Yarım Porsiyon Dondurma (2 Top)',
    description: 'İki top dondurmayla serinletici bir tatlı molası.',
    price: 200,
    is_popular: 0, is_featured: 0,
    crop: ['46.jpeg', 545, 'yarim_porsiyon_dondurma.jpg']
  },
  {
    cat: 'tatlilar-dondurma',
    name: 'Top Dondurma',
    description: 'İstediğiniz aromada tek top dondurma (Masaya tek top servisimiz yoktur, ilave içindir).',
    price: 100,
    is_popular: 0, is_featured: 0,
    crop: ['46.jpeg', 740, 'top_dondurma.jpg']
  },

  // --- ÇAY & SEMAVER ---
  {
    cat: 'cay-semaver',
    name: 'Bardak Çay',
    description: 'Demli, sıcacık ve taze Rize çayı, günün her saatine keyif katar.',
    price: 60,
    is_popular: 1, is_featured: 1,
    crop: ['1.jpeg', 400, 'bardak_cay.jpg']
  },
  {
    cat: 'cay-semaver',
    name: 'Double Çay',
    description: 'Çay keyfini uzatmak isteyenler için iki katı lezzet ve hacim.',
    price: 100,
    is_popular: 0, is_featured: 0,
    crop: ['1.jpeg', 720, 'double_cay.jpg']
  },
  {
    cat: 'cay-semaver',
    name: 'Küçük Boy Semaver',
    description: 'Sohbetlerinize eşlik edecek, 2-3 kişiye yetecek sıcak ve taze çay keyfi.',
    price: 450,
    is_popular: 1, is_featured: 1,
    crop: ['1.jpeg', 1030, 'kucuk_semaver.jpg']
  },
  {
    cat: 'cay-semaver',
    name: 'Orta Boy Semaver',
    description: 'Kalabalık arkadaş gruplarının vazgeçilmezi, bitmeyen çay lezzeti.',
    price: 650,
    is_popular: 1, is_featured: 0,
    crop: ['1.jpeg', 1300, 'orta_semaver.jpg']
  },
  {
    cat: 'cay-semaver',
    name: 'Büyük Boy Semaver',
    description: 'Aile ve dostlarla keyifli vakitler geçirmek için ideal, bol bol demli çay keyfi.',
    price: 750,
    is_popular: 1, is_featured: 1,
    crop: ['12.jpeg', 205, 'buyuk_semaver.jpg']
  },

  // --- BİTKİ ÇAYLARI ---
  {
    cat: 'bitki-caylari',
    name: 'Kış Çayı',
    description: 'Portakal, zencefil, tarçın ve çeşitli baharatlarla harmanlanmış, iç ısıtan şifa kaynağı.',
    price: 145,
    is_popular: 1, is_featured: 1,
    crop: ['19.jpeg', 205, 'kis_cayi.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Papatya Çayı',
    description: 'Doğal papatya çiçeklerinden demlenen, sakinleştirici ve dinlendirici bitki çayı.',
    price: 185,
    is_popular: 0, is_featured: 0,
    crop: ['19.jpeg', 370, 'papatya_cayi.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Nar Çiçeği',
    description: 'Hafif ekşimsi tadıyla ferahlık veren, rengi ve tadıyla büyüleyen bitki çayı.',
    price: 145,
    is_popular: 1, is_featured: 0,
    crop: ['20.jpeg', 185, 'nar_cicegi.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Nane Limon',
    description: 'Nane ve limonun ferahlatıcı uyumu, sıcak veya soğuk olarak keyifle içilir.',
    price: 145,
    is_popular: 1, is_featured: 0,
    crop: ['20.jpeg', 350, 'nane_limon.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Adaçayı',
    description: 'Boğazı rahatlatan, ferahlatıcı ve doğal bir bitki çayı.',
    price: 145,
    is_popular: 0, is_featured: 0,
    crop: ['20.jpeg', 520, 'adacayi.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Ihlamur',
    description: 'Soğuk kış günlerinde içinizi ısıtacak, doğal ve şifalı bir lezzet.',
    price: 185,
    is_popular: 1, is_featured: 0,
    crop: ['20.jpeg', 690, 'ihlamur.jpg']
  },
  {
    cat: 'bitki-caylari',
    name: 'Kuşburnu',
    description: 'C vitamini deposu, ekşimsi ve ferahlatıcı bir geleneksel tat.',
    price: 145,
    is_popular: 0, is_featured: 0,
    crop: ['20.jpeg', 855, 'kusburnu.jpg']
  },

  // --- SICAK KAHVELER ---
  {
    cat: 'sicak-kahveler',
    name: 'Türk Kahvesi',
    description: 'Geleneksel fincan keyfi, köpüklü ve bol aromalı Türk kahvesi, yanında su ve lokum ile.',
    price: 120,
    is_popular: 1, is_featured: 1,
    crop: ['11.jpeg', 260, 'turk_kahvesi.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Double Türk Kahvesi',
    description: 'Geleneksel lezzetten vazgeçemeyenler için duble boy, bol köpüklü keyif.',
    price: 150,
    is_popular: 1, is_featured: 0,
    crop: ['11.jpeg', 425, 'double_turk_kahvesi.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Espresso',
    description: 'İtalyan klasiği, yoğun ve aromatik bir shot kahve.',
    price: 150,
    is_popular: 0, is_featured: 0,
    crop: ['10.jpeg', 215, 'espresso.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Double Espresso',
    description: 'Yoğun kahve lezzetini ikiye katlayan, çift shot espresso.',
    price: 165,
    is_popular: 0, is_featured: 0,
    crop: ['10.jpeg', 380, 'double_espresso.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Americano',
    description: 'Espresso\'nun sıcak suyla inceltilmesiyle elde edilen, yumuşak içimli sade kahve.',
    price: 185,
    is_popular: 1, is_featured: 0,
    crop: ['10.jpeg', 550, 'americano.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Sütlü Americano',
    description: 'Americano\'ya eklenen sıcak sütle yumuşatılmış, hafif içimli bir kahve.',
    price: 195,
    is_popular: 0, is_featured: 0,
    crop: ['10.jpeg', 720, 'sutlu_americano.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Filtre Kahve',
    description: 'Damıtılarak hazırlanan, aromatik ve hafif içimli filtre kahve.',
    price: 175,
    is_popular: 1, is_featured: 1,
    crop: ['10.jpeg', 885, 'filtre_kahve.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Sütlü Filtre Kahve',
    description: 'Filtre kahvenin sütle harmanlanarak daha yumuşak içimli hale getirilmiş sunumu.',
    price: 185,
    is_popular: 0, is_featured: 0,
    crop: ['9.jpeg', 225, 'sutlu_filtre_kahve.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Cappucino',
    description: 'Yoğun espresso\'nun üzerine köpüklü sıcak sütle hazırlanan, kadifemsi kahve.',
    price: 210,
    is_popular: 1, is_featured: 0,
    crop: ['9.jpeg', 390, 'cappucino.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Latte',
    description: 'Yoğun espresso ve bol sıcak sütün birleşimiyle oluşan, hafif ve kremsi bir deneyim.',
    price: 210,
    is_popular: 1, is_featured: 1,
    crop: ['9.jpeg', 560, 'latte.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Caramel Latte',
    description: 'Cafe Latte\'nin karamel şurubuyla zenginleştirilmiş, tatlı bir lezzet.',
    price: 220,
    is_popular: 1, is_featured: 0,
    crop: ['9.jpeg', 725, 'caramel_latte.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Nescafe',
    description: 'Hızlı ve pratik bir kahve keyfi arayanlar için sıcak Nescafe.',
    price: 150,
    is_popular: 0, is_featured: 0,
    crop: ['11.jpeg', 595, 'nescafe.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Sütlü Nescafe',
    description: 'Sütle yumuşatılmış klasik Nescafe lezzeti.',
    price: 165,
    is_popular: 0, is_featured: 0,
    crop: ['11.jpeg', 760, 'sutlu_nescafe.jpg']
  },
  {
    cat: 'sicak-kahveler',
    name: 'Affagado',
    description: 'Vanilyalı dondurma ve sıcak Espresso\'nun muazzam İtalyan buluşması.',
    price: 240,
    is_popular: 1, is_featured: 1,
    crop: ['11.jpeg', 925, 'affagado.jpg']
  },

  // --- SOĞUK KAHVELER ---
  {
    cat: 'soguk-kahveler',
    name: 'Ice Americano',
    description: 'Espresso\'nun buz ve soğuk suyla buluşmasıyla oluşan, serinletici sert kahve.',
    price: 220,
    is_popular: 1, is_featured: 1,
    crop: ['12.jpeg', 750, 'ice_americano.jpg']
  },
  {
    cat: 'soguk-kahveler',
    name: 'Ice Filtre Kahve',
    description: 'Soğuk demlenmiş, aromatik ve hafif içimli buzlu filtre kahve.',
    price: 215,
    is_popular: 0, is_featured: 0,
    crop: ['4.jpeg', 205, 'ice_filtre_kahve.jpg']
  },
  {
    cat: 'soguk-kahveler',
    name: 'Ice Mocha',
    description: 'Espresso, çikolata sosu ve sütün buzla harmanlandığı, çikolata ve kahve aşkı.',
    price: 240,
    is_popular: 1, is_featured: 1,
    crop: ['4.jpeg', 365, 'ice_mocha.jpg']
  },
  {
    cat: 'soguk-kahveler',
    name: 'Ice White Chocolate Mocha',
    description: 'Beyaz çikolata sosu, espresso ve sütün buzla buluşmasıyla oluşan yumuşak içimli favori.',
    price: 240,
    is_popular: 1, is_featured: 1,
    crop: ['4.jpeg', 535, 'ice_white_chocolate_mocha.jpg']
  },
  {
    cat: 'soguk-kahveler',
    name: 'Ice Latte',
    description: 'Espresso\'nun buzlu sütle buluştuğu, hafif ve kremsi bir soğuk içecek.',
    price: 230,
    is_popular: 1, is_featured: 0,
    crop: ['4.jpeg', 730, 'ice_latte.jpg']
  },
  {
    cat: 'soguk-kahveler',
    name: 'Ice Caramel Latte',
    description: 'Buzlu latte\'nin karamel sosuyla lezzetlendirildiği tatlı ve ferah bir deneyim.',
    price: 240,
    is_popular: 1, is_featured: 0,
    crop: ['4.jpeg', 900, 'ice_caramel_latte.jpg']
  },

  // --- LİMONATA & TAZE SIKMA ---
  {
    cat: 'limonata-taze-sikma',
    name: 'Churcill',
    description: 'Limon, tuz ve maden suyunun birleşimiyle hazırlanan, mideyi rahatlatan efsane.',
    price: 165,
    is_popular: 1, is_featured: 1,
    crop: ['2.jpeg', 606, 'churcill.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Sade Limonata',
    description: 'El yapımı, taptaze Akdeniz limonları ve nane ile hazırlanan serinletici sade limonata.',
    price: 230,
    is_popular: 1, is_featured: 1,
    crop: ['2.jpeg', 874, 'sade_limonata.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Naneli Limonata',
    description: 'Ferahlatıcı nane yapraklarıyla zenginleştirilmiş, yaz aylarının vazgeçilmezi.',
    price: 230,
    is_popular: 1, is_featured: 0,
    crop: ['2.jpeg', 1141, 'naneli_limonata.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Çilekli Limonata',
    description: 'Limonatanın taze çilekle buluşmasıyla ortaya çıkan, tatlı ve ekşi dengeli özel lezzet.',
    price: 230,
    is_popular: 1, is_featured: 1,
    crop: ['3.jpeg', 205, 'cilekli_limonata.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Orman Meyveli Limonata',
    description: 'Orman meyvelerinin tatlı ve ekşi tadının el yapımı limonatayla birleşimi.',
    price: 230,
    is_popular: 0, is_featured: 0,
    crop: ['3.jpeg', 380, 'orman_meyveli_limonata.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Taze Sıkma Portakal Suyu',
    description: 'Güne zinde bir başlangıç için taptaze Finike portakallarından sıkılmış vitamin deposu.',
    price: 230,
    is_popular: 1, is_featured: 0,
    crop: ['3.jpeg', 550, 'taze_portakal_suyu.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Taze Sıkma Nar Suyu',
    description: 'Antioksidan deposu, doğal ve taptaze sıkılmış nar suyu.',
    price: 230,
    is_popular: 1, is_featured: 0,
    crop: ['3.jpeg', 715, 'taze_nar_suyu.jpg']
  },
  {
    cat: 'limonata-taze-sikma',
    name: 'Nar-Portakal Mix',
    description: 'Portakal ve narın bir araya geldiği, C vitamini deposu ve dengeli meyve suyu karışımı.',
    price: 230,
    is_popular: 0, is_featured: 0,
    crop: ['3.jpeg', 900, 'nar_portakal_mix.jpg']
  },

  // --- ALKOLSÜZ KOKTEYLLER & FRESH İÇECEKLER ---
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Mojito (Alkolsüz)',
    description: 'Taze nane yaprakları, misket limonu, esmer şeker dokunuşu ve Sprite ile harmanlanan efsane kokteyl.',
    price: 285,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['13.jpeg', 606, 'mojito.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Soft Green',
    description: 'Elma şurubu, elma suyu, taze misket limonu suyu ve buzla ferahlatıcı yeşil tat.',
    price: 285,
    is_popular: 1, is_featured: 0,
    crop: ['13.jpeg', 874, 'soft_green.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Virgin Piña Colada',
    description: 'Süt, ananas suyu ve yoğun hindistan cevizi sütünün buzla karıştırıldığı tropikal rüya.',
    price: 285,
    is_popular: 1, is_featured: 1,
    crop: ['13.jpeg', 1141, 'virgin_pina_colada.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Garden World',
    description: 'Elma, misket limon, vişne suyu ve maden suyunun özel Denize Karşı Garden harmanı.',
    price: 285,
    is_popular: 1, is_featured: 1, is_new: 1,
    crop: ['6.jpeg', 205, 'garden_world.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Passion Dream',
    description: 'Çarkıfelek meyvesi (passion fruit), taze ananas suyu ve buz ile tropikal şölen.',
    price: 285,
    is_popular: 1, is_featured: 0, is_new: 1,
    crop: ['6.jpeg', 370, 'passion_dream.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Summer Light',
    description: 'Portakal suyu, taze limon, şeftali suyu ve vişne aromasıyla ferah yaz esintisi.',
    price: 285,
    is_popular: 0, is_featured: 0, is_new: 1,
    crop: ['6.jpeg', 535, 'summer_light.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Blue Line',
    description: 'Turunç, hindistan cevizi, misket limon, elma suyu ve Blue Curacao şurubuyla egzotik mavi kokteyl.',
    price: 285,
    is_popular: 1, is_featured: 1, is_new: 1,
    crop: ['6.jpeg', 700, 'blue_line.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Cool Lime',
    description: 'Misket limonunun canlı aroması ve nanenin ferahlatıcı dokunuşu bir arada.',
    price: 285,
    is_popular: 1, is_featured: 1,
    crop: ['17.jpeg', 185, 'cool_lime.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Berry Hibiskus',
    description: 'Orman meyvelerinin canlı aroması ve hibiskusun kendine özgü ekşimsi tadıyla buz gibi ferahlık.',
    price: 285,
    is_popular: 1, is_featured: 0,
    crop: ['17.jpeg', 350, 'berry_hibiskus.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Strawberry Lime',
    description: 'Çilek, misket limonu, nane ve buz. Tatlı-ekşi ve çok ferahlatıcı.',
    price: 285,
    is_popular: 0, is_featured: 0,
    crop: ['17.jpeg', 520, 'strawberry_lime.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Mango Passion',
    description: 'Mango, passion fruit ve buz. Daha tropikal ve yoğun lezzet sevenler için.',
    price: 285,
    is_popular: 1, is_featured: 1,
    crop: ['17.jpeg', 690, 'mango_passion.jpg']
  },
  {
    cat: 'alkolsuz-kokteyller',
    name: 'Passion Fruit Lime',
    description: 'Çarkıfelek meyvesi, lime, nane ve buz. Tropikal ve ekşi uyum.',
    price: 285,
    is_popular: 0, is_featured: 0,
    crop: ['17.jpeg', 855, 'passion_fruit_lime.jpg']
  },

  // --- MİLKSHAKE, FROZEN & NATURAL İÇECEKLER ---
  {
    cat: 'milkshake-frozen',
    name: 'Çikolatalı Milkshake',
    description: 'Yoğun çikolata sosu ve vanilyalı dondurmanın birleşimiyle oluşan kıvamlı serinlik.',
    price: 280,
    is_popular: 1, is_featured: 1,
    crop: ['7.jpeg', 400, 'cikolatali_milkshake.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Çilekli Milkshake',
    description: 'Taptaze çileklerin vanilyalı dondurmayla harmanlandığı kremsi yaz klasiği.',
    price: 280,
    is_popular: 1, is_featured: 0,
    crop: ['7.jpeg', 570, 'cilekli_milkshake.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Vanilya Milkshake',
    description: 'Kremsi ve sade vanilya lezzeti, klasik tatları sevenler için ideal.',
    price: 280,
    is_popular: 0, is_featured: 0,
    crop: ['7.jpeg', 740, 'vanilya_milkshake.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Karamel Milkshake',
    description: 'Karamelin tatlı ve yoğun tadının dondurmayla buluştuğu zengin milkshake.',
    price: 280,
    is_popular: 1, is_featured: 0,
    crop: ['7.jpeg', 915, 'karamel_milkshake.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Classic Ice Chocolate',
    description: 'Buzlu, yoğun çikolata lezzetiyle serinletici bir soğuk içecek.',
    price: 240,
    is_popular: 1, is_featured: 0,
    crop: ['18.jpeg', 450, 'classic_ice_chocolate.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Muzlu Ice Chocolate',
    description: 'Çikolata ve muzun eşsiz uyumuyla hazırlanan, buzlu ve ferahlatıcı lezzet.',
    price: 240,
    is_popular: 0, is_featured: 0,
    crop: ['18.jpeg', 615, 'muzlu_ice_chocolate.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Ice White Chocolate',
    description: 'Beyaz çikolata severler için özel olarak hazırlanmış, buzlu ve kremsi tat.',
    price: 240,
    is_popular: 0, is_featured: 0,
    crop: ['18.jpeg', 785, 'ice_white_chocolate.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Çilek Frozen',
    description: 'Taptaze çileklerin buzla harmanlandığı, ferahlatıcı ve tatlı bir yaz serinliği.',
    price: 280,
    is_popular: 1, is_featured: 1,
    crop: ['8.jpeg', 415, 'cilek_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Karpuz Frozen',
    description: 'Yaz günlerinin en sevilen lezzeti karpuzun buzla buluşmasıyla oluşan ferahlık.',
    price: 280,
    is_popular: 1, is_featured: 0,
    crop: ['8.jpeg', 590, 'karpuz_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Kavun Frozen',
    description: 'Mis kokulu kavunun buzla harmanlandığı, yaz sıcağında serinleten tat.',
    price: 280,
    is_popular: 0, is_featured: 0,
    crop: ['8.jpeg', 760, 'kavun_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Orman Meyveli Frozen',
    description: 'Böğürtlen, ahududu ve yaban mersini gibi orman meyvelerinin buzla eşsiz karışımı.',
    price: 280,
    is_popular: 1, is_featured: 0,
    crop: ['8.jpeg', 925, 'orman_meyveli_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Natural Kavun Frozen',
    description: 'Taze kavundan hazırlanan ferahlatıcı lezzet, kendi kavun kabuğunda özel sunumuyla.',
    price: 390,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['19.jpeg', 750, 'natural_kavun_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Natural Ananas Frozen',
    description: 'Taze ananastan hazırlanan ferahlatıcı lezzet, kendi ananas kabuğunda tropikal sunumuyla.',
    price: 390,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: ['21.jpeg', 375, 'natural_ananas_frozen.jpg']
  },
  {
    cat: 'milkshake-frozen',
    name: 'Coconut Shake',
    description: 'Taze Hindistan cevizinden hazırlanan egzotik içecek, kendi kabuğu ile ikram edilir.',
    price: 390,
    is_popular: 1, is_featured: 1,
    crop: ['21.jpeg', 560, 'coconut_shake.jpg']
  },

  // --- SOĞUK İÇECEKLER & MEŞRUBAT ---
  {
    cat: 'soguk-icecekler',
    name: 'Su',
    description: 'İhtiyacınız olan en temel şey, sade ve buz gibi su.',
    price: 50,
    is_popular: 0, is_featured: 0,
    crop: ['14.jpeg', 225, 'su.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Sade Soda',
    description: 'Midenizi rahatlatacak, ferahlatıcı sade maden suyu.',
    price: 85,
    is_popular: 0, is_featured: 0,
    crop: ['14.jpeg', 395, 'sade_soda.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Meyveli Soda Elma',
    description: 'Elma aromalı, ferahlatıcı ve hafif meyveli soda.',
    price: 95,
    is_popular: 0, is_featured: 0,
    crop: ['14.jpeg', 565, 'meyveli_soda_elma.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Meyveli Soda Limon',
    description: 'Limon aromalı, serinletici ve hafif bir içecek.',
    price: 95,
    is_popular: 0, is_featured: 0,
    crop: ['14.jpeg', 735, 'meyveli_soda_limon.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Meyveli Soda Karpuz-Çilek',
    description: 'Karpuz ve çileğin ferahlatıcı uyumunu sunan meyveli soda.',
    price: 95,
    is_popular: 0, is_featured: 0,
    crop: ['15.jpeg', 225, 'meyveli_soda_karpuz_cilek.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Ayran',
    description: 'Geleneksel içeceğimiz, serinletici ve tuzlu köpüklü ayran.',
    price: 75,
    is_popular: 1, is_featured: 0,
    crop: ['15.jpeg', 395, 'ayran.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Coca Cola',
    description: 'Klasik ve vazgeçilmez bir tat, buz ve limon dilimiyle.',
    price: 120,
    is_popular: 1, is_featured: 0,
    crop: ['15.jpeg', 565, 'coca_cola.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Coca Cola Zero',
    description: 'Sıfır şeker, maksimum serinletici kola lezzeti.',
    price: 120,
    is_popular: 0, is_featured: 0,
    crop: ['16.jpeg', 735, 'coca_cola_zero.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Fanta',
    description: 'Portakal aromalı, ferahlatıcı gazlı içecek.',
    price: 120,
    is_popular: 0, is_featured: 0,
    crop: ['15.jpeg', 735, 'fanta.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Sprite',
    description: 'Limon-misket limonu aromalı, ferahlatıcı ve gazlı bir içecek.',
    price: 120,
    is_popular: 0, is_featured: 0,
    crop: ['15.jpeg', 905, 'sprite.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Fuse Tea Çeşitleri',
    description: 'Çeşitli meyve aromalarıyla ferahlık veren buzlu çaylar (Şeftali, Limon, Mango).',
    price: 120,
    is_popular: 0, is_featured: 0,
    crop: ['16.jpeg', 225, 'fuse_tea.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Cappy Çeşitleri',
    description: 'Farklı meyve aromalarıyla taze bir lezzet sunan meyve suları.',
    price: 120,
    is_popular: 0, is_featured: 0,
    crop: ['16.jpeg', 395, 'cappy.jpg']
  },
  {
    cat: 'soguk-icecekler',
    name: 'Redbull Original',
    description: 'Enerji veren ve zinde tutan klasik Redbull kutu.',
    price: 180,
    is_popular: 1, is_featured: 0,
    crop: ['16.jpeg', 565, 'redbull.jpg']
  },

  // --- NARGİLE ÇEŞİTLERİ ---
  {
    cat: 'nargile',
    name: 'Denize Karşı Özel Karışım Nargile',
    description: 'İşletmemize özel tropikal meyveler, hafif nane ve buzlu marpuç eşliğinde premium nargile keyfi.',
    price: 500,
    is_popular: 1, is_featured: 1, is_chef_special: 1,
    crop: null
  },
  {
    cat: 'nargile',
    name: 'Love 66 Nargile',
    description: 'Kavun, karpuz, çarkıfelek ve nane harmanı efsane tatlı aroma.',
    price: 450,
    is_popular: 1, is_featured: 0,
    crop: null
  },
  {
    cat: 'nargile',
    name: 'Lady Killer Nargile',
    description: 'Şeftali, kavun, mango ve hafif nane esintili popüler aroma.',
    price: 450,
    is_popular: 1, is_featured: 0,
    crop: null
  },
  {
    cat: 'nargile',
    name: 'Çift Elma & Nane Nargile',
    description: 'Geleneksel anason ve elma aroması, ferah nane dokunuşuyla.',
    price: 450,
    is_popular: 0, is_featured: 0,
    crop: null
  },
  {
    cat: 'nargile',
    name: 'Yaban Mersini & Nane Nargile',
    description: 'Yaban mersininin tatlı kokusu ve ferahlatıcı buzlu nane marpuç uyumu.',
    price: 450,
    is_popular: 0, is_featured: 0,
    crop: null
  }
];

async function run() {
  console.log('--- STARTING REAL MENU SEEDING & CROPPING ---');
  console.log(`Processing ${CATEGORIES.length} categories and ${PRODUCTS_DATA.length} products...`);

  // Crop all images
  console.log('Cropping product photos from screenshot collection...');
  const productFinalList = [];
  for (const item of PRODUCTS_DATA) {
    let imageUrl = null;
    if (item.crop) {
      const [imgFile, topPos, targetName] = item.crop;
      imageUrl = await cropThumbnail(imgFile, topPos, targetName);
    }
    productFinalList.push({
      ...item,
      image_url: imageUrl
    });
  }

  // Connect to DB
  const db = new DatabaseSync(dbPath);

  // Clear existing menu data
  console.log('Clearing old placeholder menu products and categories...');
  db.exec('DELETE FROM menu_products');
  db.exec('DELETE FROM menu_categories');

  // Insert categories
  console.log('Inserting new authentic categories...');
  const catStmt = db.prepare(`
    INSERT INTO menu_categories (name, slug, description, icon, sort_order, is_active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const categoryMap = {}; // slug -> id
  for (const cat of CATEGORIES) {
    catStmt.run(cat.name, cat.slug, cat.description, cat.icon, cat.sort_order);
    const row = db.prepare('SELECT id FROM menu_categories WHERE slug = ?').get(cat.slug);
    categoryMap[cat.slug] = row.id;
  }

  // Insert products
  console.log('Inserting authentic products...');
  const prodStmt = db.prepare(`
    INSERT INTO menu_products (
      category_id, name, slug, description, price, discounted_price,
      image_url, is_featured, is_popular, is_new, is_recommended,
      is_chef_special, is_vegan, is_spicy, is_available, is_active, sort_order
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
  `);

  let count = 0;
  for (let i = 0; i < productFinalList.length; i++) {
    const p = productFinalList[i];
    const categoryId = categoryMap[p.cat];
    if (!categoryId) {
      console.warn(`Category slug not found: ${p.cat} for ${p.name}`);
      continue;
    }
    const productSlug = slugify(p.name);
    prodStmt.run(
      categoryId,
      p.name,
      productSlug,
      p.description,
      p.price,
      null,
      p.image_url,
      p.is_featured ? 1 : 0,
      p.is_popular ? 1 : 0,
      p.is_new ? 1 : 0,
      p.is_recommended ? 1 : 0,
      p.is_chef_special ? 1 : 0,
      p.is_vegan ? 1 : 0,
      p.is_spicy ? 1 : 0,
      i + 1
    );
    count++;
  }

  console.log(`✓ SUCCESS: Seeded ${CATEGORIES.length} categories and ${count} authentic products into database!`);
}

run().catch(err => {
  console.error('Fatal seeding error:', err);
  process.exit(1);
});
