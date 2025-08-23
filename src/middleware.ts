// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isOrgRoute = createRouteMatcher(['/organization/:path*']);
const isProjectRoute = createRouteMatcher(['/project/:path*']);
const isProfileApiRoute = (req: Request) => {
  const url = new URL(req.url);
  return url.pathname.startsWith('/api/profile/');
};

export default clerkMiddleware(async (auth, req) => {
  // Allow profile API routes to be accessed by authenticated users
  if (isProfileApiRoute(req)) {
    try {
      // This will throw if the user is not authenticated
      const { userId } = await auth();
      if (!userId) {
        return new NextResponse(
          JSON.stringify({ error: 'Unauthorized' }), 
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return NextResponse.next();
    } catch (error) {
      return new NextResponse(
        JSON.stringify({ error: 'Authentication required' }), 
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // For Project routes, require sign-in only. Do not enforce active org role here.
  if (isProjectRoute(req)) {
    await auth.protect();
    return;
  }

  // For Organization routes, enforce org role-based access control
  if (isOrgRoute(req)) {
    // 1) Require a signed-in user
    await auth.protect();

    // 2) Check org role yourself (supports multiple roles)
    const { orgRole, redirectToSignIn } = await auth();

    if (!orgRole) {
      return redirectToSignIn();
    }

    const allowed = new Set(['org:admin', 'org:member', 'org:owner']);
    if (!allowed.has(orgRole)) {
      return new Response(null, { status: 404 });
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/auth).*)',
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
