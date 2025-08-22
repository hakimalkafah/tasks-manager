import { auth, clerkClient } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    if (!user.firstName || !user.lastName) {
      return new Response(JSON.stringify({ error: "User missing required name fields" }), { status: 400 });
    }

    const primaryEmail = user.emailAddresses.find(email => email.id === user.primaryEmailAddressId);
    if (!primaryEmail) {
      return new Response(JSON.stringify({ error: "User missing email" }), { status: 400 });
    }

    await convex.mutation(api.users.createOrUpdateUser, {
      clerkUserId: userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: primaryEmail.emailAddress,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("sync-to-convex route error", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Failed to sync user to Convex" }),
      { status: 500 }
    );
  }
}
