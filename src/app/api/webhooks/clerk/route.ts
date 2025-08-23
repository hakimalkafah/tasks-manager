import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error("Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local");
  }

  // Get the headers
  const headersList = headers();
  const svix_id = req.headers.get("svix-id");
  const svix_timestamp = req.headers.get("svix-timestamp");
  const svix_signature = req.headers.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occured -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: any;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as any;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occured", {
      status: 400,
    });
  }

  console.log("Clerk webhook event:", evt.type);

  try {
    switch (evt.type) {
      case "organizationMembership.updated":
        await handleMembershipUpdated(evt.data);
        break;
      case "organizationMembership.created":
        await handleMembershipCreated(evt.data);
        break;
      case "organizationMembership.deleted":
        await handleMembershipDeleted(evt.data);
        break;
      case "organization.created":
        await handleOrganizationCreated(evt.data);
        break;
      case "organization.updated":
        await handleOrganizationUpdated(evt.data);
        break;
      case "organization.deleted":
        await handleOrganizationDeleted(evt.data);
        break;
      default:
        console.log(`Unhandled webhook event type: ${evt.type}`);
    }
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response("Error processing webhook", { status: 500 });
  }

  return new Response("", { status: 200 });
}

interface ClerkWebhookPayload {
  type: string;
  data: {
    id: string;
    object: string;
    organization?: {
      id: string;
      name: string;
      slug: string;
    };
    public_user_data?: {
      user_id: string;
      first_name?: string;
      last_name?: string;
      profile_image_url?: string;
    };
    role?: string;
  };
}

async function handleMembershipUpdated(data: ClerkWebhookPayload) {
  console.log("Processing membership update:", JSON.stringify(data, null, 2));
  
  if (!data.data.organization || !data.data.public_user_data || !data.data.role) {
    console.error("Missing required fields in webhook payload");
    return;
  }

  const { organization, public_user_data, role } = data.data;
  const clerkOrgId = organization.id;
  const userId = public_user_data.user_id;
  
  if (!clerkOrgId || !userId || !role) {
    console.error("Missing required fields after validation");
    return;
  }
  
  // Convert Clerk role to Convex role (treat owner as admin)
  const convexRole = role === "org:member" ? "member" : "admin";
  
  try {
    console.log(`Looking up organization with Clerk ID: ${clerkOrgId}`);
    const convexOrg = await convex.query(api.organizations.getOrganization, {
      clerkOrgId: clerkOrgId
    });
    
    if (!convexOrg) {
      console.error(`Organization not found in Convex: ${clerkOrgId}`);
      return;
    }
    
    console.log(`Found Convex organization: ${convexOrg._id}`);
    
    // Get all members to find the current user's membership
    console.log(`Fetching members for organization ${convexOrg._id}`);
    const members = await convex.query(api.organizations.getOrganizationMembers, {
      organizationId: convexOrg._id
    });
    
    const currentMembership = members.find(m => m.userId === userId);
    
    if (!currentMembership) {
      console.log(`Creating new membership for user ${userId} in org ${convexOrg._id}`);
    } else if (currentMembership.role === convexRole) {
      console.log(`No role change needed for user ${userId} in org ${convexOrg._id}`);
      return;
    } else {
      console.log(`Updating role for user ${userId} from ${currentMembership.role} to ${convexRole}`);
    }
    
    // Upsert the membership with the new role
    await convex.mutation(api.organizations.upsertMembershipRole, {
      organizationId: convexOrg._id,
      userId: userId,
      role: convexRole
    });
    
    console.log(`Successfully updated role for user ${userId} in org ${clerkOrgId} to ${convexRole}`);
  } catch (error) {
    console.error("Error in handleMembershipUpdated:", error);
    // Don't throw to prevent webhook retries for non-critical issues
  }
}

async function handleMembershipCreated(data: ClerkWebhookPayload) {
  console.log("Processing membership creation:", JSON.stringify(data, null, 2));
  
  if (!data.data.organization || !data.data.public_user_data || !data.data.role) {
    console.error("Missing required fields in webhook payload");
    return;
  }

  const { organization, public_user_data, role } = data.data;
  const clerkOrgId = organization.id;
  const userId = public_user_data.user_id;
  
  if (!clerkOrgId || !userId || !role) {
    console.error("Missing required fields after validation");
    return;
  }
  
  // Convert Clerk role to Convex role (treat owner as admin)
  const convexRole = role === "org:member" ? "member" : "admin";
  
  try {
    console.log(`Looking up organization with Clerk ID: ${clerkOrgId}`);
    const convexOrg = await convex.query(api.organizations.getOrganization, {
      clerkOrgId: clerkOrgId
    });
    
    if (!convexOrg) {
      console.error(`Organization not found in Convex: ${clerkOrgId}`);
      return;
    }
    
    console.log(`Found Convex organization: ${convexOrg._id}`);
    
    // Check if membership already exists
    const members = await convex.query(api.organizations.getOrganizationMembers, {
      organizationId: convexOrg._id
    });
    
    const existingMembership = members.find(m => m.userId === userId);
    
    if (existingMembership) {
      console.log(`Membership already exists for user ${userId} in org ${convexOrg._id}`);
      return;
    }
    
    console.log(`Creating new membership for user ${userId} in org ${convexOrg._id}`);
    
    // Create the membership in Convex
    await convex.mutation(api.organizations.upsertMembershipRole, {
      organizationId: convexOrg._id,
      userId: userId,
      role: convexRole
    });
    
    console.log(`Successfully created membership for user ${userId} in org ${clerkOrgId} with role ${convexRole}`);
  } catch (error) {
    console.error("Error in handleMembershipCreated:", error);
    // Don't throw to prevent webhook retries for non-critical issues
  }
}

async function handleMembershipDeleted(data: ClerkWebhookPayload) {
  console.log("Processing membership deletion:", JSON.stringify(data, null, 2));
  
  if (!data.data.organization || !data.data.public_user_data) {
    console.error("Missing required fields in webhook payload");
    return;
  }

  const { organization, public_user_data } = data.data;
  const clerkOrgId = organization.id;
  const userId = public_user_data.user_id;
  
  if (!clerkOrgId || !userId) {
    console.error("Missing required fields after validation");
    return;
  }
  
  try {
    console.log(`Looking up organization with Clerk ID: ${clerkOrgId}`);
    const convexOrg = await convex.query(api.organizations.getOrganization, {
      clerkOrgId: clerkOrgId
    });
    
    if (!convexOrg) {
      console.error(`Organization not found in Convex: ${clerkOrgId}`);
      return;
    }
    
    console.log(`Found Convex organization: ${convexOrg._id}`);
    
    // Check if membership exists
    const members = await convex.query(api.organizations.getOrganizationMembers, {
      organizationId: convexOrg._id
    });
    
    const membershipToDelete = members.find(m => m.userId === userId);
    
    if (!membershipToDelete) {
      console.log(`No membership found for user ${userId} in org ${convexOrg._id}`);
      return;
    }
    
    console.log(`Removing membership for user ${userId} from org ${convexOrg._id}`);
    
    // Remove the membership from Convex
    await convex.mutation(api.organizations.removeOrganizationMember, {
      membershipId: membershipToDelete._id
    });
    
    console.log(`Successfully removed user ${userId} from org ${clerkOrgId}`);
  } catch (error) {
    console.error("Error in handleMembershipDeleted:", error);
    // Don't throw to prevent webhook retries for non-critical issues
  }
}

async function handleOrganizationCreated(data: any) {
  console.log("Processing organization creation:", data);
  
  const { id, name, slug, image_url, created_by } = data;
  
  try {
    await convex.mutation(api.organizations.createOrganization, {
      clerkOrgId: id,
      name: name,
      slug: slug,
      imageUrl: image_url,
      createdBy: created_by
    });
    
    console.log(`Created organization ${name} (${id}) in Convex`);
  } catch (error) {
    console.error("Error creating organization in Convex:", error);
    // Don't throw here as the organization might already exist
  }
}

async function handleOrganizationUpdated(data: any) {
  console.log("Processing organization update:", data);
  
  const { id, name, slug, image_url } = data;
  
  try {
    // Get the Convex organization
    const convexOrg = await convex.query(api.organizations.getOrganization, {
      clerkOrgId: id
    });
    
    if (!convexOrg) {
      console.error("Organization not found in Convex:", id);
      return;
    }
    
    // Update the organization in Convex
    await convex.mutation(api.organizations.updateOrganization, {
      id: convexOrg._id,
      name: name,
      slug: slug,
      imageUrl: image_url
    });
    
    console.log(`Updated organization ${name} (${id}) in Convex`);
  } catch (error) {
    console.error("Error updating organization in Convex:", error);
    throw error;
  }
}

async function handleOrganizationDeleted(data: any) {
  console.log("Processing organization deletion:", data);
  
  const { id } = data;
  
  try {
    // Get the Convex organization
    const convexOrg = await convex.query(api.organizations.getOrganization, {
      clerkOrgId: id
    });
    
    if (!convexOrg) {
      console.error("Organization not found in Convex:", id);
      return;
    }
    
    // Remove all memberships first
    const members = await convex.query(api.organizations.getOrganizationMembers, {
      organizationId: convexOrg._id
    });
    
    for (const member of members) {
      await convex.mutation(api.organizations.removeOrganizationMember, {
        membershipId: member._id
      });
    }
    
    // Note: We might want to keep the organization record for data integrity
    // but mark it as deleted instead of actually deleting it
    console.log(`Processed deletion of organization ${id}`);
  } catch (error) {
    console.error("Error processing organization deletion in Convex:", error);
    throw error;
  }
}
