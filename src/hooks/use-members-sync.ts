'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Member } from '@/lib/types';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';

interface UseMembersSyncOptions {
  autoRefreshInterval?: number; // in milliseconds, default 5 minutes
  enableAutoRefresh?: boolean;
  enableCrossBrowserSync?: boolean;
  enableInitialFetch?: boolean; // Whether to fetch data on mount
}

interface UseMembersSyncReturn {
  members: Member[];
  loading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncTime: Date | null;
  fetchMembers: (forceRefresh?: boolean) => Promise<void>;
  clearCache: () => void;
}

export function useMembersSync(options: UseMembersSyncOptions = {}): UseMembersSyncReturn {
  const {
    autoRefreshInterval = 5 * 60 * 1000, // 5 minutes
    enableAutoRefresh = false, // Disabled by default
    enableCrossBrowserSync = false, // Disabled by default
    enableInitialFetch = false, // Disabled by default
  } = options;

  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'error'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // Use ref to track sync status without causing dependency loops
  const syncStatusRef = useRef(syncStatus);
  syncStatusRef.current = syncStatus;

  const cacheKey = 'members_cache';
  const cacheTimestampKey = 'members_cache_timestamp';
  const cacheVersionKey = 'members_cache_version';

  const clearCache = useCallback(() => {
    if (process.env.NODE_ENV === 'production') {
      localStorage.removeItem(cacheKey);
      localStorage.removeItem(cacheTimestampKey);
      localStorage.removeItem(cacheVersionKey);
      console.log('🗑️ Cache cleared');
    } else {
      console.log('🔄 Development mode: No cache to clear');
    }
  }, []);

  const fetchMembers = useCallback(async (forceRefresh = false) => {
    if (authLoading || !user) return;

    // Prevent multiple simultaneous requests
    if (syncStatusRef.current === 'syncing' && !forceRefresh) {
      console.log('🔄 Already syncing, skipping request');
      return;
    }

    setLoading(true);
    setSyncStatus('syncing');
    
    // Set a timeout to prevent stuck syncing state
    const syncTimeout = setTimeout(() => {
      console.warn('⚠️ Sync timeout reached, resetting status');
      setSyncStatus('error');
      setLoading(false);
    }, 30000); // 30 seconds timeout
    
    if (process.env.NODE_ENV !== 'production') {
      console.log('🔄 Development mode: Cache disabled, fetching fresh data');
    }
    
    try {
      // In development, always use no-cache
      const isDevelopment = process.env.NODE_ENV !== 'production';
      const cacheBuster = (forceRefresh || isDevelopment) ? `?t=${Date.now()}` : '';
      
      const response = await fetch(`/api/members${cacheBuster}`, {
        cache: (forceRefresh || isDevelopment) ? 'no-store' : 'default',
        headers: {
          'Cache-Control': (forceRefresh || isDevelopment) ? 'no-cache' : 'default',
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', {
          status: response.status,
          statusText: response.statusText,
          url: response.url,
          body: errorText
        });
        throw new Error(`Failed to fetch members: ${response.status} ${response.statusText} - ${errorText}`);
      }
      
      const allMembers = await response.json();
      console.log('📊 Members fetched from server:', allMembers.length);

      // Update cache with fresh data (only in production)
      if (process.env.NODE_ENV === 'production') {
        try {
          const currentVersion = Date.now().toString();
          localStorage.setItem(cacheKey, JSON.stringify(allMembers));
          localStorage.setItem(cacheTimestampKey, currentVersion);
          localStorage.setItem(cacheVersionKey, currentVersion);
          
          // Broadcast cache update to other tabs
          if (enableCrossBrowserSync) {
            window.dispatchEvent(new CustomEvent('membersUpdated', { 
              detail: { members: allMembers, version: currentVersion } 
            }));
          }
        } catch (error) {
          console.error('Error saving to cache:', error);
        }
      } else {
        console.log('🔄 Development mode: Skipping localStorage cache');
        
        // Still broadcast to other tabs for cross-browser sync
        if (enableCrossBrowserSync) {
          window.dispatchEvent(new CustomEvent('membersUpdated', { 
            detail: { members: allMembers, version: Date.now().toString() } 
          }));
        }
      }

      setMembers(allMembers);
      setLastSyncTime(new Date());
      setSyncStatus('idle');
    } catch (error) {
      console.error('Error fetching members:', error);
      setSyncStatus('error');
      
      // Try to load from cache as fallback (only in production)
      if (!forceRefresh && process.env.NODE_ENV === 'production') {
        try {
          const cachedData = localStorage.getItem(cacheKey);
          if (cachedData) {
            const allMembers = JSON.parse(cachedData);
            console.log('📊 Members loaded from cache (fallback):', allMembers.length);
            setMembers(allMembers);
            setLastSyncTime(new Date());
            setSyncStatus('idle');
            setLoading(false);
            
            toast({
              title: 'Modo sin conexión',
              description: 'Mostrando datos guardados localmente.',
              variant: 'default'
            });
            return;
          }
        } catch (cacheError) {
          console.error('Error loading from cache:', cacheError);
        }
      } else if (process.env.NODE_ENV !== 'production') {
        console.log('🔄 Development mode: No cache fallback, showing error directly');
      }
      
      // Show detailed error message with solution
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      
      if (errorMessage.includes('permissions') || errorMessage.includes('Missing or insufficient')) {
        toast({
          title: 'Error de permisos de Firebase',
          description: 'Configura las reglas de Firestore. Ve a SOLUCION_FIREBASE.md para instrucciones.',
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Error de conexión',
          description: `No se pudieron cargar los miembros: ${errorMessage}`,
          variant: 'destructive'
        });
      }
      
      // Set empty array if no cache available
      setMembers([]);
    } finally {
      // Clear the timeout
      clearTimeout(syncTimeout);
      setLoading(false);
      // Always set to idle in finally block to ensure state is reset
      setSyncStatus('idle');
    }
  }, [authLoading, user, toast, enableCrossBrowserSync]);

  // Initial fetch - only when explicitly enabled
  useEffect(() => {
    if (enableInitialFetch) {
      fetchMembers();
    }
  }, [enableInitialFetch, fetchMembers]);

  // Cross-browser sync listeners
  useEffect(() => {
    if (!enableCrossBrowserSync) return;

    const handleMembersUpdate = (event: CustomEvent) => {
      console.log('📡 Received members update from another tab');
      setMembers(event.detail.members);
      setLastSyncTime(new Date());
      toast({
        title: 'Lista actualizada',
        description: 'Los miembros se han sincronizado automáticamente.',
      });
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === cacheKey && event.newValue) {
        try {
          const updatedMembers = JSON.parse(event.newValue);
          console.log('📡 Received members update from storage change');
          setMembers(updatedMembers);
          setLastSyncTime(new Date());
        } catch (error) {
          console.error('Error parsing updated members from storage:', error);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - sync disabled by default
        console.log('👁️ Page became visible, but auto-sync is disabled');
        // fetchMembers(); // Disabled
      }
    };

    // Add event listeners
    window.addEventListener('membersUpdated', handleMembersUpdate as EventListener);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('membersUpdated', handleMembersUpdate as EventListener);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enableCrossBrowserSync, fetchMembers, toast]);

  // Auto-refresh interval
  useEffect(() => {
    if (!enableAutoRefresh) return;

    const autoRefreshIntervalId = setInterval(() => {
      if (!document.hidden) {
        console.log('🔄 Auto-refreshing members data');
        fetchMembers();
      }
    }, autoRefreshInterval);

    return () => clearInterval(autoRefreshIntervalId);
  }, [enableAutoRefresh, autoRefreshInterval, fetchMembers]);

  return {
    members,
    loading,
    syncStatus,
    lastSyncTime,
    fetchMembers,
    clearCache,
  };
}