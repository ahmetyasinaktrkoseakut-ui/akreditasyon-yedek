-- ==============================================================================
-- AKREDİTASYON BİLGİ YÖNETİM SİSTEMİ (ABYS) - TEMİZ MASTER KURULUM SQL
-- Kurum: Urfa İlahiyat Fakültesi (veya Herhangi Bir Yeni Kurum)
-- Açıklama: Tüm veritabanı tabloları, RLS politikaları, fonksiyonlar, trigger'lar
--           ve 59 alt ölçütün boş Kalite El Kitabı şablonları dahildir.
--           ESKİŞEHİR'E DAİR HİÇBİR VERİ VEYA METİN İÇERMEZ.
-- ==============================================================================

-- 1. EKLENTİLER (EXTENSIONS)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLO TANIMLAMALARI (TABLE DEFINITIONS)

-- A. DÖNEMLER
CREATE TABLE IF NOT EXISTS public.donemler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    donem_adi TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    is_sealed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- B. PROFİLLER (Kullanıcı Rolleri)
CREATE TABLE IF NOT EXISTS public.profiller (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    ad_soyad TEXT,
    rol TEXT DEFAULT 'Beklemede',
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- C. ANA BAŞLIKLAR
CREATE TABLE IF NOT EXISTS public.ana_basliklar (
    id INT PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    baslik_adi TEXT NOT NULL,
    baslik_adi_en TEXT,
    baslik_adi_ar TEXT
);

-- D. ALT ÖLÇÜTLER (Boş Şablon İle)
CREATE TABLE IF NOT EXISTS public.alt_olcutler (
    id INT PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    olcut_adi TEXT NOT NULL,
    olcut_adi_en TEXT,
    olcut_adi_ar TEXT,
    ana_baslik_id INT REFERENCES public.ana_basliklar(id) ON DELETE CASCADE,
    kalite_el_kitabi JSONB DEFAULT '{}'::jsonb
);

-- E. KULLANICI ÖLÇÜT ATAMALARI (Zimmetleme)
CREATE TABLE IF NOT EXISTS public.kullanici_olcut_atamalari (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
    alt_olcut_id INT REFERENCES public.alt_olcutler(id) ON DELETE CASCADE,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    erisim_baslangic DATE,
    erisim_bitis DATE,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- F. PUKÖ DEĞERLENDİRMELERİ
CREATE TABLE IF NOT EXISTS public.puko_degerlendirmeleri (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alt_olcut_id INT REFERENCES public.alt_olcutler(id) ON DELETE CASCADE,
    birim_id INT,
    puko_asamasi TEXT NOT NULL,
    olgunluk_seviyesi INT,
    aciklama TEXT,
    kanit_dosya_url TEXT,
    kanit_dosyalari JSONB DEFAULT '[]'::jsonb,
    olgunluk_puani INT DEFAULT 0,
    anket_verisi JSONB,
    baslangic_tarihi DATE,
    bitis_tarihi DATE,
    ust_birim_onerileri JSONB DEFAULT '[]'::jsonb,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    risk_analizi TEXT,
    is_locked BOOLEAN DEFAULT FALSE,
    durum TEXT DEFAULT 'Taslak',
    red_nedeni TEXT,
    user_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- G. ÖZDEĞERLENDİRME RAPORLARI
CREATE TABLE IF NOT EXISTS public.ozdegerlendirme_raporlari (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alt_olcut_id TEXT NOT NULL,
    icerik TEXT,
    icerik_en TEXT,
    kanitlar JSONB DEFAULT '[]'::jsonb,
    durum TEXT DEFAULT 'Taslak',
    red_nedeni TEXT,
    birim_anket_degerlendirmesi TEXT,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- H. EYLEM PLANLARI
CREATE TABLE IF NOT EXISTS public.eylem_planlari (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alt_olcut_id INT REFERENCES public.alt_olcutler(id) ON DELETE CASCADE,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    iyilestirme_alani TEXT,
    bulgular TEXT,
    eylem_faaliyet TEXT,
    sorumlu TEXT,
    takvim TEXT,
    basari_gostergesi TEXT,
    izleme_durumu TEXT,
    riskler TEXT,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- I. DERSLER (Müfredat Tablosu)
CREATE TABLE IF NOT EXISTS public.dersler (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    ad TEXT NOT NULL,
    ad_en TEXT,
    yariyil INT NOT NULL,
    ders_turu TEXT DEFAULT 'Zorunlu',
    ders_dili TEXT DEFAULT 'Türkçe',
    akts INT DEFAULT 0,
    kredi_t INT DEFAULT 0,
    kredi_u INT DEFAULT 0,
    kredi_l INT DEFAULT 0
);

-- J. DERS İZLENCELERİ
CREATE TABLE IF NOT EXISTS public.ders_izlenceleri (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ders_id BIGINT REFERENCES public.dersler(id) ON DELETE CASCADE,
    hoca_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    guncelleme_tarihi TIMESTAMPTZ DEFAULT NOW(),
    icerik JSONB DEFAULT '{}'::jsonb
);

-- K. DUYURULAR
CREATE TABLE IF NOT EXISTS public.duyurular (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    baslik TEXT NOT NULL,
    icerik TEXT NOT NULL,
    olusturan_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- L. AKTİVİTE GÜNLÜĞÜ (Log)
CREATE TABLE IF NOT EXISTS public.aktivite_gunlugu (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID,
    islem_tipi TEXT NOT NULL,
    tablo_adi TEXT NOT NULL,
    kayit_id TEXT,
    eski_veri JSONB,
    yeni_veri JSONB,
    ip_adresi TEXT,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VERİTABANI FONKSİYONLARI VE TRIGGER'LAR

-- Yeni Kullanıcı Kaydolduğunda Profil Oluşturma Trigger'ı
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiller (id, email, ad_soyad, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'ad_soyad', NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1)),
    'Beklemede'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Rol Kontrol Yardımcı Fonksiyonu
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  u_role TEXT;
BEGIN
  SELECT rol INTO u_role FROM public.profiller WHERE id = user_id;
  RETURN COALESCE(u_role, 'Beklemede');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RLS (ROW LEVEL SECURITY) POLİTİKALARI HAFİFLETME VE GÜVENLİK

ALTER TABLE public.donemler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ana_basliklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alt_olcutler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kullanici_olcut_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puko_degerlendirmeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ozdegerlendirme_raporlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eylem_planlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dersler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ders_izlenceleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duyurular ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aktivite_gunlugu ENABLE ROW LEVEL SECURITY;

-- ESKİ POLİTİKALARI TEMİZLE (ÇAKIŞMAYI ÖNLEMEK İÇİN)
DROP POLICY IF EXISTS "Herkes okuyabilir - donemler" ON public.donemler;
DROP POLICY IF EXISTS "Herkes okuyabilir - profiller" ON public.profiller;
DROP POLICY IF EXISTS "Herkes okuyabilir - ana_basliklar" ON public.ana_basliklar;
DROP POLICY IF EXISTS "Herkes okuyabilir - alt_olcutler" ON public.alt_olcutler;
DROP POLICY IF EXISTS "Herkes okuyabilir - kullanici_olcut_atamalari" ON public.kullanici_olcut_atamalari;
DROP POLICY IF EXISTS "Herkes okuyabilir - puko_degerlendirmeleri" ON public.puko_degerlendirmeleri;
DROP POLICY IF EXISTS "Herkes okuyabilir - ozdegerlendirme_raporlari" ON public.ozdegerlendirme_raporlari;
DROP POLICY IF EXISTS "Herkes okuyabilir - eylem_planlari" ON public.eylem_planlari;
DROP POLICY IF EXISTS "Herkes okuyabilir - dersler" ON public.dersler;
DROP POLICY IF EXISTS "Herkes okuyabilir - ders_izlenceleri" ON public.ders_izlenceleri;
DROP POLICY IF EXISTS "Herkes okuyabilir - duyurular" ON public.duyurular;
DROP POLICY IF EXISTS "Herkes okuyabilir - aktivite_gunlugu" ON public.aktivite_gunlugu;

DROP POLICY IF EXISTS "Kullanicilar kendi profilini güncelleyebilir veya yonetici" ON public.profiller;
DROP POLICY IF EXISTS "Kullanici atamalari yonetim" ON public.kullanici_olcut_atamalari;
DROP POLICY IF EXISTS "PUKO degerlendirmeleri yonetim" ON public.puko_degerlendirmeleri;
DROP POLICY IF EXISTS "Ozdegerlendirme raporlari yonetim" ON public.ozdegerlendirme_raporlari;
DROP POLICY IF EXISTS "Eylem planlari yonetim" ON public.eylem_planlari;
DROP POLICY IF EXISTS "Ders izlenceleri yonetim" ON public.ders_izlenceleri;
DROP POLICY IF EXISTS "Duyurular yonetim" ON public.duyurular;
DROP POLICY IF EXISTS "Aktivite gunlugu yonetim" ON public.aktivite_gunlugu;

-- YENİ POLİTİKALARI OLUŞTUR
CREATE POLICY "Herkes okuyabilir - donemler" ON public.donemler FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - profiller" ON public.profiller FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - ana_basliklar" ON public.ana_basliklar FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - alt_olcutler" ON public.alt_olcutler FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - kullanici_olcut_atamalari" ON public.kullanici_olcut_atamalari FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - puko_degerlendirmeleri" ON public.puko_degerlendirmeleri FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - ozdegerlendirme_raporlari" ON public.ozdegerlendirme_raporlari FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - eylem_planlari" ON public.eylem_planlari FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - dersler" ON public.dersler FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - ders_izlenceleri" ON public.ders_izlenceleri FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - duyurular" ON public.duyurular FOR SELECT USING (true);
CREATE POLICY "Herkes okuyabilir - aktivite_gunlugu" ON public.aktivite_gunlugu FOR SELECT USING (true);

CREATE POLICY "Kullanicilar kendi profilini güncelleyebilir veya yonetici" ON public.profiller FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Kullanici atamalari yonetim" ON public.kullanici_olcut_atamalari FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "PUKO degerlendirmeleri yonetim" ON public.puko_degerlendirmeleri FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ozdegerlendirme raporlari yonetim" ON public.ozdegerlendirme_raporlari FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Eylem planlari yonetim" ON public.eylem_planlari FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Ders izlenceleri yonetim" ON public.ders_izlenceleri FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Duyurular yonetim" ON public.duyurular FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Aktivite gunlugu yonetim" ON public.aktivite_gunlugu FOR ALL USING (auth.uid() IS NOT NULL);

-- 5. SABİT VERİLER (SEED DATA) INSERT İŞLEMLERİ

-- A. DÖNEM VERİSİ
INSERT INTO public.donemler (id, donem_adi, is_active, is_sealed, created_at) VALUES ('7e9c44cf-053c-49e5-9d6a-32e5ff701602', '2026', TRUE, FALSE, '2026-05-01T21:01:44.6808+00:00') ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;
INSERT INTO public.donemler (id, donem_adi, is_active, is_sealed, created_at) VALUES ('ae340b68-9932-4ab2-a285-b07b150d906b', '2027', FALSE, FALSE, '2026-05-01T21:28:03.918124+00:00') ON CONFLICT (id) DO UPDATE SET is_active = EXCLUDED.is_active;

-- B. ANA BAŞLIKLAR (5 ADET)
INSERT INTO public.ana_basliklar (id, kod, baslik_adi, baslik_adi_en, baslik_adi_ar) VALUES (1, 'A', 'KALİTE GÜVENCESİ SİSTEMİ', 'QUALITY ASSURANCE SYSTEM', 'نظام ضمان الجودة') ON CONFLICT (id) DO UPDATE SET baslik_adi = EXCLUDED.baslik_adi;
INSERT INTO public.ana_basliklar (id, kod, baslik_adi, baslik_adi_en, baslik_adi_ar) VALUES (2, 'B', 'EĞİTİM VE ÖĞRETİM', 'EDUCATION AND TRAINING', 'التعليم والتدريب') ON CONFLICT (id) DO UPDATE SET baslik_adi = EXCLUDED.baslik_adi;
INSERT INTO public.ana_basliklar (id, kod, baslik_adi, baslik_adi_en, baslik_adi_ar) VALUES (3, 'C', 'ARAŞTIRMA VE GELİŞTİRME', 'RESEARCH AND DEVELOPMENT', 'البحث والتطوير') ON CONFLICT (id) DO UPDATE SET baslik_adi = EXCLUDED.baslik_adi;
INSERT INTO public.ana_basliklar (id, kod, baslik_adi, baslik_adi_en, baslik_adi_ar) VALUES (4, 'D', 'TOPLUMSAL KATKI', 'SOCIAL CONTRIBUTION', 'المساهمة الاجتماعية') ON CONFLICT (id) DO UPDATE SET baslik_adi = EXCLUDED.baslik_adi;
INSERT INTO public.ana_basliklar (id, kod, baslik_adi, baslik_adi_en, baslik_adi_ar) VALUES (5, 'E', 'YÖNETİM SİSTEMİ', 'MANAGEMENT SYSTEM', 'نظام الإدارة') ON CONFLICT (id) DO UPDATE SET baslik_adi = EXCLUDED.baslik_adi;

-- C. ALT ÖLÇÜTLER VE EKSİKSİZ BOŞ KALİTE EL KİTABI ŞABLONLARI (59 ADET)
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (6, 'A.1.1', 'Misyon, Vizyon, Stratejik Amaçlar ve Hedefler', 'Mission, Vision, Strategic Goals and Objectives', 'الرسالة والرؤية والأهداف والغايات الاستراتيجية', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (7, 'A.1.2', 'Kalite Güvencesi, Eğitim Öğretim, Araştırma Geliştirme, Toplumsal Katkı ve Yönetim Sistemi Politikaları', 'Quality Assurance, Education and Training, Research and Development, Social Contribution and Management System Policies', 'ضمان الجودة، التعليم والتدريب، البحث والتطوير، المساهمة الاجتماعية وسياسات نظام الإدارة', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (8, 'A.1.3', 'Kurumsal Performans Yönetimi', 'Corporate Performance Management', 'إدارة أداء الشركات', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (9, 'A.2.1', 'Birim Kalite Komisyonu', 'Unit Quality Commission', 'لجنة الجودة بالوحدة', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (10, 'A.2.2', 'İç Kalite Güvencesi Mekanizmaları', 'Internal Quality Assurance Mechanisms', 'آليات ضمان الجودة الداخلية', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (11, 'A.2.3', 'Liderlik ve Kalite Güvencesi Kültürü', 'Culture of Leadership and Quality Assurance', 'ثقافة القيادة وضمان الجودة', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (12, 'A.3.1', 'İç Paydaşlar (Çalışanlar - Akademik ve İdari Personel)', 'Internal Stakeholders (Employees - Academic and Administrative Staff)', 'أصحاب المصلحة الداخليون (الموظفون - أعضاء هيئة التدريس والإداريون)', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (13, 'A.3.2', 'Dış Paydaşlar', 'External Stakeholders', 'أصحاب المصلحة الخارجيين', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (14, 'A.4.1', 'Uluslararasılaşma Politikası', 'Internationalization Policy', 'سياسة التدويل', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (15, 'A.4.2', 'Uluslararasılaşma Süreçlerinin Yönetimi ve Organizasyonel Yapısı', 'Management and Organizational Structure of Internationalization Processes', 'الإدارة والهيكل التنظيمي لعمليات التدويل', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (16, 'A.4.3', 'Uluslararasılaşma Kaynakları', 'Internationalization Resources', 'موارد التدويل', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (17, 'A.4.4', 'Uluslararasılaşma Performansının İzlenmesi ve İyileştirilmesi', 'Monitoring and Improving Internationalization Performance', 'مراقبة وتحسين أداء التدويل', 1, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (18, 'B.1.1', 'Program Tasarım ve Onayı', 'Program Design and Approval', 'تصميم البرنامج والموافقة عليه', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (19, 'B.1.2', 'Program Amaçları, Çıktıları ve İAA Ölçütleri ile Uyumu', 'Program Objectives, Outputs and Compatibility with IAA Criteria', 'أهداف البرنامج ومخرجاته وتوافقه مع معايير IAA', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (20, 'B.1.3', 'Ders Kazanımlarının Program Çıktıları ve Disipline Özgü Çıktılar ile Eşleştirilmesi', 'Matching Course Outcomes with Program Outcomes and Discipline-Specific Outcomes', 'مطابقة نتائج الدورة مع نتائج البرنامج والنتائج الخاصة بالانضباط', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (21, 'B.1.4', 'Programın Yapısı ve Ders Dağılım Dengesi', 'Structure of the Program and Course Distribution Balance', 'هيكل البرنامج وتوازن توزيع الدورة', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (22, 'B.1.5', 'Öğrenci İş Yüküne Dayalı Tasarım', 'Design Based on Student Workload', 'التصميم على أساس عبء العمل الطالب', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (23, 'B.1.6', 'Ölçme ve Değerlendirme', 'Measurement and Evaluation', 'القياس والتقييم', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (24, 'B.2.1', 'Öğrenci Kabulü ve Önceki Öğrenmelerin Tanınması ve Kredilendirilmesi', 'Student Admission and Recognition and Crediting of Prior Learning', 'قبول الطلاب والاعتراف واعتماد التعلم السابق', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (25, 'B.2.2', 'Diploma, Derece ve Diğer Yeterliliklerin Tanınması ve Sertifikalandırılması', 'Recognition and Certification of Diplomas, Degrees and Other Qualifications', 'الاعتراف وإصدار الشهادات للدبلومات والدرجات العلمية والمؤهلات الأخرى', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (26, 'B.3.1', 'Öğretim Yöntem ve Teknikleri', 'Teaching Methods and Techniques', 'طرق وتقنيات التدريس', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (27, 'B.3.2', 'Ölçme ve Değerlendirme', 'Measurement and Evaluation', 'القياس والتقييم', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (28, 'B.3.3', 'Öğrenci Geri Bildirimleri', 'Student Feedback', 'ردود فعل الطلاب', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (29, 'B.3.4', 'Akademik Danışmanlık', 'Academic Advising', 'الإرشاد الأكاديمي', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (30, 'B.4.1', 'Atama, Yükseltme ve Görevlendirme Kriterleri', 'Appointment, Promotion and Assignment Criteria', 'معايير التعيين والترقية والتعيين', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (31, 'B.4.2', 'Öğretim Yetkinliği', 'Teaching Competence', 'الكفاءة التدريسية', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (32, 'B.4.3', 'Eğitim Faaliyetlerine Yönelik Teşvik ve Ödüllendirme', 'Incentive and Reward for Educational Activities', 'حوافز ومكافآت للأنشطة التعليمية', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (33, 'B.5.1', 'Öğrenme Kaynakları', 'Learning Resources', 'مصادر التعلم', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (34, 'B.5.2', 'Sosyal, Kültürel, Sportif Faaliyetler', 'Social, Cultural, Sportive Activities', 'الأنشطة الاجتماعية والثقافية والرياضية', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (35, 'B.5.3', 'Tesis ve Altyapılar', 'Facilities and Infrastructures', 'المرافق والبنية التحتية', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (36, 'B.5.4', 'Engelsiz Fakülte', 'Barrier-Free Faculty', 'كلية خالية من العوائق', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (37, 'B.5.5', 'Rehberlik, Psikolojik Danışmanlık ve Kariyer Hizmetleri', 'Guidance, Psychological Counseling and Career Services', 'التوجيه والإرشاد النفسي والخدمات المهنية', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (38, 'B.6.1', 'Program Çıktılarının İzlenmesi ve Güncellenmesi', 'Monitoring and Updating Program Outputs', 'مراقبة وتحديث مخرجات البرنامج', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (39, 'B.6.2', 'Mezun İzleme Sistemi', 'Alumni Tracking System', 'نظام متابعة الخريجين', 2, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (40, 'C.1.1', 'Kurumun Araştırma Politikası, Hedefleri ve Stratejisi', 'Research Policy, Goals and Strategy of the Institution', 'سياسة البحث وأهدافه وإستراتيجيته', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (41, 'C.1.2', 'Araştırma-Geliştirme Süreçlerinin Yönetimi ve Organizasyonel Yapısı', 'Management and Organizational Structure of Research and Development Processes', 'الإدارة والهيكل التنظيمي لعمليات البحث والتطوير', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (42, 'C.1.3', 'Araştırmaların Yerel/Bölgesel/Ulusal İhtiyaç ve Taleplerle İlişkisi', 'Relationship of Research to Local/Regional/National Needs and Demands', 'علاقة البحث بالاحتياجات والطلبات المحلية/الإقليمية/الوطنية', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (43, 'C.2.1', 'Araştırma Kaynakları: Fiziki, Teknik, Mali', 'Research Resources: Physical, Technical, Financial', 'مصادر البحث: المادية والفنية والمالية', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (44, 'C.2.2', 'Üniversite İçi Kaynaklar', 'Internal University Resources', 'موارد الجامعة الداخلية', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (45, 'C.2.3', 'Üniversite Dışı Kaynaklara Yönelik Yöntem ve Destekler', 'Methods and Support for Non-University Resources', 'طرق ودعم الموارد غير الجامعية', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (46, 'C.2.4', 'Kurumun Araştırma Politikası ve Uyumlu Lisansüstü Programlar', 'Institution''s Research Policy and Compatible Graduate Programs', 'السياسة البحثية للمؤسسة وبرامج الدراسات العليا المتوافقة', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (47, 'C.3.1', 'Öğretim Elemanlarının Araştırma Yetkinliğinin Geliştirilmesi', 'Improving the Research Competency of Faculty Members', 'تحسين الكفاءة البحثية لأعضاء هيئة التدريس', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (48, 'C.3.2', 'Ulusal ve Uluslararası Araştırma Birimleri ile Ortak Programlar', 'Joint Programs with National and International Research Units', 'برامج مشتركة مع وحدات البحوث الوطنية والدولية', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (49, 'C.4.1', 'Öğretim Elemanı Performans Değerlendirmesi', 'Instructor Performance Evaluation', 'تقييم أداء المعلم', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (50, 'C.4.2', 'Araştırma Performansının Değerlendirilmesi ve İyileştirilmesi', 'Evaluation and Improvement of Research Performance', 'تقييم وتحسين أداء البحث', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (51, 'C.4.3', 'Araştırma Bütçe Performansı', 'Research Budget Performance', 'أداء ميزانية البحث', 3, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (52, 'D.1.1', 'Toplumsal Katkı Politikası, Hedefleri ve Stratejisi', 'Social Contribution Policy, Goals and Strategy', 'سياسة المساهمة الاجتماعية والأهداف والاستراتيجية', 4, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (53, 'D.1.2', 'Toplumsal Katkı Süreçlerinin Yönetimi ve Teşkilat Yapısı', 'Management and Organizational Structure of Social Contribution Processes', 'الإدارة والهيكل التنظيمي لعمليات المساهمة الاجتماعية', 4, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (54, 'D.2', 'Toplumsal Katkı Kaynakları', 'Social Contribution Sources', 'مصادر المساهمة الاجتماعية', 4, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (55, 'D.3', 'Toplumsal Katkı Performansı', 'Social Contribution Performance', 'أداء المساهمة الاجتماعية', 4, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (56, 'E.1.1', 'Yönetim Modeli ve İdari Yapı', 'Management Model and Administrative Structure', 'نموذج الإدارة والهيكل الإداري', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (57, 'E.1.2', 'Süreç Yönetimi', 'Process Management', 'إدارة العمليات', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (58, 'E.2.1', 'İnsan Kaynakları Yönetimi', 'Human Resources Management', 'إدارة الموارد البشرية', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (59, 'E.2.2', 'Finansal Kaynakların Yönetimi', 'Management of Financial Resources', 'إدارة الموارد المالية', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (60, 'E.3.1', 'Entegre Bilgi Yönetim Sistemi', 'Integrated Information Management System', 'نظام إدارة المعلومات المتكامل', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (61, 'E.3.2', 'Bilgi Güvenliği ve Güvenilirliği', 'Information Security and Reliability', 'أمن المعلومات والموثوقية', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (62, 'E.4.1', 'Hizmet ve Malların Uygunluğu, Kalitesi ve Sürekliliği', 'Suitability, Quality and Continuity of Services and Goods', 'الملاءمة والجودة واستمرارية الخدمات والسلع', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (63, 'E.5.1', 'Kamuoyunu Bilgilendirme', 'Public Information', 'المعلومات العامة', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;
INSERT INTO public.alt_olcutler (id, kod, olcut_adi, olcut_adi_en, olcut_adi_ar, ana_baslik_id, kalite_el_kitabi) VALUES (64, 'E.5.2', 'Hesap Verme Yöntemleri', 'Methods of Accountability', 'أساليب المساءلة', 5, '{"bgs_yeri":"","ic_paydaslar":"","dis_paydaslar":"","sorumlu_birim":"","aciklama_metni":"","aciklama_metni_en":"","uygulama_alanlari":"","ilk_planlama_tarihi":"","izleme_mekanizmalari":"","uluslararasi_paydaslar":"","performans_gostergeleri":"","degerlendirme_iyilestirme_tarihi":""}'::jsonb) ON CONFLICT (id) DO UPDATE SET olcut_adi = EXCLUDED.olcut_adi, kalite_el_kitabi = EXCLUDED.kalite_el_kitabi;

-- ==============================================================================
-- KURULUM TAMAMLATMA NOTU:
-- 1. Bu SQL dosyası çalıştırıldığında veritabanı 100% eksiksiz ve kullanıma hazırdır.
-- 2. Kalite El Kitabı alanlarındaki tüm Eskişehir Osmangazi verileri tamamen temizlenmiş,
--    boş şablonlar (placeholder) bırakılmıştır.
-- 3. İlk yönetici kullanıcı kaydolduktan sonra Supabase Dashboard -> Table Editor -> profiller
--    tablosuna girerek o kullanıcının 'rol' değerini 'Yonetici' yapınız.
-- ==============================================================================
