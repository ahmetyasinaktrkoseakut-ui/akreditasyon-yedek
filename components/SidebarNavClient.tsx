'use client';

import { Link, usePathname } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { 
  Home, 
  BarChart2, 
  Calendar, 
  LineChart, 
  FolderOpen, 
  Settings,
  Bell,
  Lightbulb,
  BookOpen,
  Megaphone,
  GraduationCap,
  Activity
} from 'lucide-react';
import { LogoutButton } from './LogoutButton';
import { Users, FileCheck, ClipboardCheck, History, Inbox } from 'lucide-react';

type SidebarAuthState = {
  userId: string;
  isAdmin: boolean;
  isObserver: boolean;
  hasAssignment: boolean;
  isCoordinator: boolean;
};

export default function SidebarNavClient({
  isAdmin: initialIsAdmin,
  isObserver: initialIsObserver = false,
  userId: initialUserId,
  hasAssignment: initialHasAssignment,
  isCoordinator: initialIsCoordinator = false,
}: {
  isAdmin: boolean;
  isObserver?: boolean;
  userId: string;
  hasAssignment: boolean;
  isCoordinator?: boolean;
}) {
  const pathname = usePathname();
  const t = useTranslations('Navigation');
  const tAnn = useTranslations('Announcements');
  const tQM = useTranslations('QualityManual');
  const [unreadCount, setUnreadCount] = useState(0);
  const [clientAuthState, setClientAuthState] = useState<SidebarAuthState | null>(null);

  const serverHasPermissions = Boolean(
    initialIsAdmin || initialIsObserver || initialHasAssignment || initialIsCoordinator
  );
  const effectiveAuth: SidebarAuthState = clientAuthState ?? {
    userId: initialUserId || '',
    isAdmin: Boolean(initialIsAdmin),
    isObserver: Boolean(initialIsObserver),
    hasAssignment: Boolean(initialHasAssignment),
    isCoordinator: Boolean(initialIsCoordinator),
  };
  const { userId, isAdmin, isObserver, hasAssignment, isCoordinator } = effectiveAuth;

  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queuedRefreshRef = useRef<{ hintUserId?: string; force: boolean } | null>(null);
  const lastLoadedUserIdRef = useRef<string | null>(
    serverHasPermissions && initialUserId ? initialUserId : null
  );
  const hasLoadedForUserRef = useRef<boolean>(Boolean(serverHasPermissions && initialUserId));

  useEffect(() => {
    isMountedRef.current = true;

    const clearScheduledRefresh = () => {
      if (refreshTimerRef.current !== null) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };

    const scheduleRefresh = (hintUserId?: string, force = false) => {
      clearScheduledRefresh();
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        void loadClientPermissions(hintUserId, force);
      }, 0);
    };

    const loadClientPermissions = async (hintUserId?: string, force = false) => {
      if (!isMountedRef.current) return;

      if (
        !force &&
        hintUserId &&
        hasLoadedForUserRef.current &&
        lastLoadedUserIdRef.current === hintUserId
      ) {
        return;
      }

      if (inFlightRef.current) {
        queuedRefreshRef.current = {
          hintUserId: hintUserId ?? queuedRefreshRef.current?.hintUserId,
          force: force || Boolean(queuedRefreshRef.current?.force),
        };
        return;
      }

      inFlightRef.current = true;
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!isMountedRef.current) return;
        if (userError) {
          console.error('Sidebar kullanıcı doğrulama hatası:', userError);
          return;
        }

        const targetUserId = user?.id || '';
        if (!targetUserId) {
          lastLoadedUserIdRef.current = null;
          hasLoadedForUserRef.current = false;
          setClientAuthState({
            userId: '',
            isAdmin: false,
            isObserver: false,
            hasAssignment: false,
            isCoordinator: false,
          });
          setUnreadCount(0);
          return;
        }

        if (
          !force &&
          hasLoadedForUserRef.current &&
          lastLoadedUserIdRef.current === targetUserId
        ) {
          return;
        }

        const [profileRes, assignmentRes, coordinatorRes] = await Promise.all([
          supabase
            .from('profiller')
            .select('rol')
            .eq('id', targetUserId)
            .maybeSingle(),
          supabase
            .from('kullanici_olcut_atamalari')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', targetUserId),
          supabase
            .from('baslik_koordinatorleri')
            .select('*', { count: 'exact', head: true })
            .eq('kullanici_id', targetUserId),
        ]);

        if (!isMountedRef.current) return;

        const hasQueryError = Boolean(
          profileRes.error || assignmentRes.error || coordinatorRes.error
        );
        if (hasQueryError) {
          console.error('Sidebar yetki sorgusu hatası:', {
            profileError: profileRes.error,
            assignmentError: assignmentRes.error,
            coordinatorError: coordinatorRes.error,
          });
        }

        const role = (profileRes.data?.rol || '').toLowerCase();
        const nextIsAdmin =
          role.includes('yonetici') || role.includes('yönetici') || role.includes('admin');
        const nextIsObserver =
          role.includes('gözlemci') || role.includes('gozlemci');
        const nextHasAssignment = (assignmentRes.count || 0) > 0;
        const nextIsCoordinator = (coordinatorRes.count || 0) > 0;

        lastLoadedUserIdRef.current = targetUserId;
        hasLoadedForUserRef.current = !hasQueryError;

        setClientAuthState({
          userId: targetUserId,
          isAdmin: nextIsAdmin,
          isObserver: nextIsObserver,
          hasAssignment: nextHasAssignment,
          isCoordinator: nextIsCoordinator,
        });
      } catch (err) {
        console.error('Sidebar yetki kontrolü hatası:', err);
      } finally {
        inFlightRef.current = false;
        const queued = queuedRefreshRef.current;
        if (queued && isMountedRef.current) {
          queuedRefreshRef.current = null;
          scheduleRefresh(queued.hintUserId, queued.force);
        }
      }
    };

    if (!initialUserId || !serverHasPermissions) {
      scheduleRefresh(initialUserId || undefined, false);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMountedRef.current) return;

      if (event === 'SIGNED_OUT') {
        clearScheduledRefresh();
        queuedRefreshRef.current = null;
        lastLoadedUserIdRef.current = null;
        hasLoadedForUserRef.current = false;
        setClientAuthState({
          userId: '',
          isAdmin: false,
          isObserver: false,
          hasAssignment: false,
          isCoordinator: false,
        });
        setUnreadCount(0);
        return;
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        const nextUserId = session?.user?.id;
        const shouldRefresh =
          event === 'USER_UPDATED' ||
          !hasLoadedForUserRef.current ||
          (Boolean(nextUserId) && lastLoadedUserIdRef.current !== nextUserId);
        if (shouldRefresh) {
          scheduleRefresh(nextUserId, true);
        }
      }
    });

    return () => {
      isMountedRef.current = false;
      clearScheduledRefresh();
      queuedRefreshRef.current = null;
      subscription.unsubscribe();
    };
  }, [initialUserId, serverHasPermissions]);

  useEffect(() => {
    if (!userId) return;

    async function fetchUnreadCount() {
      const { data: allAnns } = await supabase.from('duyurular').select('id');
      const { data: readAnns } = await supabase.from('duyuru_okumalar').select('duyuru_id').eq('kullanici_id', userId);
      
      const allIds = allAnns?.map(a => a.id) || [];
      const readIds = new Set(readAnns?.map(r => r.duyuru_id) || []);
      const unread = allIds.filter(id => !readIds.has(id)).length;
      
      setUnreadCount(unread);
    }

    fetchUnreadCount();

    const duyurularChannel = supabase
      .channel('sidebar_duyurular')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duyurular', filter: `alici_id=eq.${userId}` }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'duyuru_okumalar', filter: `kullanici_id=eq.${userId}` }, () => {
        fetchUnreadCount();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'duyurular', filter: `alici_id=eq.${userId}` }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(duyurularChannel);
    };
  }, [userId]);

  const getLinkClass = (path: string, exact: boolean = false) => {
    const isActive = exact ? pathname === path : pathname.startsWith(path);
    return `flex items-center gap-3 px-4 py-3 transition-all duration-300 text-sm group rounded-xl mx-2 ${
      isActive 
        ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' 
        : 'text-slate-200 hover:bg-slate-800/50 hover:text-white'
    }`;
  };

  const showFullMenu = isAdmin || isObserver || hasAssignment || isCoordinator;

  return (
    <>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {showFullMenu && (
          <>
            <Link href="/olcutler" className={getLinkClass('/olcutler')}>
              <Home className="w-5 h-5 flex-shrink-0" />
              {t('dashboard')}
            </Link>
            {(isAdmin || isObserver) && (
              <Link href="/izleme" className={getLinkClass('/izleme')}>
                <BarChart2 className="w-5 h-5 flex-shrink-0" />
                {t('tracking')}
              </Link>
            )}
            {(isAdmin || isCoordinator) && (
              <>
                <Link href="/aktivite-gunlugu" className={getLinkClass('/aktivite-gunlugu')}>
                  <History className="w-5 h-5 flex-shrink-0" />
                  {t('audit_log')}
                </Link>
                <Link href="/dis-kanitlar" className={getLinkClass('/dis-kanitlar')}>
                  <Inbox className="w-5 h-5 flex-shrink-0" />
                  {t('external_evidence')}
                </Link>
              </>
            )}
            {isCoordinator && (
              <>
                <Link href="/birim-atamalari" className={getLinkClass('/birim-atamalari')}>
                  <Users className="w-5 h-5 flex-shrink-0" />
                  {t('unit_assignments')}
                </Link>
                <Link href="/veri-onayi" className={getLinkClass('/veri-onayi')}>
                  <FileCheck className="w-5 h-5 flex-shrink-0" />
                  {t('data_approval')}
                </Link>
              </>
            )}
          </>
        )}

        <Link href="/izlenceler" className={getLinkClass('/izlenceler')}>
          <GraduationCap className="w-5 h-5 flex-shrink-0" />
          {t('syllabi')}
        </Link>
        {(isAdmin || isObserver) && (
          <div className="ltr:pl-6 rtl:pr-6">
            <Link href="/izlence-takip" className={getLinkClass('/izlence-takip')}>
              <BarChart2 className="w-4 h-4 flex-shrink-0" />
              {t('syllabus_data')}
            </Link>
          </div>
        )}

        {/* Generic Links */}
        <div className="pt-2">
          {showFullMenu && (
            <>
              <Link href="/bildirimler" className={getLinkClass('/bildirimler')}>
                <Bell className="w-5 h-5 flex-shrink-0" />
                {t('notifications')}
              </Link>
              <Link href="/takvim" className={getLinkClass('/takvim')}>
                <Calendar className="w-5 h-5 flex-shrink-0" />
                {t('calendar')}
              </Link>
              {(isAdmin || isObserver) && (
                <>
                  <Link href="/kalite-el-kitabi" className={getLinkClass('/kalite-el-kitabi')}>
                    <BookOpen className="w-5 h-5 flex-shrink-0" />
                    {tQM('title')}
                  </Link>
                </>
              )}
              {(isAdmin || isObserver || isCoordinator) && (
                <>
                  <Link href="/anket-yonetimi" className={getLinkClass('/anket-yonetimi')}>
                    <Activity className="w-5 h-5 flex-shrink-0" />
                    {t('survey_management')}
                  </Link>
                </>
              )}
              {(isAdmin || isObserver) && (
                <>
                  <Link href="/raporlar" className={getLinkClass('/raporlar')}>
                    <LineChart className="w-5 h-5 flex-shrink-0" />
                    {t('reports')}
                  </Link>
                  <Link href="/onerilenler" className={getLinkClass('/onerilenler')}>
                    <Lightbulb className="w-5 h-5 flex-shrink-0" />
                    {t('suggestions')}
                  </Link>
                  <Link href="/dokumanlar" className={getLinkClass('/dokumanlar')}>
                    <FolderOpen className="w-5 h-5 flex-shrink-0" />
                    {t('documents')}
                  </Link>
                </>
              )}
            </>
          )}
          <Link href="/duyurular" className={getLinkClass('/duyurular')}>
            <div className="relative">
              <Megaphone className="w-5 h-5 flex-shrink-0" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 ltr:-right-1 rtl:-left-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-1 ring-white">
                  {unreadCount}
                </span>
              )}
            </div>
            {tAnn('title')}
          </Link>
        </div>
      </nav>
      
      <div className="p-4 border-t border-[#1e293b] mt-auto space-y-1">
        {(isAdmin || isObserver) && (
          <>
            <Link href="/donem-yonetimi" className={getLinkClass('/donem-yonetimi')}>
              <Calendar className="w-5 h-5 flex-shrink-0" />
              {t('periods')}
            </Link>
            <Link href="/atamalar" className={getLinkClass('/atamalar')}>
              <Settings className="w-5 h-5 flex-shrink-0" />
              {t('assignments')}
            </Link>
            <Link href="/koordinatorler" className={getLinkClass('/koordinatorler')}>
              <ClipboardCheck className="w-5 h-5 flex-shrink-0" />
              {t('coordinators')}
            </Link>
          </>
        )}
        <LogoutButton />
      </div>
    </>
  );
}
