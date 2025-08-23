import { auth, clerkClient } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

// Ensure this route runs in the Node.js runtime so Clerk server SDK works.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This API route is protected by Clerk's auth middleware
export async function POST(req: Request) {
  try {
    // Get the auth session
    const session = await auth();
    const userId = session.userId;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "You must be signed in to update your profile" }), 
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
    let body: { firstName?: string; lastName?: string; email?: string };
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
      console.error('Error parsing request body:', error);
      return new Response(
        JSON.stringify({ 
          error: "Invalid request body",
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
      return new Response(
        JSON.stringify({ error: "First name and last name are required" }), 
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
          console.warn('[update-name] clerkClient not available; skipping Clerk profile update');
        } else {
          await clerkClient.users.updateUser(userId, {
            firstName,
            lastName,
          });
        }
      } catch (clerkErr) {
        console.warn('[update-name] Clerk update failed, proceeding to Convex sync', clerkErr);
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
      console.error("Error updating user:", error);
      return new Response(
        JSON.stringify({ 
          error: "Failed to update user profile",
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
    console.error("Unexpected error in update-name route:", error);
    return new Response(
      JSON.stringify({ 
        error: "An unexpected error occurred",
        details: error instanceof Error ? error.message : String(error)
      }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
