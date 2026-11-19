import { getAssignedLetter } from './utils';

export interface OlcutAtamaProfil {
  id: string;
  ad_soyad?: string | null;
  email?: string | null;
}

export interface OlcutAtamaKaydi {
  alt_olcut_id: number | string;
  user_id: string;
}

export interface AltOlcutKodKaydi {
  id: number | string;
  kod?: string | null;
}

export interface SorumluHocaBilgisi {
  user_id: string;
  ad_soyad: string;
}

export function resolveUserAccessScope(params: {
  rol?: string | null;
  coordinatorBasliklar?: Array<{ baslik?: string | null }>;
}): {
  isAdminOrObserver: boolean;
  coordinatorLetters: string[];
} {
  const role = (params.rol || '').toLowerCase().trim();
  const isAdminOrObserver =
    role.includes('admin') ||
    role.includes('yonetici') ||
    role.includes('yönetici') ||
    role.includes('gozlemci') ||
    role.includes('gözlemci');

  const coordinatorLetters = Array.from(
    new Set(
      (params.coordinatorBasliklar || [])
        .map((c) => getAssignedLetter(c.baslik || ''))
        .filter(Boolean)
    )
  );

  return { isAdminOrObserver, coordinatorLetters };
}

export function isKodInLetters(kod: string | null | undefined, letters: string[]): boolean {
  if (!kod || letters.length === 0) return false;
  const normalizedKod = kod.trim().toUpperCase();
  return letters.some((letter) => {
    const l = letter.trim().toUpperCase();
    return normalizedKod === l || normalizedKod.startsWith(`${l}.`);
  });
}

export function filterAuthorizedAtamalar(params: {
  atamalar: OlcutAtamaKaydi[];
  altOlcutler: AltOlcutKodKaydi[];
  userId: string;
  isAdminOrObserver: boolean;
  coordinatorLetters: string[];
}): OlcutAtamaKaydi[] {
  const { atamalar, altOlcutler, userId, isAdminOrObserver, coordinatorLetters } = params;

  if (isAdminOrObserver) {
    return atamalar;
  }

  if (coordinatorLetters.length > 0) {
    const allowedOlcutIds = new Set(
      altOlcutler
        .filter((ao) => isKodInLetters(ao.kod, coordinatorLetters))
        .map((ao) => String(ao.id))
    );
    return atamalar.filter((a) => allowedOlcutIds.has(String(a.alt_olcut_id)));
  }

  return atamalar.filter((a) => String(a.user_id) === String(userId));
}

export function buildAtamaSorumluMap(params: {
  atamalar: OlcutAtamaKaydi[];
  profiller: OlcutAtamaProfil[];
}): Record<string, SorumluHocaBilgisi[]> {
  const profMap = new Map<string, string>();
  params.profiller.forEach((p) => {
    const name = (p.ad_soyad || '').trim() || (p.email || '').trim() || 'İsimsiz Kullanıcı';
    profMap.set(String(p.id), name);
  });

  const result: Record<string, SorumluHocaBilgisi[]> = {};
  params.atamalar.forEach((a) => {
    const key = String(a.alt_olcut_id);
    if (!result[key]) {
      result[key] = [];
    }
    const alreadyExists = result[key].some((item) => item.user_id === String(a.user_id));
    if (!alreadyExists) {
      result[key].push({
        user_id: String(a.user_id),
        ad_soyad: profMap.get(String(a.user_id)) || 'Bilinmeyen Kullanıcı',
      });
    }
  });

  return result;
}
