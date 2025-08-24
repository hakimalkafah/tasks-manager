// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isOrgRoute = createRouteMatcher(['/organization/:path*']);
const isProjectRoute = createRouteMatcher(['/project/:path*']);

export default clerkMiddleware(async (auth, req) => {
  // Allow Clerk webhooks to pass through without auth or rewrites
  const pathname = req.nextUrl.pathname;
  if (pathname.startsWith('/api/webhooks/clerk')) {
    return; // do nothing, skip middleware for webhook route
  }

  // For Project routes, require sign-in only. Do not enforce active org role here.
  if (isProjectRoute(req)) {
    await auth.protect();
    return;
  }

  // For Organization routes, enforce org role-based access control
  if (isOrgRoute(req)) {
    // 1) Require a signed-in user
    await auth.protect(); // redirects unauthenticated users to sign-in. :contentReference[oaicite:1]{index=1}

    // 2) Check org role yourself (supports multiple roles)
    const { orgRole, redirectToSignIn } = await auth();

    if (!orgRole) {
      return redirectToSignIn();
    }

    const allowed = new Set(['org:admin', 'org:member', 'org:owner']);
    if (!allowed.has(orgRole)) {
      // Return 404 for unauthorized org roles (Clerk uses 404 for unauthorized by default)
      return new Response(null, { status: 404 });
      // Or: return Response.redirect(new URL('/403', req.url));
    }
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
