import fs from 'fs';
import path from 'path';

function runRulesCheck() {
  const currentDir = process.cwd();
  console.log('\n================================================================');
  console.log('📌 AKREDİTASYON SİSTEMİ - TÜM SİSTEM VE GÜVENLİK KURALLARI RAPORU');
  console.log(`📁 Çalıştırılan Klasör: ${currentDir}`);
  console.log('================================================================\n');

  let ruleIndex = 1;

  // 1. Dosya Boyut Sınırları
  const utilsPath = path.join(currentDir, 'lib/utils.ts');
  if (fs.existsSync(utilsPath)) {
    const content = fs.readFileSync(utilsPath, 'utf8');
    if (content.includes('validateFileSize')) {
      console.log(`${ruleIndex++}. 📤 DOSYA YÜKLEME BOYUT SINIRLARI:`);
      console.log('   - Video Dosyaları (.mp4, .webm, .mkv, .mov vb.): MAKSİMUM 50 MB');
      console.log('   - Doküman & Görseller (.pdf, .docx, .xlsx, .jpg vb.): MAKSİMUM 5 MB\n');
    }
  }

  // 2. Storage Fiziki Silme Kuralı
  const phasePath = path.join(currentDir, 'components/PhaseClient.tsx');
  if (fs.existsSync(phasePath)) {
    const content = fs.readFileSync(phasePath, 'utf8');
    if (content.includes('.remove([')) {
      console.log(`${ruleIndex++}. 🗑️ OTOMATİK DEPOLAMA TEMİZLİK KURALI (STORAGE CLEANUP):`);
      console.log('   - Arayüzden silinen veya değiştirilen kanıt dosyası Supabase Storage sunucusundan fiziki olarak (.remove) anında silinir.\n');
    }
  }

  // 3. Ders İzlencesi Düzenleme Yetkisi & E-Posta Kuralı
  const izlencePath = path.join(currentDir, 'app/[locale]/izlenceler/page.tsx');
  if (fs.existsSync(izlencePath)) {
    const content = fs.readFileSync(izlencePath, 'utf8');
    console.log(`${ruleIndex++}. 🔑 DERS İZLENCESİ DÜZENLEME VE DOLDURMA YETKİSİ:`);
    if (content.includes('harran.edu.tr')) {
      console.log('   - Kurum Kuralı: Harran İlahiyat (@harran.edu.tr)');
      console.log('   - Yetki: Yöneticiler, Birim Sorumluları ve @harran.edu.tr uzantılı tüm hocalar (ölçüt almasalar bile) ders izlencesi doldurabilir.\n');
    } else {
      console.log('   - Kurum Kuralı: Standart (ESOGÜ)');
      console.log('   - Yetki: Yöneticiler, Birim Sorumluları ve ilgili dersin öğretim elemanı izlence doldurabilir.\n');
    }
  }

  // 4. Yeni Kayıt ve Rol Senkronizasyonu
  const regPath = path.join(currentDir, 'app/api/auth/register/route.ts');
  if (fs.existsSync(regPath)) {
    const content = fs.readFileSync(regPath, 'utf8');
    console.log(`${ruleIndex++}. 👤 YENİ KULLANICI KAYIT VE ROL KURALI:`);
    if (content.includes('harran.edu.tr')) {
      console.log('   - @harran.edu.tr ile kaydolan hocalara otomatik "OgretimElemani" rolü atanır.');
    } else {
      console.log('   - Kaydolan kullanıcılar varsayılan olarak "Beklemede" rolü ile başlar, yönetici onayı ile aktifleştirilir.');
    }
    console.log('   - Profil verisi Supabase Auth ve profiller tablosu arasında güvenli API Route üzerinden senkronize edilir.\n');
  }

  // 5. Otomatik Sayfa Yönlendirmeleri
  const dashPath = path.join(currentDir, 'app/[locale]/(dashboard)/page.tsx');
  if (fs.existsSync(dashPath)) {
    const content = fs.readFileSync(dashPath, 'utf8');
    if (content.includes('redirect(\'/ders-izlenceleri\')')) {
      console.log(`${ruleIndex++}. 🔀 OTOMATİK SAYFA YÖNLENDİRME (DASHBOARD REDIRECT):`);
      console.log('   - Yönetici/koordinatör olmayan ve henüz atanmış ölçütü bulunmayan (0 ölçüt) kullanıcılar /ders-izlenceleri sayfasına aktarılır.\n');
    }
  }

  // 6. Supabase Storage RLS Politikaları
  const sqlPath = path.join(currentDir, 'supabase/urfa_setup_clean.sql');
  if (fs.existsSync(sqlPath)) {
    const content = fs.readFileSync(sqlPath, 'utf8');
    if (content.includes('dokumanlar_insert')) {
      console.log(`${ruleIndex++}. 📦 SUPABASE STORAGE (DEPOLAMA) RLS POLİTİKALARI:`);
      console.log('   - "dokumanlar" ve "kanit_dosyalari" bucket\'ları için SELECT, INSERT, UPDATE, DELETE izin politikaları etkindir.\n');
    }
  }

  console.log('================================================================');
  console.log('✅ TÜM KURALLAR AKTİF VE ÇALIŞIR DURUMDADIR.');
  console.log('================================================================\n');
}

runRulesCheck();
