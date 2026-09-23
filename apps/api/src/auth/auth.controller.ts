import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { COOKIE_KEYS } from '@orion-db/constants';
import type { JwtPayload } from '@orion-db/types';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.register(dto);
    this.authService.setTokenCookies(res, tokens);
    return { message: 'Registered successfully' };
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto);
    this.authService.setTokenCookies(res, tokens);
    return { message: 'Logged in successfully' };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    this.authService.clearCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.[COOKIE_KEYS.REFRESH_TOKEN];
    if (!refreshToken) {
      return { message: 'No refresh token' };
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    this.authService.setTokenCookies(res, tokens);
    return { message: 'Tokens refreshed' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }

  @Get('google')
  googleLogin(@Res() res: Response) {
    const state = this.authService.createOAuthState();
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie(COOKIE_KEYS.OAUTH_STATE, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.authService.getGoogleAuthUrl(state));
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=no_code`);
    }
    if (!state || state !== req.cookies?.[COOKIE_KEYS.OAUTH_STATE]) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=invalid_oauth_state`);
    }
    res.clearCookie(COOKIE_KEYS.OAUTH_STATE);
    const tokens = await this.authService.handleGoogleCallback(code);
    this.authService.setTokenCookies(res, tokens);
    return res.redirect(`${this.configService.get<string>('WEB_URL')}/login`);
  }

  @Get('github')
  githubLogin(@Res() res: Response) {
    const state = this.authService.createOAuthState();
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    res.cookie(COOKIE_KEYS.OAUTH_STATE, state, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 10 * 60 * 1000,
    });
    return res.redirect(this.authService.getGithubAuthUrl(state));
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=no_code`);
    }
    if (!state || state !== req.cookies?.[COOKIE_KEYS.OAUTH_STATE]) {
      return res.redirect(`${this.configService.get<string>('WEB_URL')}/login?error=invalid_oauth_state`);
    }
    res.clearCookie(COOKIE_KEYS.OAUTH_STATE);
    const tokens = await this.authService.handleGithubCallback(code);
    this.authService.setTokenCookies(res, tokens);
    return res.redirect(
      `${this.configService.get<string>('WEB_URL')}/dashboard`,
    );
  }
}
