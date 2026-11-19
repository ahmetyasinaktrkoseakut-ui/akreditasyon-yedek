import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import {
  resolveUserAccessScope,
  filterAuthorizedAtamalar,
  buildAtamaSorumluMap,
  OlcutAtamaKaydi,
  AltOlcutKodKaydi,
  OlcutAtamaProfil,
} from '@/lib/olcutAtamalariUtils';

/**
 * Seçili dönemdeki ölçüt atamalarını doğrulanmış kullanıcının yetki sınırına göre döndürür:
 * - Yönetici / Gözlemci: tüm ölçüt atamaları
 * - Başlık Koordinatörü: yalnızca koordinatörü olduğu başlık altındaki ölçüt atamaları
 * - Standart Birim Sorumlusu: yalnızca kendi üzerine atanmış ölçütler
 */
export async function GET(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Sunucu Supabase yapılandırması eksik.' },
        { status: 500 }
      );
    }

    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapınız.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const donemId = (searchParams.get('donem_id') || '').trim();

    if (!donemId) {
      return NextResponse.json(
        { error: 'donem_id parametresi zorunludur.' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Rol ve koordinatör başlığını sunucuda doğrulanmış user.id üzerinden belirle
    const [profileRes, coordRes] = await Promise.all([
      supabaseAdmin.from('profiller').select('rol').eq('id', user.id).maybeSingle(),
      supabaseAdmin.from('baslik_koordinatorleri').select('baslik').eq('kullanici_id', user.id),
    ]);

    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    }
    if (coordRes.error) {
      return NextResponse.json({ error: coordRes.error.message }, { status: 500 });
    }

    const { isAdminOrObserver, coordinatorLetters } = resolveUserAccessScope({
      rol: profileRes.data?.rol,
      coordinatorBasliklar: coordRes.data || [],
    });

    // Seçili dönem atamalarını getir; koordinatörse yalnızca kendi başlığındaki ölçüt kodlarını eşleştir
    const atamaQuery = supabaseAdmin
      .from('kullanici_olcut_atamalari')
      .select('alt_olcut_id, user_id')
      .eq('donem_id', donemId);

    const needsAltOlcutCodes = !isAdminOrObserver && coordinatorLetters.length > 0;

    const [atamaRes, altOlcutRes] = await Promise.all([
      atamaQuery,
      needsAltOlcutCodes
        ? supabaseAdmin.from('alt_olcutler').select('id, kod')
        : Promise.resolve({ data: [] as AltOlcutKodKaydi[], error: null }),
    ]);

    if (atamaRes.error) {
      return NextResponse.json({ error: atamaRes.error.message }, { status: 500 });
    }
    if (altOlcutRes.error) {
      return NextResponse.json({ error: altOlcutRes.error.message }, { status: 500 });
    }

    const authorizedRows = filterAuthorizedAtamalar({
      atamalar: (atamaRes.data || []) as OlcutAtamaKaydi[],
      altOlcutler: (altOlcutRes.data || []) as AltOlcutKodKaydi[],
      userId: user.id,
      isAdminOrObserver,
      coordinatorLetters,
    });

    const userIds = Array.from(new Set(authorizedRows.map((r) => String(r.user_id)).filter(Boolean)));
    let profiller: OlcutAtamaProfil[] = [];

    if (userIds.length > 0) {
      const { data: profData, error: profErr } = await supabaseAdmin
        .from('profiller')
        .select('id, ad_soyad, email')
        .in('id', userIds);

      if (profErr) {
        return NextResponse.json({ error: profErr.message }, { status: 500 });
      }
      profiller = (profData || []) as OlcutAtamaProfil[];
    }

    const data = buildAtamaSorumluMap({
      atamalar: authorizedRows,
      profiller,
    });

    return NextResponse.json({
      data,
      scope: isAdminOrObserver
        ? 'all'
        : coordinatorLetters.length > 0
        ? 'coordinator'
        : 'self',
    });
  } catch (err: any) {
    console.error('GET /api/olcut-atamalari hatası:', err);
    return NextResponse.json(
      { error: err?.message || 'Beklenmeyen sunucu hatası.' },
      { status: 500 }
    );
  }
}
