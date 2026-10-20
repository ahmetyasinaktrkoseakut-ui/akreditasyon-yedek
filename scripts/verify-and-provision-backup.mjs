import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const EXPECTED_BACKUP_REF = 'mbdtjzxyctucrdlwdxsm';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

console.log('=== YEDEK PROJE VE DEPOLAMA GÜVENCE DOĞRULAMASI ===');
console.log('Taranan Supabase URL:', supabaseUrl);

// 1. Ek Güvence: Supabase Proje Kimliği ve Hostname Tam Eşleştirme Denetimi
let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch (e) {
  console.error('[HATA] Geçersiz NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl);
  process.exit(1);
}

const EXPECTED_BACKUP_HOST = `${EXPECTED_BACKUP_REF}.supabase.co`;
if (parsedUrl.hostname !== EXPECTED_BACKUP_HOST) {
  console.error(`\n[HATA - GÜVENLİK İHLALİ ENGELLENDİ]`);
  console.error(`Hedef Hostname (${parsedUrl.hostname}) beklenen yedek alan adı (${EXPECTED_BACKUP_HOST}) ile TAM EŞLEŞMİYOR!`);
  console.error(`Canlı veya başka bir veritabanına işlem yapılması kesinlikle engellendi.`);
  process.exit(1);
}

console.log(`[DOĞRULANDI] Supabase alan adı başarıyla yedek proje olarak teyit edildi: ${EXPECTED_BACKUP_HOST}`);

if (!serviceRoleKey) {
  console.error('[HATA] SUPABASE_SERVICE_ROLE_KEY .env.local içerisinde bulunamadı!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verifyAndProvision() {
  try {
    // 2. Storage Kovalarını Listele ve Denetle
    console.log('\n--- 1. Storage Kova Denetimi ---');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    if (bucketError) {
      console.error('[HATA] Bucket listeleme başarısız:', bucketError.message);
      process.exit(1);
    }

    console.log('Mevcut Kovalar:', buckets.map(b => `${b.id} (public: ${b.public})`).join(', '));

    let sinavBucket = buckets.find(b => b.id === 'sinav_arsivleri');
    if (!sinavBucket) {
      console.log('--> sinav_arsivleri kovası bulunamadı. Özel (private: false) olarak oluşturuluyor...');
      const { data: newBucket, error: createErr } = await supabase.storage.createBucket('sinav_arsivleri', {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/msword',
          'image/jpeg',
          'image/png'
        ]
      });
      if (createErr) {
        console.error('[HATA] sinav_arsivleri kovası oluşturulamadı:', createErr.message);
      } else {
        console.log('[BAŞARILI] sinav_arsivleri kovası başarıyla özel (private) olarak oluşturuldu.');
      }
    } else {
      if (sinavBucket.public) {
        console.log('--> sinav_arsivleri kovası açık (public) durumda! Güvenlik için private yapılıyor...');
        const { error: updateErr } = await supabase.storage.updateBucket('sinav_arsivleri', {
          public: false,
          fileSizeLimit: 52428800
        });
        if (updateErr) {
          console.error('[UYARI] Kova güncellenemedi:', updateErr.message);
        } else {
          console.log('[BAŞARILI] sinav_arsivleri kovası private (özel) olarak güncellendi.');
        }
      } else {
        console.log('[DOĞRULANDI] sinav_arsivleri kovası mevcut ve kesinlikle özel (public: false).');
      }
    }

    let hasFailure = false;

    // 3. Tablo ve Veritabanı Denetimi
    console.log('\n--- 2. ders_sinav_arsivi Tablo Denetimi ---');
    const { data: arsivRows, error: arsivErr } = await supabase
      .from('ders_sinav_arsivi')
      .select('id, ders_id, hoca_id, donem_id')
      .limit(3);

    if (arsivErr) {
      hasFailure = true;
      console.error('[EKSİK / HENÜZ UYGULANMADI] ders_sinav_arsivi tablosu veritabanında bulunamadı:', arsivErr.message);
      console.error('--> Not: Tablo SQL migration dosyası hazır (supabase/migrations/20261020_ders_sinav_arsivi.sql) fakat uzak Supabase veritabanına henüz execute edilmemiştir.');
    } else {
      console.log(`[DOĞRULANDI] ders_sinav_arsivi tablosu erişilebilir. Mevcut satır sayısı: ${arsivRows.length}`);
    }

    // 4. dosya_yetkilendirmeleri Denetimi
    console.log('\n--- 3. dosya_yetkilendirmeleri Tablo Denetimi ---');
    const { count, error: yetkiErr } = await supabase
      .from('dosya_yetkilendirmeleri')
      .select('id', { count: 'exact', head: true });

    if (yetkiErr) {
      hasFailure = true;
      console.error('[HATA] dosya_yetkilendirmeleri tablosu sorgulanamadı:', yetkiErr.message);
    } else {
      console.log(`[DOĞRULANDI] dosya_yetkilendirmeleri tablosu erişilebilir. Toplam kayıt: ${count}`);
    }

    if (hasFailure) {
      console.error('\n=== DOĞRULAMA TAMAMLANAMADI: EKSİK VERİTABANI TABLOLARI MEVCUT (EXIT CODE 1) ===');
      process.exit(1);
    }

    console.log('\n=== TÜM DOĞRULAMALAR BAŞARIYLA TAMAMLANDI ===');
  } catch (err) {
    console.error('Beklenmeyen doğrulama hatası:', err);
    process.exit(1);
  }
}

verifyAndProvision();
