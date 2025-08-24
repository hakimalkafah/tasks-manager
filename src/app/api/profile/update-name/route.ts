import { auth, clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

// Ensure this route runs in the Node.js runtime so Clerk server SDK works.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This API route is protected by Clerk's auth middleware
export async function POST(req: Request) {
  let userId: string | null = null;
  let body: { firstName?: string; lastName?: string; email?: string } | null = null;
  try {
    // Get the auth session
    const session = await auth();
    userId = session.userId;
    
    if (!userId) {
      console.error('[update-name] Unauthorized request', { userId, body: null });
      return new Response(
        JSON.stringify({ error: "Unauthorized", errorCode: 'UNAUTHORIZED' }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

    // Parse and validate request body
    try {
      // Read the request body directly without cloning
      const contentType = req.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Content-Type must be application/json');
      }
      
      const text = await req.text();
      if (!text) {
        throw new Error('Request body is empty');
      }
      
      body = JSON.parse(text);
      
      if (!body || typeof body !== 'object') {
        throw new Error('Request body must be a JSON object');
      }
    } catch (error) {
      console.error('[update-name] Error parsing request body', { userId }, error);
      return new Response(
        JSON.stringify({
          error: "Invalid JSON",
          errorCode: 'INVALID_JSON',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

    if (!firstName || !lastName) {
      console.error('[update-name] Missing required fields', { userId, body });
      return new Response(
        JSON.stringify({ error: "First name and last name are required", errorCode: 'VALIDATION_ERROR' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }

    try {
      // Update Clerk user profile first so client `useUser()` reflects changes
      try {
        if (!clerkClient || !clerkClient.users) {
          throw new Error('Clerk client not available');
        }
        await clerkClient.users.updateUser(userId, {
          firstName,
          lastName,
        });
      } catch (clerkErr) {
        console.error('[update-name] Clerk update failed', { userId, body }, clerkErr);
        return new Response(
          JSON.stringify({
            error: 'Failed to update user profile',
            errorCode: 'CLERK_UPDATE_FAILED',
            details: clerkErr instanceof Error ? clerkErr.message : 'Unknown error'
          }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-store, max-age=0'
            }
          }
        );
      }

      // Then sync to Convex
      const result = await fetchMutation(api.users.createOrUpdateUser, {
        clerkUserId: userId,
        firstName,
        lastName,
        email: body.email ?? '',
      });

      return new Response(
        JSON.stringify({ 
          success: true,
          data: result 
        }), 
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          } 
        }
      );
    } catch (error) {
      console.error('[update-name] Convex mutation failed', { userId, body }, error);
      return new Response(
        JSON.stringify({
          error: "Failed to update user profile",
          errorCode: 'CONVEX_UPDATE_FAILED',
          details: error instanceof Error ? error.message : 'Unknown error'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, max-age=0'
          }
        }
      );
    }
  } catch (error) {
    console.error('[update-name] Unexpected error', { userId, body }, error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        errorCode: 'UNEXPECTED_ERROR',
        details: error instanceof Error ? error.message : String(error)
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
