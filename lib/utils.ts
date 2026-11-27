import { PROJECT_LEGACY_APP_ORIGINS } from './legacyOrigins';

export function getAssignedLetter(baslik?: string): string {
  const rawTitle = (baslik || '').toLowerCase();
  if (rawTitle.includes('kalite')) return 'A';
  if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) return 'B';
  if (rawTitle.includes('araştırma')) return 'C';
  if (rawTitle.includes('toplumsal')) return 'D';
  if (rawTitle.includes('yönetim')) return 'E';
  return '';
}

export function validateFileSize(file: File): { valid: boolean; error?: string } {
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';

  const ALLOWED_EXTENSIONS = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv',
    'png', 'jpg', 'jpeg', 'webp',
    'mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'm4v',
    'mp3', 'wav', 'ogg'
  ]);

  if (!fileExt || !ALLOWED_EXTENSIONS.has(fileExt)) {
    return {
      valid: false,
      error: `Güvenlik Kısıtlaması: ".${fileExt}" uzantılı dosya yüklenmesine izin verilmemektedir. Lütfen PDF, Word, Excel veya resim formatında bir dosya yükleyin.`
    };
  }

  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mkv|avi|mov|wmv|flv|m4v)$/i.test(file.name);
  const maxBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
  const maxMbStr = isVideo ? '50 MB' : '5 MB';

  if (file.size > maxBytes) {
    const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Seçtiğiniz dosya (${file.name}) ${fileSizeMb} MB boyutundadır. ${isVideo ? 'Video' : 'Doküman'} dosyaları için maksimum izin verilen boyut ${maxMbStr}'dır. Lütfen dosya boyutunu küçültüp tekrar deneyin.`
    };
  }

  return { valid: true };
}

export const ALLOWED_STORAGE_BUCKETS = new Set(['dokumanlar', 'kanit_dosyalari'] as const);
export type AllowedStorageBucket = 'dokumanlar' | 'kanit_dosyalari';

export interface ValidStorageTarget {
  bucket: AllowedStorageBucket;
  encodedFilePath: string;
  decodedFilePath: string;
  hashFragment: string;
}

const CONTROL_CHAR_REGEX = /[\u0000-\u001f\u007f]/;
const HEX_PERCENT_REGEX = /%[0-9a-fA-F]{2}/;

function getAllowedAppOrigins(appOrigin?: string): Set<string> {
  const origins = new Set<string>();
  const addCandidate = (raw?: string | null) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        origins.add(parsed.origin);
      }
    } catch {
      // Yoksay: geçersiz origin dizesi
    }
  };

  addCandidate(appOrigin);
  if (typeof window !== 'undefined') {
    addCandidate(window.location?.origin);
  }
  addCandidate(process.env.NEXT_PUBLIC_APP_URL);
  for (const legacyOrigin of PROJECT_LEGACY_APP_ORIGINS) {
    addCandidate(legacyOrigin);
  }
  const envLegacy = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGINS;
  if (envLegacy) {
    for (const part of envLegacy.split(',')) {
      addCandidate(part);
    }
  }
  return origins;
}

function tryDecodeOnce(str: string): string | null {
  try {
    return decodeURIComponent(str);
  } catch {
    return null;
  }
}

function hasForbiddenSegmentChars(decoded: string, isFirstSegment: boolean): boolean {
  if (
    !decoded ||
    decoded === '.' ||
    decoded === '..' ||
    decoded.includes('/') ||
    decoded.includes('\\') ||
    CONTROL_CHAR_REGEX.test(decoded)
  ) {
    return true;
  }
  if (isFirstSegment && /^(?:javascript|data):/i.test(decoded)) {
    return true;
  }
  return false;
}

function validateRawPathSegmentsBeforeUrlParse(rawPath: string): boolean {
  if (
    !rawPath.startsWith('/') ||
    rawPath.startsWith('//') ||
    rawPath.includes('\\') ||
    rawPath.includes('//') ||
    CONTROL_CHAR_REGEX.test(rawPath)
  ) {
    return false;
  }

  const segments = rawPath.slice(1).split('/');
  for (const seg of segments) {
    if (!seg || seg === '.' || seg === '..') {
      return false;
    }
    const dec1 = tryDecodeOnce(seg);
    if (dec1 === null || hasForbiddenSegmentChars(dec1, false)) {
      return false;
    }
    if (HEX_PERCENT_REGEX.test(dec1)) {
      const dec2 = tryDecodeOnce(dec1);
      if (dec2 !== null && hasForbiddenSegmentChars(dec2, false)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Verilen URL'nin yalnızca bu uygulamanın izin verilen depolama alanlarına
 * (`dokumanlar` veya `kanit_dosyalari`) işaret edip etmediğini doğrular ve
 * güvenli, segment bazlı yeniden kodlanmış proxy hedefini döndürür.
 */
export function extractValidStorageTarget(url?: string, appOrigin?: string): ValidStorageTarget | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed || CONTROL_CHAR_REGEX.test(trimmed)) return null;

  // 1. #page=N ekini dosya yolundan ayrı tut
  const hashIdx = trimmed.indexOf('#');
  const rawHash = hashIdx >= 0 ? trimmed.slice(hashIdx) : '';
  const withoutHash = hashIdx >= 0 ? trimmed.slice(0, hashIdx) : trimmed;
  const pageMatch = rawHash.match(/^#page=([1-9]\d*)$/i);
  const hashFragment = pageMatch ? `#page=${pageMatch[1]}` : '';

  // 2. ?query kısmını ayır
  const qIdx = withoutHash.indexOf('?');
  const rawWithoutQuery = qIdx >= 0 ? withoutHash.slice(0, qIdx) : withoutHash;

  // 3. new URL(...) normalizasyonundan ÖNCE ham yolu çıkar
  const isHttp = /^https?:\/\//i.test(rawWithoutQuery);
  let rawPathSlice = '';
  if (isHttp) {
    const schemeEnd = rawWithoutQuery.indexOf('://') + 3;
    const pathStart = rawWithoutQuery.indexOf('/', schemeEnd);
    if (pathStart === -1) return null;
    rawPathSlice = rawWithoutQuery.slice(pathStart);
  } else if (rawWithoutQuery.startsWith('/')) {
    rawPathSlice = rawWithoutQuery;
  } else {
    return null;
  }

  // 4. Ham yolda traversal / bozuk segment denetimi (new URL öncesi)
  if (!validateRawPathSegmentsBeforeUrlParse(rawPathSlice)) {
    return null;
  }

  let rawBucket = '';
  let rawFileSegments: string[] = [];

  if (!isHttp && rawPathSlice.startsWith('/api/storage/')) {
    const rest = rawPathSlice.slice('/api/storage/'.length);
    const parts = rest.split('/');
    rawBucket = parts[0] || '';
    rawFileSegments = parts.slice(1);
  } else if (isHttp && rawPathSlice.startsWith('/api/storage/')) {
    let parsed: URL;
    try {
      parsed = new URL(rawWithoutQuery);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    if (!getAllowedAppOrigins(appOrigin).has(parsed.origin)) {
      return null;
    }
    const rest = rawPathSlice.slice('/api/storage/'.length);
    const parts = rest.split('/');
    rawBucket = parts[0] || '';
    rawFileSegments = parts.slice(1);
  } else if (isHttp && rawPathSlice.startsWith('/storage/v1/object/')) {
    const supabaseEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseEnv) return null;
    let parsed: URL;
    let parsedSupabase: URL;
    try {
      parsed = new URL(rawWithoutQuery);
      parsedSupabase = new URL(supabaseEnv);
    } catch {
      return null;
    }
    if (parsed.host !== parsedSupabase.host) {
      return null;
    }
    const afterObj = rawPathSlice
      .slice('/storage/v1/object/'.length)
      .replace(/^(?:public|sign|authenticated)\//i, '');
    const parts = afterObj.split('/');
    rawBucket = parts[0] || '';
    rawFileSegments = parts.slice(1);
  } else {
    return null;
  }

  // 5. Bucket ve her dosya yolu segmentini çözüp yeniden kodla
  const decodedBucket = tryDecodeOnce(rawBucket);
  if (
    decodedBucket !== 'dokumanlar' &&
    decodedBucket !== 'kanit_dosyalari'
  ) {
    return null;
  }
  if (rawFileSegments.length === 0) {
    return null;
  }

  const decodedSegments: string[] = [];
  const encodedSegments: string[] = [];

  for (let idx = 0; idx < rawFileSegments.length; idx++) {
    const dec1 = tryDecodeOnce(rawFileSegments[idx]);
    if (dec1 === null || hasForbiddenSegmentChars(dec1, idx === 0)) {
      return null;
    }
    if (HEX_PERCENT_REGEX.test(dec1)) {
      const dec2 = tryDecodeOnce(dec1);
      if (dec2 !== null && hasForbiddenSegmentChars(dec2, idx === 0)) {
        return null;
      }
    }
    decodedSegments.push(dec1);
    encodedSegments.push(encodeURIComponent(dec1));
  }

  return {
    bucket: decodedBucket,
    encodedFilePath: encodedSegments.join('/'),
    decodedFilePath: decodedSegments.join('/'),
    hashFragment,
  };
}

/**
 * Validates whether a given URL points strictly to this application's internal storage
 * (either a valid /api/storage/<bucket>/<path> path, an allowed app origin / legacy origin
 * proxy URL, or the project's configured Supabase storage host).
 */
export function isInternalStorageUrl(url?: string, appOrigin?: string): boolean {
  return extractValidStorageTarget(url, appOrigin) !== null;
}

/**
 * Converts any valid internal storage URL (Supabase storage, legacy app domain proxy,
 * or relative proxy path) into a canonical proxy URL.
 * Returns a domain-independent relative `/api/storage/...` path when `origin` is empty,
 * or `${origin}/api/storage/...` when `origin` is provided (e.g., Word export).
 */
export function toProxyStorageUrl(url: string, origin: string = ''): string {
  if (!url) return url;
  const target = extractValidStorageTarget(url, origin);
  if (!target) return url;
  const relativePath = `/api/storage/${target.bucket}/${target.encodedFilePath}${target.hashFragment}`;
  const cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  return cleanOrigin ? `${cleanOrigin}${relativePath}` : relativePath;
}

const SPLIT_EVIDENCE_TAG_REGEX =
  /<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<(?:strong|b|u)\b[^>]*>\s*)*\[\s*(?:<\/(?:strong|b|u)>\s*)*<\/a>\s*<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<(?:strong|b|u)\b[^>]*>\s*)*(Evidence|Kan[ıi]t|edivence)\s*(?:<\/(?:strong|b|u)>\s*)*<\/a>\s*<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(?:<(?:strong|b|u)\b[^>]*>\s*)*([t\s]*\d+\])\s*(?:<\/(?:strong|b|u)>\s*)*<\/a>/gi;

/**
 * Bir bağlantı adresini (Supabase storage veya proxy storage) karşılaştırma için kanonik hedefe dönüştürür.
 * Boş veya '#' olan adresler geçersiz sayılır ve '' döndürür.
 */
export function normalizeSplitHrefTarget(rawHref?: string | null): string {
  if (!rawHref) return '';
  let str = rawHref.trim();
  if (!str || str === '#') return '';

  str = str.split('#')[0].split('?')[0].trim();
  try {
    str = decodeURIComponent(str);
  } catch {}

  const supabaseIdx = str.indexOf('/storage/v1/object/');
  if (supabaseIdx !== -1) {
    const after = str.substring(supabaseIdx + '/storage/v1/object/'.length);
    const cleaned = after.replace(/^(public|authenticated|sign)\//i, '').replace(/^\/+/, '');
    const slashIdx = cleaned.indexOf('/');
    if (slashIdx !== -1) {
      const bucket = cleaned.substring(0, slashIdx).trim();
      const path = cleaned.substring(slashIdx + 1).replace(/^\/+/, '').trim();
      if (bucket && path) return `storage:${bucket}/${path}`;
    }
    return '';
  }

  const proxyIdx = str.indexOf('/api/storage/');
  if (proxyIdx !== -1) {
    const after = str.substring(proxyIdx + '/api/storage/'.length).replace(/^\/+/, '');
    const slashIdx = after.indexOf('/');
    if (slashIdx !== -1) {
      const bucket = after.substring(0, slashIdx).trim();
      const path = after.substring(slashIdx + 1).replace(/^\/+/, '').trim();
      if (bucket && path) return `storage:${bucket}/${path}`;
    }
    return '';
  }

  return `url:${str}`;
}

export type SplitEvidenceUrlValidator = (num: number, targetHref: string) => boolean;

export function areSplitHrefsSameTarget(
  u1?: string | null,
  _u2?: string | null,
  u3?: string | null,
  num?: number,
  expectedUrlValidator?: SplitEvidenceUrlValidator
): boolean {
  const t1 = normalizeSplitHrefTarget(u1);
  const t3 = normalizeSplitHrefTarget(u3);
  if (!t1 || t1 !== t3) return false;
  if (expectedUrlValidator && typeof num === 'number' && !isNaN(num)) {
    return expectedUrlValidator(num, u1 || '');
  }
  return true;
}

export interface ConflictingSplitEvidenceLink {
  num: number;
  label: string;
  hrefs: [string, string, string];
  reason: 'outer_mismatch' | 'expected_url_mismatch';
}

/**
 * Bölünmüş 3 parçalı ([ + Evidence/Kanıt + N]) bağlantılar arasında dış parçaların (u1 ve u3)
 * hedefleri birbiriyle uyuşmayan veya kanıtın beklenen URL'siyle eşleşmeyen bağlantıları tespit eder.
 */
export function extractConflictingSplitEvidenceTags(
  html: string | null | undefined,
  expectedUrlValidator?: SplitEvidenceUrlValidator
): ConflictingSplitEvidenceLink[] {
  if (!html) return [];
  const conflicts: ConflictingSplitEvidenceLink[] = [];
  const regex = new RegExp(SPLIT_EVIDENCE_TAG_REGEX.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const [, u1, u2, word, u3, numPart] = match;
    const cleanNumStr = numPart.replace(/^[t\s]+/, '').replace(/\]$/, '').trim();
    const num = parseInt(cleanNumStr, 10);
    if (!areSplitHrefsSameTarget(u1, u2, u3, num, expectedUrlValidator)) {
      const outerMatch = areSplitHrefsSameTarget(u1, u2, u3);
      const properWord = word.toLowerCase().includes('edivence')
        ? 'Evidence'
        : /^kan/i.test(word)
        ? 'Kanıt'
        : 'Evidence';
      if (!isNaN(num)) {
        conflicts.push({
          num,
          label: `[${properWord} ${num}]`,
          hrefs: [u1 || '', u2 || '', u3 || ''],
          reason: outerMatch ? 'expected_url_mismatch' : 'outer_mismatch',
        });
      }
    }
  }
  return conflicts;
}

export function healSplitEvidenceTags(
  html: string,
  expectedUrlValidator?: SplitEvidenceUrlValidator
): string {
  if (!html) return html;
  return html.replace(
    SPLIT_EVIDENCE_TAG_REGEX,
    (match, u1, u2, word, u3, numPart) => {
      const cleanNum = numPart.replace(/^[t\s]+/, '').replace(/\]$/, '').trim();
      const num = parseInt(cleanNum, 10);
      if (!areSplitHrefsSameTarget(u1, u2, u3, num, expectedUrlValidator)) {
        return match;
      }
      const properWord = word.toLowerCase().includes('edivence')
        ? 'Evidence'
        : /^kan/i.test(word)
        ? 'Kanıt'
        : word;
      return `<a rel="noopener noreferrer" href="${u1}"><strong><u>[${properWord} ${cleanNum}]</u></strong></a>`;
    }
  );
}

/**
 * Replaces href attributes in report HTML so all internal document links point to the proxy URL,
 * strips target="_blank" specifically and only from internal storage links,
 * and heals any fragmented / split evidence link tags created by rich-text copy-pasting.
 */
export function sanitizeReportHtmlLinks(html: string, origin: string = ''): string {
  if (!html) return html;
  const healed = healSplitEvidenceTags(html);
  return healed.replace(/<a\s+([^>]*?)href=(["'])(.*?)\2([^>]*?)>/gi, (match, beforeHref, quote, href, afterHref) => {
    if (extractValidStorageTarget(href, origin)) {
      const convertedHref = toProxyStorageUrl(href, origin);
      const cleanBefore = beforeHref.replace(/\s*target=(["'])_blank\1/gi, '');
      const cleanAfter = afterHref.replace(/\s*target=(["'])_blank\1/gi, '');
      return `<a ${cleanBefore}href=${quote}${convertedHref}${quote}${cleanAfter}>`;
    }
    return match;
  });
}
