-- ==============================================================================
-- Migration: 20261128_tighten_storage_select_policies.sql
-- Amaç: Doğrudan Supabase Storage API okuma politikalarını (dokumanlar_select ve
--       kanit_dosyalari_select) yalnızca Dosya Sahibi veya Yönetici ile sınırla.
-- Kapsam: Akreditasyon Yedek (canlı veritabanı)
-- Notlar:
--   1. Yükleme (*_insert), güncelleme (*_update) ve silme (*_delete) kurallarına
--      KESİNLİKLE dokunulmaz.
--   2. Uygulama içi tüm dosya görüntüleme ve indirme işlemleri /api/storage/...
--      üzerinden service_role + dosya_yetkilendirmeleri yetki denetimi ile çalışır.
--   3. SELECT kuralının mevcut *_delete kurallarıyla aynı şekilde (owner OR yönetici)
--      bırakılması, PhaseClient içindeki mevcut storage.remove() davranışını korur.
-- ==============================================================================

-- 1. dokumanlar_select: Yalnızca Dosya Sahibi veya Yönetici
DROP POLICY IF EXISTS "dokumanlar_select" ON storage.objects;
CREATE POLICY "dokumanlar_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dokumanlar'
    AND (
      auth.uid() = owner
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

-- 2. kanit_dosyalari_select: Yalnızca Dosya Sahibi veya Yönetici
DROP POLICY IF EXISTS "kanit_dosyalari_select" ON storage.objects;
CREATE POLICY "kanit_dosyalari_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kanit_dosyalari'
    AND (
      auth.uid() = owner
      OR public.get_user_role(auth.uid()) ILIKE ANY (ARRAY['%admin%', '%yönetici%', '%yonetici%'])
    )
  );

-- 3. DOĞRULAMA SORGUSU:
--    storage.objects üzerinde geniş erişim veren başka bir SELECT veya ALL
--    politikası kalmadığını Supabase SQL Editor çıktısında hemen doğrulayın.
--    Yalnızca yukarıdaki dokumanlar_select ve kanit_dosyalari_select görünmelidir.
SELECT
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND cmd IN ('SELECT', 'ALL')
ORDER BY policyname;
