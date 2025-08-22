import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';

    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "Both firstName and lastName are required" }), { status: 400 });
    }

    const clerk = await clerkClient();
    await clerk.users.updateUser(userId, {
      firstName,
      lastName,
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err: any) {
    console.error("update-name route error", err);
    return new Response(
      JSON.stringify({ error: err?.errors?.[0]?.message || err?.message || "Failed to update name" }),
      { status: 500 }
    );
  }
}
