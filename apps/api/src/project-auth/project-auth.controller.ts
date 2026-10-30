import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProjectAuthService } from './project-auth.service';
import { SignUpDto } from './dto/signup.dto';
import { SignInDto } from './dto/signin.dto';
import { MagicLinkDto } from './dto/magic-link.dto';

@Controller('projects/:projectSlug/auth')
export class ProjectAuthController {
  constructor(
    private projectAuthService: ProjectAuthService,
    private configService: ConfigService,
  ) {}

  @Post('signup')
  signUp(@Param('projectSlug') projectSlug: string, @Body() dto: SignUpDto) {
    return this.projectAuthService.signUp(projectSlug, dto);
  }

  @Post('signin')
  signIn(@Param('projectSlug') projectSlug: string, @Body() dto: SignInDto) {
    return this.projectAuthService.signIn(projectSlug, dto);
  }

  @Post('magic-link')
  sendMagicLink(
    @Param('projectSlug') projectSlug: string,
    @Body() dto: MagicLinkDto,
  ) {
    return this.projectAuthService.sendMagicLink(projectSlug, dto.email);
  }

  @Get('magic-link/verify')
  async verifyMagicLink(
    @Param('projectSlug') projectSlug: string,
    @Query('token') token: string,
    @Res() res: Response,
  ) {
    const result = await this.projectAuthService.verifyMagicLink(
      projectSlug,
      token,
    );
    const siteUrl =
      await this.projectAuthService.getSiteUrlForProject(projectSlug);
    return res.redirect(
      this.buildAuthRedirectUrl(siteUrl, result.accessToken),
    );
  }

  @Get('google')
  async googleLogin(
    @Param('projectSlug') projectSlug: string,
    @Res() res: Response,
  ) {
    const settings =
      await this.projectAuthService.getOAuthSettings(projectSlug);
    if (!settings.googleClientId) {
      return res.status(400).json({ message: 'Google OAuth not configured' });
    }

    const apiUrl = this.configService.get<string>('API_URL');
    const redirectUri = `${apiUrl}/projects/${projectSlug}/auth/google/callback`;
    const url = this.projectAuthService.buildGoogleAuthUrl(
      settings.googleClientId,
      redirectUri,
    );
    return res.redirect(url);
  }

  private buildAuthRedirectUrl(siteUrl: string, accessToken: string): string {
    const fragmentParams = new URLSearchParams({
      access_token: accessToken,
      token_type: 'bearer',
    });
    try {
      const url = new URL(siteUrl);
      url.hash = fragmentParams.toString();
      return url.toString();
    } catch {
      const cleanUrl = siteUrl.replace(/\/+$/, '');
      return `${cleanUrl}/#${fragmentParams.toString()}`;
    }
  }

  @Get('google/callback')
  async googleCallback(
    @Param('projectSlug') projectSlug: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const result = await this.projectAuthService.handleGoogleCallback(
      projectSlug,
      code,
    );
    const webUrl =
      await this.projectAuthService.getSiteUrlForProject(projectSlug);
    return res.redirect(this.buildAuthRedirectUrl(webUrl, result.accessToken));
  }

  @Get('github')
  async githubLogin(
    @Param('projectSlug') projectSlug: string,
    @Res() res: Response,
  ) {
    const settings =
      await this.projectAuthService.getOAuthSettings(projectSlug);
    if (!settings.githubClientId) {
      return res.status(400).json({ message: 'GitHub OAuth not configured' });
    }

    const apiUrl = this.configService.get<string>('API_URL');
    const redirectUri = `${apiUrl}/projects/${projectSlug}/auth/github/callback`;
    const url = this.projectAuthService.buildGithubAuthUrl(
      settings.githubClientId,
      redirectUri,
    );
    return res.redirect(url);
  }

  @Get('github/callback')
  async githubCallback(
    @Param('projectSlug') projectSlug: string,
    @Query('code') code: string,
    @Res() res: Response,
  ) {
    const result = await this.projectAuthService.handleGithubCallback(
      projectSlug,
      code,
    );
    const webUrl =
      await this.projectAuthService.getSiteUrlForProject(projectSlug);
    return res.redirect(this.buildAuthRedirectUrl(webUrl, result.accessToken));
  }
}
