import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const ALLOWED_BUCKETS = new Set(['dokumanlar', 'kanit_dosyalari', 'sinav_arsivleri']);

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const cookieStore = await cookies();

    // 1. Kullanıcı oturumunu doğrula
    const supabaseAuth = createServerClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );

    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz erişim. Lütfen önce giriş yapınız.' }, { status: 401 });
    }

    const body = await request.json();
    let { bucket, storagePath, url } = body;

    // Eğer storagePath verilmemiş ama proxy URL verilmişse path'i ayrıştır
    if (!storagePath && typeof url === 'string') {
      const match = url.match(/^\/api\/storage\/([^/]+)\/(.+)$/);
      if (match) {
        if (!bucket) bucket = match[1];
        storagePath = decodeURIComponent(match[2]);
      }
    }

    if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
      return NextResponse.json({ error: 'Geçersiz veya yetkisiz depolama alanı (bucket).' }, { status: 400 });
    }

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'Silinecek dosya yolu (storagePath) belirtilmedi.' }, { status: 400 });
    }

    // Path traversal ve zararlı karakter kontrolü
    const normalizedPath = decodeURIComponent(storagePath).replace(/\\/g, '/');
    if (normalizedPath.includes('..') || normalizedPath.startsWith('/') || normalizedPath.includes('://')) {
      return NextResponse.json({ error: 'Geçersiz dosya yolu formatı.' }, { status: 400 });
    }

    const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 2. Kullanıcı rolünü kontrol et
    const { data: profil } = await supabaseAdmin
      .from('profiller')
      .select('rol')
      .eq('id', user.id)
      .single();

    const role = (profil?.rol || '').toLowerCase();
    const isAdmin = role.includes('admin') || role.includes('yonetici') || role.includes('yönetici');

    // 3. Dosya yetkilendirme kaydını bul
    const { data: mapping } = await supabaseAdmin
      .from('dosya_yetkilendirmeleri')
      .select('id, owner_id, bucket, storage_path')
      .eq('bucket', bucket)
      .eq('storage_path', normalizedPath)
      .maybeSingle();

    // Sahiplik / yetki kontrolü: Yalnızca dosya sahibi kullanıcı veya yöneticiler silebilir
    if (mapping) {
      const isOwner = mapping.owner_id === user.id;
      if (!isOwner && !isAdmin) {
        return NextResponse.json(
          { error: 'Bu dosyayı silme yetkiniz bulunmamaktadır.' },
          { status: 403 }
        );
      }
    } else if (!isAdmin) {
      // Mapping kaydı yoksa ve kullanıcı admin değilse rastgele dosya silmesi engellenir
      return NextResponse.json(
        { error: 'Silinecek dosya yetkilendirme kaydı bulunamadı ve işlem yetkiniz yetersiz.' },
        { status: 403 }
      );
    }

    // 4. Supabase Storage üzerinden fiziksel silme
    const { error: storageError } = await supabaseAdmin.storage
      .from(bucket)
      .remove([normalizedPath]);

    if (storageError) {
      console.error('Storage silme hatası:', storageError);
      return NextResponse.json(
        { error: `Depolama alanından dosya silinemedi: ${storageError.message}` },
        { status: 500 }
      );
    }

    // 5. dosya_yetkilendirmeleri tablosundaki kaydı temizle
    if (mapping) {
      const { error: deleteMappingError } = await supabaseAdmin
        .from('dosya_yetkilendirmeleri')
        .delete()
        .eq('id', mapping.id);

      if (deleteMappingError) {
        console.error('Yetkilendirme kaydı silme hatası:', deleteMappingError);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Dosya depodan ve yetkilendirme sisteminden kalıcı olarak silindi.'
    });

  } catch (error: any) {
    console.error('Storage delete exception:', error);
    return NextResponse.json({ error: error.message || 'Sunucu silme işleminde hata oluştu.' }, { status: 500 });
  }
}
