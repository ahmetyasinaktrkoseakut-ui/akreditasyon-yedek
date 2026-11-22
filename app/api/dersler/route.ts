import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const ADMIN_ROLE_REGEX = /admin|yonetici|yönetici|manager/i;

const VALID_DILLER = new Set(['Türkçe', 'Arapça', 'İngilizce', 'İbranice']);

const VALID_YARIYILLAR = new Set([
  'I. YARIYIL',
  'II. YARIYIL',
  'III. YARIYIL',
  'IV. YARIYIL',
  'V. YARIYIL',
  'VI. YARIYIL',
  'VII. YARIYIL',
  'VIII. YARIYIL',
  'SEÇMELİ I DERSLERİ',
  'SEÇMELİ II DERSLERİ',
  'SEÇMELİ III DERSLERİ',
  'SEÇMELİ IV DERSLERİ',
  'SEÇMELİ V DERSLERİ',
  'SEÇMELİ VI DERSLERİ',
]);

async function getAdminClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Sunucu Supabase yapılandırması eksik.' },
        { status: 500 }
      ),
    };
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
    return {
      errorResponse: NextResponse.json(
        { error: 'Yetkisiz erişim. Lütfen giriş yapınız.' },
        { status: 401 }
      ),
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile, error: profError } = await supabaseAdmin
    .from('profiller')
    .select('rol')
    .eq('id', user.id)
    .maybeSingle();

  if (profError) {
    return {
      errorResponse: NextResponse.json({ error: profError.message }, { status: 500 }),
    };
  }

  const userRole = (profile?.rol || '').toLowerCase();
  if (!ADMIN_ROLE_REGEX.test(userRole)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Bu işlem yalnızca yönetici rolüne açıktır.' },
        { status: 403 }
      ),
    };
  }

  return { supabaseAdmin, user };
}

function parseTurKind(raw: unknown): 'zorunlu' | 'secmeli' | null {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'z' || val === 'zorunlu') return 'zorunlu';
  if (val === 's' || val === 'seçmeli' || val === 'secmeli') return 'secmeli';
  return null;
}

function parseNonNegInt(raw: unknown, fallback = 0): number | null {
  if (raw === '' || raw === null || raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

export async function POST(request: Request) {
  try {
    const auth = await getAdminClients();
    if ('errorResponse' in auth) return auth.errorResponse;
    const { supabaseAdmin } = auth;

    const body = await request.json();
    const kod = String(body?.kod || '').trim();
    const ad = String(body?.ad || '').trim();
    const yariyil = String(body?.yariyil || '').trim();
    const turKind = parseTurKind(body?.tur);
    const dil = String(body?.dil || 'Türkçe').trim();

    if (!kod || kod === '-') {
      return NextResponse.json({ error: 'Geçerli bir ders kodu giriniz.' }, { status: 400 });
    }
    if (!ad) {
      return NextResponse.json({ error: 'Ders adı zorunludur.' }, { status: 400 });
    }
    if (!yariyil || !VALID_YARIYILLAR.has(yariyil)) {
      return NextResponse.json({ error: 'Geçerli bir dönem (yarıyıl) seçiniz.' }, { status: 400 });
    }
    if (!turKind) {
      return NextResponse.json({ error: 'Ders türü Z (Zorunlu) veya S (Seçmeli) olmalıdır.' }, { status: 400 });
    }
    if (!VALID_DILLER.has(dil)) {
      return NextResponse.json(
        { error: 'Ders dili yalnızca Türkçe, Arapça, İngilizce veya İbranice olabilir.' },
        { status: 400 }
      );
    }

    const t = parseNonNegInt(body?.t, 0);
    const u = parseNonNegInt(body?.u, 0);
    const l = parseNonNegInt(body?.l, 0);
    const kredi = parseNonNegInt(body?.kredi, 0);
    const akts = parseNonNegInt(body?.akts, 0);

    if (t === null || u === null || l === null || kredi === null || akts === null) {
      return NextResponse.json(
        { error: 'T, U, L, Kredi ve AKTS değerleri 0 veya pozitif tam sayı olmalıdır.' },
        { status: 400 }
      );
    }

    const [{ data: existing, error: existingErr }, { data: sampleRows }] = await Promise.all([
      supabaseAdmin.from('dersler').select('kod').eq('kod', kod).maybeSingle(),
      supabaseAdmin.from('dersler').select('tur').limit(20),
    ]);

    if (existingErr) {
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if (existing) {
      return NextResponse.json(
        {
          error:
            'Bu ders kodu sistemde zaten kayıtlı. Farklı şube eklemek için koda ayırt edici ek yazın (örn: 181115041-B).',
        },
        { status: 409 }
      );
    }

    // Mevcut veritabanının tur formatını (Z/S veya Zorunlu/Seçmeli) koru
    const usesFullWords = (sampleRows || []).some((r) => {
      const val = String(r.tur || '').trim().toLowerCase();
      return val === 'zorunlu' || val === 'seçmeli' || val === 'secmeli';
    });
    const tur = usesFullWords
      ? turKind === 'zorunlu'
        ? 'Zorunlu'
        : 'Seçmeli'
      : turKind === 'zorunlu'
      ? 'Z'
      : 'S';

    const insertPayload = {
      kod,
      ad,
      yariyil,
      tur,
      t,
      u,
      l,
      kredi,
      akts,
      dil,
    };

    const { data, error } = await supabaseAdmin
      .from('dersler')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/dersler hatası:', err);
    const message = err instanceof Error ? err.message : 'Ders eklenirken beklenmeyen bir hata oluştu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const auth = await getAdminClients();
    if ('errorResponse' in auth) return auth.errorResponse;
    const { supabaseAdmin } = auth;

    const { searchParams } = new URL(request.url);
    const kod = (searchParams.get('kod') || '').trim();

    if (!kod || kod === '-') {
      return NextResponse.json({ error: 'Silinecek ders kodu zorunludur.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('dersler')
      .delete()
      .eq('kod', kod)
      .select('kod');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Belirtilen koda sahip ders bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, kod });
  } catch (err: unknown) {
    console.error('DELETE /api/dersler hatası:', err);
    const message = err instanceof Error ? err.message : 'Ders silinirken beklenmeyen bir hata oluştu.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
