import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { COOKIE_KEYS } from '@orion-db/constants';
import type { AuthTokens, JwtPayload, OAuthProfile } from '@orion-db/types';
import { DrizzleService } from '../db/drizzle.service';
import { users, organizations, orgMembers } from '../db/schema';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { generateOrgSlug, upsertOAuthUser } from './oauth.helpers';

@Injectable()
export class AuthService {
  constructor(
    private drizzle: DrizzleService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // cookie helpers
  setTokenCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';

    res.cookie(COOKIE_KEYS.ACCESS_TOKEN, tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
    });
    res.cookie(COOKIE_KEYS.REFRESH_TOKEN, tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  clearCookies(res: Response) {
    res.clearCookie(COOKIE_KEYS.ACCESS_TOKEN);
    res.clearCookie(COOKIE_KEYS.REFRESH_TOKEN);
  }

  // JWT signing
  private signTokens(userId: string, email: string): AuthTokens {
    const payload: JwtPayload = { sub: userId, email };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: (this.configService.get('JWT_ACCESS_EXPIRES_IN') ??
        '15m') as JwtSignOptions['expiresIn'],
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: (this.configService.get('JWT_REFRESH_EXPIRES_IN') ??
        '7d') as JwtSignOptions['expiresIn'],
    });

    return { accessToken, refreshToken };
  }

  // email + password
  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (existing.length > 0) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const [user] = await this.drizzle.db
      .insert(users)
      .values({ email: dto.email, name: dto.name, passwordHash })
      .returning();

    const [org] = await this.drizzle.db
      .insert(organizations)
      .values({
        name: `${dto.name}'s Org`,
        slug: generateOrgSlug(dto.name),
      })
      .returning();

    await this.drizzle.db.insert(orgMembers).values({
      orgId: org.id,
      userId: user.id,
      role: 'admin',
    });

    return this.signTokens(user.id, user.email);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.email, dto.email))
      .limit(1);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signTokens(user.id, user.email);
  }

  /**
   * Sign in / sign up via an OAuth profile.
   * Upserts user + provider link, provisions a default org for new users,
   * and returns fresh tokens.
   */
  async oauthLogin(profile: OAuthProfile): Promise<AuthTokens> {
    const { user } = await upsertOAuthUser(this.drizzle.db, profile);
    return this.signTokens(user.id, user.email);
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const [user] = await this.drizzle.db
      .select()
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.signTokens(user.id, user.email);
  }

  createOAuthState(): string {
    return randomBytes(32).toString('base64url');
  }

  getGoogleAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>('GOOGLE_CLIENT_ID')!,
      redirect_uri: this.configService.get<string>('GOOGLE_CALLBACK_URL')!,
      response_type: 'code',
      scope: 'openid email profile',
      state,
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async handleGoogleCallback(code: string): Promise<AuthTokens> {
    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: this.configService.get<string>('GOOGLE_CLIENT_ID')!,
          client_secret: this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
          redirect_uri: this.configService.get<string>('GOOGLE_CALLBACK_URL')!,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        throw new UnauthorizedException('Failed to exchange Google OAuth code');
      }

      const tokenData = (await tokenRes.json()) as {
        access_token: string;
      };

      const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      if (!userRes.ok) {
        throw new UnauthorizedException('Failed to get Google profile');
      }

      const userData = (await userRes.json()) as {
        sub: string;
        email: string;
        name?: string;
        picture?: string;
      };

      const { user: dbUser } = await upsertOAuthUser(this.drizzle.db, {
        provider: 'google',
        providerAccountId: userData.sub,
        email: userData.email,
        name: userData.name || userData.email.split('@')[0],
        avatarUrl: userData.picture || null,
      });

      return this.signTokens(dbUser.id, dbUser.email);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Failed to authenticate with Google');
    }
  }

  getGithubAuthUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.configService.get<string>('GITHUB_CLIENT_ID')!,
      redirect_uri: this.configService.get<string>('GITHUB_CALLBACK_URL')!,
      scope: 'read:user user:email',
      state,
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleGithubCallback(code: string): Promise<AuthTokens> {
    const tokenRes = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: this.configService.get<string>('GITHUB_CLIENT_ID'),
          client_secret: this.configService.get<string>('GITHUB_CLIENT_SECRET'),
          code,
        }),
      },
    );

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
    };

    if (!tokenRes.ok || !tokenData.access_token) {
      throw new UnauthorizedException('Failed to exchange GitHub OAuth code');
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to get GitHub profile');
    }

    const userData = (await userRes.json()) as {
      id: number;
      email: string | null;
      name: string | null;
      login: string;
      avatar_url: string | null;
    };

    let email = userData.email;
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
      if (!emailsRes.ok) {
        throw new UnauthorizedException('Failed to get GitHub email');
      }
      const emails = (await emailsRes.json()) as Array<{
        email: string;
        primary: boolean;
      }>;
      const primary = emails.find((e) => e.primary);
      email = primary?.email ?? emails[0]?.email ?? '';
    }

    return this.oauthLogin({
      provider: 'github',
      providerAccountId: String(userData.id),
      email,
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url ?? null,
    });
  }
}
