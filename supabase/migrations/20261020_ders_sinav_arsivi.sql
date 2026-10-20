-- Sınav ve Değerlendirme Arşivi Tablosu, Özel Storage Bucket ve Güvenlik Kuralları (RLS)
-- Hedef Veritabanı: Yedek Proje (mbdtjzxyctucrdlwdxsm)
-- Kural: Sisteme giriş yapmış her kullanıcı; e-posta alan adı, profil rolü, akademik unvan veya ders ataması şartı olmaksızın izlence ve sınav arşivi doldurabilir.
-- Supabase Standartları:
--   1. RLS zorunlu olarak devrede (ENABLE ROW LEVEL SECURITY).
--   2. Storage nesnelerinde deprecated 'owner' yerine güncel '(select auth.uid()::text) = owner_id' standardı devrede.
--   3. Performans ve subquery optimizasyonu için '(select auth.uid())' sarmalaması devrede.
--   4. 'authenticated' ve 'service_role' için açık GRANT yetkilendirmesi devrede.

-- 1. Özel Storage Bucket Güvencesi (Idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'sinav_arsivleri',
  'sinav_arsivleri',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 52428800;

-- 2. Tablo Tanımı
CREATE TABLE IF NOT EXISTS public.ders_sinav_arsivi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ders_id TEXT NOT NULL REFERENCES public.dersler(kod) ON DELETE CASCADE,
  hoca_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  donem_id UUID REFERENCES public.donemler(id) ON DELETE CASCADE,
  vize_sorulari JSONB DEFAULT NULL,
  final_sorulari JSONB DEFAULT NULL,
  cevap_anahtari JSONB DEFAULT NULL,
  ogrenci_kagitlari JSONB DEFAULT '[]'::jsonb,
  guncelleme_tarihi TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT uq_ders_sinav_arsivi UNIQUE (ders_id, hoca_id, donem_id)
);

-- Hızlı erişim indeksleri
CREATE INDEX IF NOT EXISTS idx_ders_sinav_arsivi_lookup ON public.ders_sinav_arsivi(ders_id, donem_id);
CREATE INDEX IF NOT EXISTS idx_ders_sinav_arsivi_hoca ON public.ders_sinav_arsivi(hoca_id);

-- 3. RLS Etkinleştirme (Supabase Zorunlu Güvenlik Kuralı)
ALTER TABLE public.ders_sinav_arsivi ENABLE ROW LEVEL SECURITY;

-- Mevcut politikaları temizle (idempotent migration)
DROP POLICY IF EXISTS "ders_sinav_arsivi_select_policy" ON public.ders_sinav_arsivi;
DROP POLICY IF EXISTS "ders_sinav_arsivi_insert_policy" ON public.ders_sinav_arsivi;
DROP POLICY IF EXISTS "ders_sinav_arsivi_update_policy" ON public.ders_sinav_arsivi;
DROP POLICY IF EXISTS "ders_sinav_arsivi_delete_policy" ON public.ders_sinav_arsivi;

-- 4. Tablo RLS Politikaları
-- A. SELECT: Arşiv sahibi ((select auth.uid()) = hoca_id) veya yöneticiler
CREATE POLICY "ders_sinav_arsivi_select_policy"
ON public.ders_sinav_arsivi
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = hoca_id
  OR EXISTS (
    SELECT 1 FROM public.profiller p
    WHERE p.id = (select auth.uid())
    AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
  )
);

-- B. INSERT: Giriş yapmış kullanıcı kendi hoca_id'si ile veya yöneticiler
CREATE POLICY "ders_sinav_arsivi_insert_policy"
ON public.ders_sinav_arsivi
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) = hoca_id
  OR EXISTS (
    SELECT 1 FROM public.profiller p
    WHERE p.id = (select auth.uid())
    AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
  )
);

-- C. UPDATE: Arşiv sahibi veya yöneticiler
CREATE POLICY "ders_sinav_arsivi_update_policy"
ON public.ders_sinav_arsivi
FOR UPDATE
TO authenticated
USING (
  (select auth.uid()) = hoca_id
  OR EXISTS (
    SELECT 1 FROM public.profiller p
    WHERE p.id = (select auth.uid())
    AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
  )
)
WITH CHECK (
  (select auth.uid()) = hoca_id
  OR EXISTS (
    SELECT 1 FROM public.profiller p
    WHERE p.id = (select auth.uid())
    AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
  )
);

-- D. DELETE: Arşiv sahibi veya yöneticiler
CREATE POLICY "ders_sinav_arsivi_delete_policy"
ON public.ders_sinav_arsivi
FOR DELETE
TO authenticated
USING (
  (select auth.uid()) = hoca_id
  OR EXISTS (
    SELECT 1 FROM public.profiller p
    WHERE p.id = (select auth.uid())
    AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
  )
);

-- 5. Storage Nesneleri Güvenlik Politikaları (storage.objects for 'sinav_arsivleri')
-- Supabase Storage Mail Bildirimi Kuralı:
-- Deprecated 'owner' sütunu yerine 'owner_id' kullanılmalıdır.
-- Dosyalar private tutulur ve yetkili Next.js proxy (/api/storage/sinav_arsivleri/...) üzerinden sunulur.
DROP POLICY IF EXISTS "sinav_arsivleri_select_policy" ON storage.objects;
DROP POLICY IF EXISTS "sinav_arsivleri_insert_policy" ON storage.objects;
DROP POLICY IF EXISTS "sinav_arsivleri_delete_policy" ON storage.objects;

CREATE POLICY "sinav_arsivleri_select_policy"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'sinav_arsivleri'
  AND (
    (select auth.uid()::text) = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiller p
      WHERE p.id = (select auth.uid())
      AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
    )
  )
);

CREATE POLICY "sinav_arsivleri_insert_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'sinav_arsivleri'
  AND (
    (select auth.uid()::text) = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiller p
      WHERE p.id = (select auth.uid())
      AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
    )
  )
);

CREATE POLICY "sinav_arsivleri_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'sinav_arsivleri'
  AND (
    (select auth.uid()::text) = owner_id
    OR EXISTS (
      SELECT 1 FROM public.profiller p
      WHERE p.id = (select auth.uid())
      AND (p.rol ILIKE '%admin%' OR p.rol ILIKE '%yonetici%' OR p.rol ILIKE '%yönetici%')
    )
  )
);

-- 6. Açık Erişim Yetkileri (Supabase Table Grants)
GRANT ALL ON TABLE public.ders_sinav_arsivi TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ders_sinav_arsivi TO authenticated;
