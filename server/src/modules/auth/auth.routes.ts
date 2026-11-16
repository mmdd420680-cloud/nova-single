import crypto from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { UserModel } from '../users/user.model';
import { requireDatabase } from '../../database/connection';
import { authenticateRequired, signAuthToken, type AuthenticatedRequest } from '../../middleware/auth.middleware';
import { AppError } from '../../middleware/error.middleware';
import { env, integrations } from '../../config/env';
import { sendTransactionalEmail } from '../../services/email.service';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, code: 'RATE_LIMITED', error: 'Too many authentication attempts. Please try again shortly.' },
});

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email address is required').toLowerCase(),
  phone: z.string().trim().min(10, 'Valid Bangladesh phone number is required').max(20).optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

const loginSchema = z.object({
  email: z.string().trim().email('Valid email is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

function setAuthCookie(res: Response, token: string): void {
  res.cookie('novara_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.COOKIE_SECURE || env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function serializeUser(user: {
  _id: unknown;
  name: string;
  email: string;
  phone?: string;
  role: string;
  customPermissions?: string[];
  isVerified: boolean;
  notificationPrefs?: { orderUpdates: boolean; promotions: boolean; backInStock: boolean };
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone || '',
    role: user.role,
    customPermissions: user.customPermissions || [],
    isVerified: user.isVerified,
    notificationPrefs: user.notificationPrefs || {
      orderUpdates: true,
      promotions: false,
      backInStock: true,
    },
  };
}

router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    providers: {
      emailPassword: true,
      google: integrations.googleOAuth,
      facebook: integrations.facebookOAuth,
    },
  });
});

router.post('/register', authLimiter, requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = registerSchema.parse(req.body);
    const existing = await UserModel.findOne({ email: parsed.email });
    if (existing) {
      throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(parsed.password, 12);
    const rawVerifyToken = crypto.randomBytes(24).toString('hex');
    const verificationTokenHash = crypto.createHash('sha256').update(rawVerifyToken).digest('hex');

    const user = await UserModel.create({
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone,
      passwordHash,
      role: 'customer',
      isVerified: !integrations.resend, // Auto-verified only when email delivery isn't configured, else requires verification link
      verificationTokenHash,
      notificationPrefs: { orderUpdates: true, promotions: false, backInStock: true },
    });

    if (integrations.resend) {
      const verifyUrl = `${env.CLIENT_URL}/verify-email?token=${rawVerifyToken}&email=${encodeURIComponent(user.email)}`;
      await sendTransactionalEmail({
        to: user.email,
        template: 'account_verification',
        subject: 'Verify your NOVARA COMMERCE account',
        html: `<p>Welcome to NOVARA COMMERCE, ${user.name}.</p><p>Please verify your email address: <a href="${verifyUrl}">Verify Account</a></p>`,
      });
    }

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    res.status(201).json({
      ok: true,
      user: serializeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/login', authLimiter, requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const user = await UserModel.findOne({ email: parsed.email }).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    if (user.status !== 'active') {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account has been suspended. Please contact support.');
    }

    const valid = await bcrypt.compare(parsed.password, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signAuthToken(user);
    setAuthCookie(res, token);

    res.json({
      ok: true,
      user: serializeUser(user),
      token,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('novara_token', { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireDatabase, authenticateRequired, (req: AuthenticatedRequest, res: Response) => {
  res.json({ ok: true, user: serializeUser(req.user!) });
});

router.patch('/profile', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      name: z.string().trim().min(2).max(100),
      phone: z.string().trim().max(24).optional(),
      notificationPrefs: z
        .object({
          orderUpdates: z.boolean(),
          promotions: z.boolean(),
          backInStock: z.boolean(),
        })
        .optional(),
    });
    const parsed = schema.parse(req.body);
    const user = req.user!;
    user.name = parsed.name;
    if (parsed.phone !== undefined) user.phone = parsed.phone;
    if (parsed.notificationPrefs) user.notificationPrefs = parsed.notificationPrefs;
    await user.save();
    res.json({ ok: true, user: serializeUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/change-password', requireDatabase, authenticateRequired, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.parse(req.body);
    const user = await UserModel.findById(req.user!._id).select('+passwordHash');
    if (!user || !user.passwordHash) {
      throw new AppError(400, 'NO_PASSWORD_SET', 'This account uses external OAuth login.');
    }
    const valid = await bcrypt.compare(parsed.currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect.');
    }
    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    await user.save();
    res.json({ ok: true, message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', authLimiter, requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = z.object({ email: z.string().email().toLowerCase() }).parse(req.body);
    const user = await UserModel.findOne({ email });
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      user.resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();

      const resetUrl = `${env.CLIENT_URL}/?resetToken=${rawToken}&email=${encodeURIComponent(user.email)}`;
      await sendTransactionalEmail({
        to: user.email,
        template: 'password_reset',
        subject: 'Reset your NOVARA COMMERCE password',
        html: `<p>Click the link below to reset your password (valid for 30 minutes):</p><p><a href="${resetUrl}">Reset Password</a></p>`,
      });
    }
    res.json({
      ok: true,
      message: 'If an account matches that email, password reset instructions have been sent.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', authLimiter, requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = z.object({
      email: z.string().email().toLowerCase(),
      token: z.string().min(10),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.parse(req.body);
    const tokenHash = crypto.createHash('sha256').update(parsed.token).digest('hex');

    const user = await UserModel.findOne({
      email: parsed.email,
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset link is invalid or has expired.');
    }

    user.passwordHash = await bcrypt.hash(parsed.newPassword, 12);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    res.json({ ok: true, message: 'Your password has been reset. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

// Real Google OAuth authorization endpoint
router.get('/oauth/google', (_req: Request, res: Response) => {
  if (!integrations.googleOAuth) {
    res.status(503).json({
      ok: false,
      code: 'OAUTH_UNCONFIGURED',
      error: 'Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing).',
    });
    return;
  }
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/api/auth/oauth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get('/oauth/google/callback', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!integrations.googleOAuth) {
      throw new AppError(503, 'OAUTH_UNCONFIGURED', 'Google OAuth is not configured.');
    }
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_cancelled`);
      return;
    }

    const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${env.APP_URL}/api/auth/oauth/google/callback`,
        grant_type: 'authorization_code',
      }).toString(),
    });
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenResp.ok || !tokenData.access_token) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_token_failed`);
      return;
    }

    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = (await userInfoResp.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!profile.email || !profile.sub) {
      res.redirect(`${env.CLIENT_URL}/?authError=google_profile_missing`);
      return;
    }

    let user = await UserModel.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        name: profile.name || profile.email.split('@')[0],
        email: profile.email.toLowerCase(),
        role: 'customer',
        isVerified: Boolean(profile.email_verified),
        oauthProviders: { googleId: profile.sub },
      });
    } else if (!user.oauthProviders?.googleId) {
      user.oauthProviders = { ...user.oauthProviders, googleId: profile.sub };
      await user.save();
    }

    const jwtToken = signAuthToken(user);
    setAuthCookie(res, jwtToken);
    res.redirect(`${env.CLIENT_URL}/?oauth=success`);
  } catch (err) {
    next(err);
  }
});

// Real Facebook OAuth authorization endpoint
router.get('/oauth/facebook', (_req: Request, res: Response) => {
  if (!integrations.facebookOAuth) {
    res.status(503).json({
      ok: false,
      code: 'OAUTH_UNCONFIGURED',
      error: 'Facebook OAuth is not configured (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET missing).',
    });
    return;
  }
  const params = new URLSearchParams({
    client_id: env.FACEBOOK_APP_ID,
    redirect_uri: `${env.APP_URL}/api/auth/oauth/facebook/callback`,
    scope: 'email,public_profile',
    response_type: 'code',
  });
  res.redirect(`https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`);
});

router.get('/oauth/facebook/callback', requireDatabase, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!integrations.facebookOAuth) {
      throw new AppError(503, 'OAUTH_UNCONFIGURED', 'Facebook OAuth is not configured.');
    }
    const code = String(req.query.code || '');
    if (!code) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_cancelled`);
      return;
    }

    const tokenUrl = new URL('https://graph.facebook.com/v20.0/oauth/access_token');
    tokenUrl.searchParams.set('client_id', env.FACEBOOK_APP_ID);
    tokenUrl.searchParams.set('client_secret', env.FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set('redirect_uri', `${env.APP_URL}/api/auth/oauth/facebook/callback`);
    tokenUrl.searchParams.set('code', code);

    const tokenResp = await fetch(tokenUrl.toString());
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenResp.ok || !tokenData.access_token) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_token_failed`);
      return;
    }

    const meResp = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(tokenData.access_token)}`,
    );
    const profile = (await meResp.json()) as { id?: string; name?: string; email?: string };
    if (!profile.email || !profile.id) {
      res.redirect(`${env.CLIENT_URL}/?authError=facebook_email_missing`);
      return;
    }

    let user = await UserModel.findOne({ email: profile.email.toLowerCase() });
    if (!user) {
      user = await UserModel.create({
        name: profile.name || 'Facebook Customer',
        email: profile.email.toLowerCase(),
        role: 'customer',
        isVerified: true,
        oauthProviders: { facebookId: profile.id },
      });
    } else if (!user.oauthProviders?.facebookId) {
      user.oauthProviders = { ...user.oauthProviders, facebookId: profile.id };
      await user.save();
    }

    const jwtToken = signAuthToken(user);
    setAuthCookie(res, jwtToken);
    res.redirect(`${env.CLIENT_URL}/?oauth=success`);
  } catch (err) {
    next(err);
  }
});

export default router;
