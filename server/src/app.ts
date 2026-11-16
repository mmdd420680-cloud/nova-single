import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env, integrations } from './config/env';
import { getDatabaseStatus } from './database/connection';
import { errorHandler } from './middleware/error.middleware';
import authRoutes from './modules/auth/auth.routes';
import productRoutes from './modules/products/product.routes';
import cartRoutes from './modules/cart/cart.routes';
import orderRoutes from './modules/orders/order.routes';
import paymentRoutes from './modules/payments/payment.routes';
import storefrontRoutes, { sitemapHandler } from './modules/storefront/storefront.routes';
import adminCatalogRoutes from './modules/admin/admin.catalog.routes';
import adminOperationsRoutes from './modules/admin/admin.operations.routes';
import adminCmsRoutes from './modules/admin/admin.cms.routes';

export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use((req, res, next) => {
    const hostHeader = req.get('x-forwarded-host') || req.get('host');
    const protoHeader = req.get('x-forwarded-proto') || req.protocol || 'https';
    const allowedOrigins = new Set<string>([env.CLIENT_URL, env.APP_URL].filter(Boolean));
    if (hostHeader) {
      allowedOrigins.add(`${protoHeader}://${hostHeader}`);
      allowedOrigins.add(`https://${hostHeader}`);
      allowedOrigins.add(`http://${hostHeader}`);
    }

    cors({
      origin: (origin, callback) => {
        if (!origin || env.NODE_ENV !== 'production' || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
    })(req, res, next);
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use(cookieParser());

  // Container nginx sets `proxy_intercept_errors on` with `error_page 502 503 504 = /warmup.html`
  // and `error_page 403 = /forbidden.html`, which replaces backend JSON errors with HTML pages.
  // Map those statuses to proxy-passthrough 4xx codes ONLY for requests arriving via that nginx proxy,
  // preserving standard 503/403 JSON on direct Express connections.
  app.use('/api', (req, res, next) => {
    const hasNginxWarmupProxy =
      Boolean(process.env.NGINX_PORT) || fs.existsSync('/var/www/assets/warmup.html');
    const viaProxy = hasNginxWarmupProxy && Boolean(req.get('x-forwarded-host'));

    if (viaProxy) {
      const originalStatus = res.status.bind(res);
      res.status = ((code: number) => {
        if (code === 502 || code === 503 || code === 504) {
          res.setHeader('X-Origin-Status', String(code));
          return originalStatus(424);
        }
        if (code === 403) {
          res.setHeader('X-Origin-Status', '403');
          return originalStatus(423);
        }
        return originalStatus(code);
      }) as Response['status'];
    }
    next();
  });

  app.use(
    '/api',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 180,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => req.path === '/health',
      message: {
        ok: false,
        code: 'RATE_LIMITED',
        error: 'Too many API requests. Please wait a moment and retry.',
      },
    }),
  );

  // Prevent stale browser/CDN caching on dynamic catalog, storefront, and admin endpoints
  const noStoreDynamicCache = (_req: Request, res: Response, next: express.NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  };

  // Health & readiness probe
  app.get('/api/health', noStoreDynamicCache, (_req: Request, res: Response) => {
    const db = getDatabaseStatus();
    const statusCode = db.connected ? 200 : 503;
    res.status(statusCode).json({
      ok: db.connected,
      service: 'novara-commerce',
      database: db.connected ? 'connected' : db.connecting ? 'connecting' : 'disconnected',
      databaseError: db.error,
      integrations,
      timestamp: new Date().toISOString(),
    });
  });

  // SEO robots & sitemap
  app.get('/robots.txt', (_req: Request, res: Response) => {
    const base = env.APP_URL.replace(/\/$/, '');
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /cart\nDisallow: /account\nSitemap: ${base}/sitemap.xml\n`,
    );
  });
  app.get(['/sitemap.xml', '/seo/sitemap.xml'], sitemapHandler);

  app.use('/api/auth', authRoutes);
  app.use('/api/products', noStoreDynamicCache, productRoutes);
  app.use('/api/account', cartRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/storefront', noStoreDynamicCache, storefrontRoutes);

  // Modular Admin routes
  app.use('/api/admin', noStoreDynamicCache, adminCatalogRoutes);
  app.use('/api/admin', noStoreDynamicCache, adminOperationsRoutes);
  app.use('/api/admin', noStoreDynamicCache, adminCmsRoutes);

  // 404 for unknown /api and /api/* routes (never swallowed by Vite or SPA fallback)
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, code: 'API_NOT_FOUND', error: 'API endpoint not found.' });
  });

  app.use(errorHandler);
  return app;
}
