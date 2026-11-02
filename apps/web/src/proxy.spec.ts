import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { COOKIE_KEYS } from '@orion/constants';
import * as jose from 'jose';
import { proxy } from './proxy';
import { assertAndReportWeb } from './test-logger';

describe('Frontend Middleware Proxy Protection (proxy)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_secret_for_proxy_unit_tests_123456';
    process.env.API_URL = 'http://127.0.0.1:3001/api';
  });

  // WEB-PROXY-01: Protected route redirection without credentials
  it('WEB-PROXY-01 | Protected dashboard route without token | Expected: Redirect to /login', async () => {
    const req = new NextRequest(new URL('http://localhost:3000/dashboard'));

    const response = await proxy(req);

    const isRedirect = response?.status === 307 || response?.status === 302;
    const location = response?.headers.get('location') || '';

    assertAndReportWeb(
      {
        id: 'WEB-PROXY-01',
        name: 'Protected route unauthorized redirection',
        scenario: 'pathname="/dashboard", cookies={}',
        expected: 'HTTP 307/302 Redirect to /login',
        actual: `status=${response?.status}, location="${location}"`,
      },
      () => {
        expect(isRedirect).toBe(true);
        expect(location).toContain('/login');
      },
    );
  });

  // WEB-PROXY-02: Authenticated user visiting /login redirected to /dashboard
  it('WEB-PROXY-02 | Authenticated user accessing /login | Expected: Redirect to /dashboard', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);
    const validToken = await new jose.SignJWT({
      sub: 'usr_1',
      email: 'test@orion.dev',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);

    const req = new NextRequest(new URL('http://localhost:3000/login'), {
      headers: {
        cookie: `${COOKIE_KEYS.ACCESS_TOKEN}=${validToken}`,
      },
    });

    const response = await proxy(req);
    const location = response?.headers.get('location') || '';

    assertAndReportWeb(
      {
        id: 'WEB-PROXY-02',
        name: 'Authenticated user auth-route redirection',
        scenario: 'pathname="/login", valid accessToken present',
        expected: 'HTTP 307/302 Redirect to /dashboard',
        actual: `status=${response?.status}, location="${location}"`,
      },
      () => {
        expect(response?.status === 307 || response?.status === 302).toBe(true);
        expect(location).toContain('/dashboard');
      },
    );
  });

  // WEB-PROXY-03: Gracefully handles backend ECONNREFUSED/fetch failure during session refresh
  it('WEB-PROXY-03 | Network failure during session refresh | Expected: Graceful redirect to /login without throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed: ECONNREFUSED')),
    );

    const req = new NextRequest(new URL('http://localhost:3000/dashboard'), {
      headers: {
        cookie: `${COOKIE_KEYS.REFRESH_TOKEN}=some-stale-refresh-token`,
      },
    });

    const response = await proxy(req);
    const location = response?.headers.get('location') || '';

    assertAndReportWeb(
      {
        id: 'WEB-PROXY-03',
        name: 'Graceful handling of backend connection refusal in proxy',
        scenario:
          'pathname="/dashboard", refreshToken present, API throws ECONNREFUSED',
        expected: 'HTTP 307/302 Redirect to /login without crashing',
        actual: `status=${response?.status}, location="${location}"`,
      },
      () => {
        expect(response?.status === 307 || response?.status === 302).toBe(true);
        expect(location).toContain('/login');
      },
    );
  });

  // WEB-PROXY-04: Successful session refresh updates cookies and permits access
  it('WEB-PROXY-04 | Successful session refresh | Expected: Permits access with refreshed cookies', async () => {
    const mockHeaders = new Headers();
    mockHeaders.append(
      'set-cookie',
      'access_token=new-access-token; Path=/; HttpOnly',
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          getSetCookie: () => [
            'access_token=new-access-token; Path=/; HttpOnly',
          ],
        },
      }),
    );

    const req = new NextRequest(new URL('http://localhost:3000/dashboard'), {
      headers: {
        cookie: `${COOKIE_KEYS.REFRESH_TOKEN}=valid-refresh-token`,
      },
    });

    const response = await proxy(req);

    assertAndReportWeb(
      {
        id: 'WEB-PROXY-04',
        name: 'Successful session refresh applies auth cookies and proceeds',
        scenario:
          'pathname="/dashboard", refreshToken present, API returns 200 with new cookies',
        expected: 'NextResponse.next() with set-cookie header attached',
        actual: `status=${response?.status}, cookies=${response?.headers.get('set-cookie')}`,
      },
      () => {
        expect(response?.status).toBe(200);
        expect(response?.headers.get('set-cookie')).toContain(
          'access_token=new-access-token',
        );
      },
    );
  });
});
