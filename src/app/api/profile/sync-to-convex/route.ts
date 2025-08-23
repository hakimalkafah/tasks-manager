import { auth, currentUser } from "@clerk/nextjs/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export async function POST() {
  try {
    const { userId } = auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const user = await currentUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404 });
    }

    const firstName = user.firstName ?? "";
    const lastName = user.lastName ?? "";
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "User missing required name fields" }), { status: 400 });
    }

    const emailAddress = user.emailAddresses?.[0]?.emailAddress;
    if (!emailAddress) {
      return new Response(JSON.stringify({ error: "Email address required" }), { status: 400 });
    }

    await fetchMutation(api.users.createOrUpdateUser, {
      clerkUserId: userId,
      firstName,
      lastName,
      email: emailAddress,
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("sync-to-convex route error", err);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
