export function getAssignedLetter(baslik?: string): string {
  const rawTitle = (baslik || '').toLowerCase();
  if (rawTitle.includes('kalite')) return 'A';
  if (rawTitle.includes('eğitim') || rawTitle.includes('öğretim')) return 'B';
  if (rawTitle.includes('araştırma')) return 'C';
  if (rawTitle.includes('toplumsal')) return 'D';
  if (rawTitle.includes('yönetim')) return 'E';
  return '';
}
