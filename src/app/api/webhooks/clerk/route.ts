import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const webhookSecret = process.env.CLERK_WEBHOOK_SECRET!;
const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const wh = new Webhook(webhookSecret);

export async function POST(req: Request) {
  const payload = await req.text();
  const svixId = req.headers.get("svix-id") || "";
  const svixTimestamp = req.headers.get("svix-timestamp") || "";
  const svixSignature = req.headers.get("svix-signature") || "";

  // Debug logging to verify incoming headers from Clerk (remove in production)
  console.log("Webhook headers:", {
    svixId: svixId ? "present" : "missing",
    svixTimestamp: svixTimestamp ? "present" : "missing",
    svixSignature: svixSignature ? "present" : "missing",
  });
  console.log(
    "All header keys:",
    Array.from(req.headers.keys())
  );
  console.log("Svix values:", {
    id: svixId,
    timestamp: svixTimestamp,
    signature: svixSignature?.slice(0, 16) + "...",
  });

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response("Missing Svix headers", { status: 400 });
  }

  try {
    // Pass a plain object with the exact Svix headers expected by the library
    wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    console.error("Invalid webhook signature", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(payload);
  try {
    // Support both dotted and camelCase event types from Clerk (org membership)
    switch (event.type) {
      case "organization.membership.created":
      case "organizationMembership.created":
      case "organization.membership.updated":
      case "organizationMembership.updated": {
        const clerkOrgId =
          event.data.organization?.id ||
          event.data.organization_id ||
          event.data.organizationId;
        const userId =
          event.data.public_user_data?.user_id ||
          event.data.public_user_data?.id ||
          event.data.user_id ||
          event.data.userId;
        const role = event.data.role as string | undefined;
        // Normalize Clerk role values (e.g., "org:admin", "org:member", "org:owner")
        let normalizedRole: "admin" | "member" | undefined;
        if (role) {
          const base = role.startsWith("org:") ? role.split(":")[1] : role;
          if (base === "owner" || base === "admin") normalizedRole = "admin";
          else if (base === "member") normalizedRole = "member";
        }
        const joinedAt = event.data.created_at
          ? new Date(event.data.created_at).getTime()
          : undefined;

        if (clerkOrgId && userId && normalizedRole) {
          const org = await convex.query(api.organizations.getOrganization, {
            clerkOrgId,
          });

          if (org) {
            await convex.mutation(api.organizations.upsertMembershipRole, {
              organizationId: org._id,
              userId,
              role: normalizedRole,
              joinedAt,
            });
          }
        }
        break;
      }
      case "organization.membership.deleted": {
        const clerkOrgId =
          event.data.organization?.id ||
          event.data.organization_id ||
          event.data.organizationId;
        const userId =
          event.data.public_user_data?.user_id ||
          event.data.public_user_data?.id ||
          event.data.user_id ||
          event.data.userId;

        if (clerkOrgId && userId) {
          const org = await convex.query(api.organizations.getOrganization, {
            clerkOrgId,
          });

          if (org) {
            const memberships = await convex.query(
              api.organizations.getAllMemberships,
              {}
            );
            const membership = memberships.find(
              (m: any) => m.organizationId === org._id && m.userId === userId
            );
            if (membership) {
              await convex.mutation(
                api.organizations.removeOrganizationMember,
                { membershipId: membership._id }
              );
            }
          }
        }
        break;
      }
      case "organization.updated": {
        const clerkOrgId = event.data.id;
        const org = await convex.query(api.organizations.getOrganization, {
          clerkOrgId,
        });
        if (org) {
          await convex.mutation(api.organizations.updateOrganization, {
            id: org._id,
            name: event.data.name,
            slug: event.data.slug,
            imageUrl: event.data.image_url,
          });
        }
        break;
      }
      case "organization.created":
      case "organization.deleted":
      default:
        break;
    }

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook handling error", err);
    return new Response("Error", { status: 500 });
  }
}