import { NextResponse, type NextRequest } from 'next/server';

const apiOrigin = process.env.PETAL_API_INTERNAL_URL ?? 'http://127.0.0.1:8000';

export async function proxy(request: NextRequest) {
  const isLoginPage = request.nextUrl.pathname === '/login';

  try {
    const response = await fetch(`${apiOrigin}/api/auth/session`, {
      headers: { cookie: request.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });

    if (response.status === 401) {
      return isLoginPage
        ? NextResponse.next()
        : NextResponse.redirect(new URL('/login', request.url));
    }

    if (!response.ok) {
      return new NextResponse('Authentication service is unavailable.', { status: 503 });
    }

    return isLoginPage
      ? NextResponse.redirect(new URL('/', request.url))
      : NextResponse.next();
  } catch (error) {
    console.error('Authentication service request failed:', error);
    return new NextResponse('Authentication service is unavailable.', { status: 503 });
  }
}

export const config = {
  matcher: ['/', '/login', '/projects/:path*'],
};
