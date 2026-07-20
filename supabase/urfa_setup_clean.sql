-- ==============================================================================
-- AKREDİTASYON BİLGİ YÖNETİM SİSTEMİ (ABYS) - TEMİZ MASTER KURULUM SQL
-- Kurum: Urfa İlahiyat Fakültesi (veya Herhangi Bir Yeni Kurum)
-- Açıklama: Tüm veritabanı tabloları, RLS politikaları, fonksiyonlar, trigger'lar
--           ve 59 alt ölçütün boş Kalite El Kitabı şablonları dahildir.
--           ESKİŞEHİR'E DAİR HİÇBİR KULLANICI VERİSİ VEYA RAPOR METNİ İÇERMEZ.
--           BU SQL DOSYASI RECURSION-FREE (SONSUZ DÖNGÜSÜZ) RLS POLİTİKALARINI KURAR.
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

-- C. BİRİMLER (Bölümler)
CREATE TABLE IF NOT EXISTS public.birimler (
    id INT PRIMARY KEY,
    birim_adi VARCHAR(255) NOT NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- D. ANA BAŞLIKLAR
CREATE TABLE IF NOT EXISTS public.ana_basliklar (
    id INT PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    baslik_adi TEXT NOT NULL,
    baslik_adi_en TEXT,
    baslik_adi_ar TEXT
);

-- E. ALT ÖLÇÜTLER (Boş Şablon İle)
CREATE TABLE IF NOT EXISTS public.alt_olcutler (
    id INT PRIMARY KEY,
    kod TEXT UNIQUE NOT NULL,
    olcut_adi TEXT NOT NULL,
    olcut_adi_en TEXT,
    olcut_adi_ar TEXT,
    ana_baslik_id INT REFERENCES public.ana_basliklar(id) ON DELETE CASCADE,
    kalite_el_kitabi JSONB DEFAULT '{}'::jsonb
);

-- F. KULLANICI ÖLÇÜT ATAMALARI (Zimmetleme)
CREATE TABLE IF NOT EXISTS public.kullanici_olcut_atamalari (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
    alt_olcut_id INT REFERENCES public.alt_olcutler(id) ON DELETE CASCADE,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    erisim_baslangic DATE,
    erisim_bitis DATE,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- G. BAŞLIK KOORDİNATÖRLERİ
CREATE TABLE IF NOT EXISTS public.baslik_koordinatorleri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kullanici_id UUID NOT NULL REFERENCES public.profiller(id) ON DELETE CASCADE,
    baslik TEXT NOT NULL,
    atanma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- H. PUKÖ DEĞERLENDİRMELERİ
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

-- I. ÖZDEĞERLENDİRME RAPORLARI
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

-- J. EYLEM PLANLARI
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

-- K. DERSLER (Müfredat Tablosu)
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

-- L. DERS İZLENCELERİ
CREATE TABLE IF NOT EXISTS public.ders_izlenceleri (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ders_id BIGINT REFERENCES public.dersler(id) ON DELETE CASCADE,
    hoca_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    guncelleme_tarihi TIMESTAMPTZ DEFAULT NOW(),
    icerik JSONB DEFAULT '{}'::jsonb
);

-- M. DUYURULAR
CREATE TABLE IF NOT EXISTS public.duyurular (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baslik TEXT NOT NULL,
    icerik TEXT NOT NULL,
    olusturan_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- N. DUYURU OKUMALAR
CREATE TABLE IF NOT EXISTS public.duyuru_okumalar (
    duyuru_id UUID REFERENCES public.duyurular(id) ON DELETE CASCADE,
    kullanici_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
    okunma_tarihi TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (duyuru_id, kullanici_id)
);

-- O. ANKETLER (Soru Formları)
CREATE TABLE IF NOT EXISTS public.anketler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alt_olcut_id TEXT,
    baslik TEXT NOT NULL,
    sorular JSONB NOT NULL,
    olusturan_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW(),
    aciklama TEXT,
    donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
    hedef_olcutler JSONB
);

-- P. ANKET CEVAPLARI (Yanıtlar)
CREATE TABLE IF NOT EXISTS public.anket_cevaplari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anket_id UUID REFERENCES public.anketler(id) ON DELETE CASCADE,
    cevaplar JSONB NOT NULL,
    katilim_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- R. BİLDİRİMLER
CREATE TABLE IF NOT EXISTS public.bildirimler (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gonderen_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    alici_id UUID REFERENCES public.profiller(id) ON DELETE CASCADE,
    mesaj TEXT NOT NULL,
    tip VARCHAR(255) NOT NULL,
    ilgili_kayit_id BIGINT,
    okundu BOOLEAN DEFAULT FALSE,
    olusturulma_tarihi TIMESTAMPTZ DEFAULT NOW()
);

-- S. SİSTEM İŞLEM LOGLARI (Log)
CREATE TABLE IF NOT EXISTS public.system_islem_loglari (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiller(id) ON DELETE SET NULL,
    islem_tipi TEXT NOT NULL,
    tablo_adi TEXT NOT NULL,
    kayit_id TEXT,
    eski_veri JSONB,
    yeni_veri JSONB,
    tarih TIMESTAMPTZ DEFAULT NOW()
);

-- 3. YETKİLENDİRİLMİŞ RPC FONKSİYONLARI (NEXT.JS KULLANIMI İÇİN)

-- Rol Kontrol Yardımcı Fonksiyonu (SECURITY DEFINER - RLS Bypass Eder)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  u_role TEXT;
BEGIN
  SELECT rol INTO u_role FROM public.profiller WHERE id = user_id;
  RETURN COALESCE(u_role, 'Beklemede');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rpc_v3_assign_all_olcutler(
  p_user_id UUID,
  p_donem_id UUID,
  p_olcut_ids INT[]
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama yapma yetkiniz yok.';
  END IF;

  DELETE FROM public.kullanici_olcut_atamalari WHERE user_id = p_user_id AND donem_id = p_donem_id;

  IF p_olcut_ids IS NOT NULL AND array_length(p_olcut_ids, 1) > 0 THEN
    INSERT INTO public.kullanici_olcut_atamalari (user_id, donem_id, alt_olcut_id)
    SELECT p_user_id, p_donem_id, unnest(p_olcut_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rpc_v3_sync_birim_atamalari(
  p_user_id UUID,
  p_donem_id UUID,
  p_scope_olcut_ids INT[],
  p_selected_olcut_ids INT[]
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Atama yetkiniz yok.';
  END IF;

  DELETE FROM public.kullanici_olcut_atamalari WHERE user_id = p_user_id AND donem_id = p_donem_id AND alt_olcut_id = ANY(p_scope_olcut_ids);
  DELETE FROM public.kullanici_olcut_atamalari WHERE donem_id = p_donem_id AND alt_olcut_id = ANY(p_selected_olcut_ids) AND user_id != p_user_id;

  IF p_selected_olcut_ids IS NOT NULL AND array_length(p_selected_olcut_ids, 1) > 0 THEN
    INSERT INTO public.kullanici_olcut_atamalari (user_id, donem_id, alt_olcut_id)
    SELECT p_user_id, p_donem_id, unnest(p_selected_olcut_ids);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.rpc_v3_assign_koordinator(
  p_user_id UUID,
  p_baslik TEXT
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiller WHERE id = auth.uid() AND (rol ILIKE '%admin%' OR rol ILIKE '%yönetici%' OR rol ILIKE '%yonetici%')) THEN
    RAISE EXCEPTION 'Unauthorized: Koordinatör atama yetkiniz yok.';
  END IF;

  DELETE FROM public.baslik_koordinatorleri WHERE kullanici_id = p_user_id;
  INSERT INTO public.baslik_koordinatorleri (kullanici_id, baslik) VALUES (p_user_id, p_baslik);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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

-- 4. RLS (ROW LEVEL SECURITY) ETKİNLEŞTİRME VE POLİTİKALARI (SONSUZ DÖNGÜ ENGELLEMELİ)

ALTER TABLE public.donemler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiller ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.birimler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ana_basliklar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alt_olcutler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kullanici_olcut_atamalari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.baslik_koordinatorleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.puko_degerlendirmeleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ozdegerlendirme_raporlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eylem_planlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dersler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ders_izlenceleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duyurular ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duyuru_okumalar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anketler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anket_cevaplari ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bildirimler ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_islem_loglari ENABLE ROW LEVEL SECURITY;

-- ESKİ POLİTİKALARI TEMİZLE (ÇAKIŞMAYI ÖNLEMEK İÇİN)
DROP POLICY IF EXISTS "profiller_read_all" ON public.profiller;
DROP POLICY IF EXISTS "profiller_update_own" ON public.profiller;
DROP POLICY IF EXISTS "profiller_admin_all" ON public.profiller;

DROP POLICY IF EXISTS "donemler_read_all" ON public.donemler;
DROP POLICY IF EXISTS "donemler_admin_all" ON public.donemler;

DROP POLICY IF EXISTS "birimler_read_all" ON public.birimler;
DROP POLICY IF EXISTS "birimler_admin_all" ON public.birimler;

DROP POLICY IF EXISTS "system_islem_loglari_read" ON public.system_islem_loglari;
DROP POLICY IF EXISTS "system_islem_loglari_insert" ON public.system_islem_loglari;

DROP POLICY IF EXISTS "duyurular_read_all" ON public.duyurular;
DROP POLICY IF EXISTS "duyurular_admin_all" ON public.duyurular;

DROP POLICY IF EXISTS "anketler_read_all" ON public.anketler;
DROP POLICY IF EXISTS "anketler_manage_assigned" ON public.anketler;

DROP POLICY IF EXISTS "anket_cevaplari_insert" ON public.anket_cevaplari;
DROP POLICY IF EXISTS "anket_cevaplari_read_assigned" ON public.anket_cevaplari;

DROP POLICY IF EXISTS "ana_basliklar_read" ON public.ana_basliklar;
DROP POLICY IF EXISTS "alt_olcutler_read" ON public.alt_olcutler;
DROP POLICY IF EXISTS "ana_basliklar_admin" ON public.ana_basliklar;
DROP POLICY IF EXISTS "alt_olcutler_update_assigned" ON public.alt_olcutler;
DROP POLICY IF EXISTS "alt_olcutler_admin_insert_delete" ON public.alt_olcutler;

DROP POLICY IF EXISTS "Users can view own assignments" ON public.kullanici_olcut_atamalari;
DROP POLICY IF EXISTS "Admins can modify assignments" ON public.kullanici_olcut_atamalari;

DROP POLICY IF EXISTS "Viewable by all" ON public.baslik_koordinatorleri;
DROP POLICY IF EXISTS "Only admins can modify coordinators" ON public.baslik_koordinatorleri;

DROP POLICY IF EXISTS "puko_degerlendirmeleri_read_secure" ON public.puko_degerlendirmeleri;
DROP POLICY IF EXISTS "Users can manage assigned evaluations" ON public.puko_degerlendirmeleri;

DROP POLICY IF EXISTS "ozdegerlendirme_raporlari_read_secure" ON public.ozdegerlendirme_raporlari;
DROP POLICY IF EXISTS "Users can manage assigned reports" ON public.ozdegerlendirme_raporlari;

DROP POLICY IF EXISTS "eylem_planlari_read_all" ON public.eylem_planlari;
DROP POLICY IF EXISTS "eylem_planlari_all" ON public.eylem_planlari;

DROP POLICY IF EXISTS "dersler_read_all" ON public.dersler;
DROP POLICY IF EXISTS "izlenceler_read_all" ON public.ders_izlenceleri;
DROP POLICY IF EXISTS "izlenceler_all_own" ON public.ders_izlenceleri;

DROP POLICY IF EXISTS "duyuru_okumalar_all" ON public.duyuru_okumalar;
DROP POLICY IF EXISTS "bildirimler_all" ON public.bildirimler;

-- YENİ RECURSION-FREE RLS POLİTİKALARINI OLUŞTUR

-- profiller
CREATE POLICY "profiller_read_all" ON public.profiller FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiller_update_own" ON public.profiller FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiller_admin_all" ON public.profiller FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- donemler
CREATE POLICY "donemler_read_all" ON public.donemler FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "donemler_admin_all" ON public.donemler FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- birimler
CREATE POLICY "birimler_read_all" ON public.birimler FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "birimler_admin_all" ON public.birimler FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- system_islem_loglari
CREATE POLICY "system_islem_loglari_read" ON public.system_islem_loglari FOR SELECT USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']) OR EXISTS (SELECT 1 FROM public.baslik_koordinatorleri WHERE kullanici_id = auth.uid()));
CREATE POLICY "system_islem_loglari_insert" ON public.system_islem_loglari FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- duyurular
CREATE POLICY "duyurular_read_all" ON public.duyurular FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "duyurular_admin_all" ON public.duyurular FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- duyuru_okumalar
CREATE POLICY "duyuru_okumalar_all" ON public.duyuru_okumalar FOR ALL USING (auth.role() = 'authenticated');

-- anketler
CREATE POLICY "anketler_read_all" ON public.anketler FOR SELECT USING (true);
CREATE POLICY "anketler_manage_assigned" ON public.anketler FOR ALL USING (EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.anketler.alt_olcut_id::integer AND ka.user_id = auth.uid()) OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- anket_cevaplari
CREATE POLICY "anket_cevaplari_insert" ON public.anket_cevaplari FOR INSERT WITH CHECK (true);
CREATE POLICY "anket_cevaplari_read_assigned" ON public.anket_cevaplari FOR SELECT USING (EXISTS (SELECT 1 FROM public.anketler a LEFT JOIN public.kullanici_olcut_atamalari ka ON ka.alt_olcut_id = a.alt_olcut_id::integer WHERE a.id = public.anket_cevaplari.anket_id AND (ka.user_id = auth.uid() OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']))));

-- ana_basliklar & alt_olcutler
CREATE POLICY "ana_basliklar_read" ON public.ana_basliklar FOR SELECT USING (true);
CREATE POLICY "alt_olcutler_read" ON public.alt_olcutler FOR SELECT USING (true);
CREATE POLICY "ana_basliklar_admin" ON public.ana_basliklar FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));
CREATE POLICY "alt_olcutler_update_assigned" ON public.alt_olcutler FOR UPDATE USING (EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.alt_olcutler.id AND ka.user_id = auth.uid()) OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));
CREATE POLICY "alt_olcutler_admin_insert_delete" ON public.alt_olcutler FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- kullanici_olcut_atamalari
CREATE POLICY "Users can view own assignments" ON public.kullanici_olcut_atamalari FOR SELECT USING (auth.uid() = user_id OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));
CREATE POLICY "Admins can modify assignments" ON public.kullanici_olcut_atamalari FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- baslik_koordinatorleri
CREATE POLICY "Viewable by all" ON public.baslik_koordinatorleri FOR SELECT USING (true);
CREATE POLICY "Only admins can modify coordinators" ON public.baslik_koordinatorleri FOR ALL USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- puko_degerlendirmeleri (Güvenli select ve update)
CREATE POLICY "puko_degerlendirmeleri_read_secure" ON public.puko_degerlendirmeleri FOR SELECT TO authenticated USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%', '%gözlemci%', '%gozlemci%']) OR EXISTS (SELECT 1 FROM public.baslik_koordinatorleri bk JOIN public.alt_olcutler ao ON ao.id = public.puko_degerlendirmeleri.alt_olcut_id JOIN public.ana_basliklar ab ON ab.id = ao.ana_baslik_id WHERE bk.kullanici_id = auth.uid() AND ((bk.baslik = 'Kalite Güvencesi' AND ab.baslik_adi = 'KALİTE GÜVENCESİ SİSTEMİ') OR (bk.baslik = 'Eğitim-Öğretim' AND ab.baslik_adi = 'EĞİTİM VE ÖĞRETİM') OR (bk.baslik = 'Araştırma ve Geliştirme' AND ab.baslik_adi = 'ARAŞTIRMA VE GELİŞTİRME') OR (bk.baslik = 'Toplumsal Katkı' AND ab.baslik_adi = 'TOPLUMSAL KATKI') OR (bk.baslik = 'Yönetim Sistemi' AND ab.baslik_adi = 'YÖNETİM SİSTEMİ'))) OR EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.puko_degerlendirmeleri.alt_olcut_id AND ka.user_id = auth.uid()));
CREATE POLICY "Users can manage assigned evaluations" ON public.puko_degerlendirmeleri FOR ALL USING (EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.puko_degerlendirmeleri.alt_olcut_id AND ka.user_id = auth.uid()) OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- ozdegerlendirme_raporlari
CREATE POLICY "ozdegerlendirme_raporlari_read_secure" ON public.ozdegerlendirme_raporlari FOR SELECT TO authenticated USING (public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%', '%gözlemci%', '%gozlemci%']) OR EXISTS (SELECT 1 FROM public.baslik_koordinatorleri bk JOIN public.alt_olcutler ao ON ao.id = public.ozdegerlendirme_raporlari.alt_olcut_id::integer JOIN public.ana_basliklar ab ON ab.id = ao.ana_baslik_id WHERE bk.kullanici_id = auth.uid() AND ((bk.baslik = 'Kalite Güvencesi' AND ab.baslik_adi = 'KALİTE GÜVENCESİ SİSTEMİ') OR (bk.baslik = 'Eğitim-Öğretim' AND ab.baslik_adi = 'EĞİTİM VE ÖĞRETİM') OR (bk.baslik = 'Araştırma ve Geliştirme' AND ab.baslik_adi = 'ARAŞTIRMA VE GELİŞTİRME') OR (bk.baslik = 'Toplumsal Katkı' AND ab.baslik_adi = 'TOPLUMSAL KATKI') OR (bk.baslik = 'Yönetim Sistemi' AND ab.baslik_adi = 'YÖNETİM SİSTEMİ'))) OR EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.ozdegerlendirme_raporlari.alt_olcut_id::integer AND ka.user_id = auth.uid()));
CREATE POLICY "Users can manage assigned reports" ON public.ozdegerlendirme_raporlari FOR ALL USING (EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.ozdegerlendirme_raporlari.alt_olcut_id::integer AND ka.user_id = auth.uid()) OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- eylem_planlari
CREATE POLICY "eylem_planlari_read_all" ON public.eylem_planlari FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "eylem_planlari_all" ON public.eylem_planlari FOR ALL USING (EXISTS (SELECT 1 FROM public.kullanici_olcut_atamalari ka WHERE ka.alt_olcut_id = public.eylem_planlari.alt_olcut_id AND ka.user_id = auth.uid()) OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- dersler & ders_izlenceleri
CREATE POLICY "dersler_read_all" ON public.dersler FOR SELECT USING (true);
CREATE POLICY "izlenceler_read_all" ON public.ders_izlenceleri FOR SELECT USING (true);
CREATE POLICY "izlenceler_all_own" ON public.ders_izlenceleri FOR ALL USING (auth.uid() = hoca_id OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%']));

-- bildirimler
CREATE POLICY "bildirimler_all" ON public.bildirimler FOR ALL USING (auth.role() = 'authenticated');

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
