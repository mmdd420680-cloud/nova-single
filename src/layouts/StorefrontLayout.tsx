import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { StoreHeader } from '../components/layout/StoreHeader';
import { StoreFooter } from '../components/layout/StoreFooter';
import { ApiError, apiRequest, isAbortError } from '../services/api';
import type { CategoryItem, HomepageConfigData } from '../types/commerce';

interface StorefrontLayoutProps {
  children: ReactNode;
}

export function StorefrontLayout({ children }: StorefrontLayoutProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [settings, setSettings] = useState<{
    announcementBar?: HomepageConfigData['announcementBar'];
    contactInfo?: HomepageConfigData['contactInfo'];
  } | null>(null);
  const [serviceNotice, setServiceNotice] = useState<{
    kind: 'db' | 'api';
    message: string;
  } | null>(null);

  const loadNavigation = useCallback(async (signal?: AbortSignal, allowRetry = true) => {
    try {
      const res = await apiRequest<{
        ok: true;
        categories: CategoryItem[];
        settings: {
          announcementBar?: HomepageConfigData['announcementBar'];
          contactInfo?: HomepageConfigData['contactInfo'];
        } | null;
      }>('/api/storefront/navigation', { signal });
      setCategories(Array.isArray(res?.categories) ? res.categories : []);
      setSettings(res?.settings ?? null);
      setServiceNotice(null);
    } catch (err) {
      if (isAbortError(err)) return;

      if (err instanceof ApiError && err.code === 'DATABASE_UNAVAILABLE') {
        setServiceNotice({
          kind: 'db',
          message:
            'MongoDB Atlas Connection Required: Persistent catalog, accounts, and orders require MONGODB_URI to be configured in server environment variables.',
        });
        return;
      }

      // Retry once after brief delay in case Express backend is still warming up on cold start
      if (
        allowRetry &&
        err instanceof ApiError &&
        (err.code === 'INVALID_API_RESPONSE' || err.code === 'NETWORK_ERROR' || err.status === 502 || err.status === 504)
      ) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (!signal?.aborted) {
          await loadNavigation(signal, false);
        }
        return;
      }

      // Check health to distinguish missing Atlas config vs non-JSON / unreachable backend
      try {
        const healthResp = await fetch('/api/health', { cache: 'no-store', signal });
        const contentType = (healthResp.headers.get('content-type') || '').toLowerCase();
        if (contentType.includes('application/json')) {
          const healthData = (await healthResp.json().catch(() => null)) as {
            ok?: boolean;
            database?: string;
          } | null;
          if (
            healthResp.status === 503 ||
            healthResp.status === 424 ||
            healthData?.database === 'disconnected' ||
            healthData?.database === 'connecting' ||
            healthData?.ok === false
          ) {
            setServiceNotice({
              kind: 'db',
              message:
                'MongoDB Atlas Connection Required: Persistent catalog, accounts, and orders require MONGODB_URI to be configured in server environment variables.',
            });
            return;
          }
        }
        if (!contentType.includes('application/json')) {
          const bodySnippet = await healthResp.text().catch(() => '');
          setServiceNotice({
            kind: 'api',
            message: bodySnippet.includes('Starting Server...')
              ? 'Backend Express server is warming up. Please click Retry in a few seconds.'
              : 'Backend API returned a non-JSON response. Start the full-stack Express server (npm run dev / npm start) so /api/* routes resolve to JSON.',
          });
          return;
        }
      } catch (probeErr) {
        if (isAbortError(probeErr)) return;
      }

      if (err instanceof Error && err.message) {
        setServiceNotice({ kind: 'api', message: err.message });
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadNavigation(controller.signal);
    return () => controller.abort();
  }, [loadNavigation]);

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F8FC] text-[#0F1D3A]">
      {serviceNotice && (
        <div
          role="status"
          className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-950"
        >
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700" />
              <span>{serviceNotice.message}</span>
            </div>
            <button
              type="button"
              onClick={() => loadNavigation()}
              className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-2.5 py-1 font-semibold text-amber-900 hover:bg-amber-100"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          </div>
        </div>
      )}

      <StoreHeader categories={categories} announcement={settings?.announcementBar} />
      <main className="flex-1">{children}</main>
      <StoreFooter contactInfo={settings?.contactInfo} />
    </div>
  );
}
