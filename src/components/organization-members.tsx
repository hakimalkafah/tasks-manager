"use client";

import React from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useOrganization, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Crown, User, Trash2 } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export function OrganizationMembers() {
  const { organization } = useOrganization();
  const { user } = useUser();
  const updateMemberRole = useMutation(api.organizations.updateMemberRole);
  const removeMember = useMutation(api.organizations.removeOrganizationMember);
  const [changingIds, setChangingIds] = React.useState<Record<string, boolean>>({});
  
  const convexOrg = useQuery(
    api.organizations.getOrganization,
    organization ? { clerkOrgId: organization.id } : "skip"
  );
  
  const members = useQuery(
    api.organizations.getOrganizationMembers,
    convexOrg ? { organizationId: convexOrg._id } : "skip"
  );

  if (!organization || !convexOrg || !members) {
    return <div>Loading...</div>;
  }

  const handleRoleChange = async (membershipId: Id<"organizationMemberships">, newRole: "admin" | "member", targetUserId?: string) => {
    try {
      if (!organization) return;
      setChangingIds((s) => ({ ...s, [String(membershipId)]: true }));
      
      const clerkRole = newRole === "admin" ? "org:admin" : "org:member";
      
      // 1) Update role in Clerk organization for the target user
      const clerkResponse = await fetch('/api/organizations/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clerkOrgId: organization.id, targetUserId, role: clerkRole }),
      });
      
      if (!clerkResponse.ok) {
        const errorData = await clerkResponse.json();
        throw new Error(`Clerk update failed: ${errorData.error || 'Unknown error'}`);
      }
      
      // 2) Update Convex membership to keep local DB in sync
      try {
        await updateMemberRole({ membershipId, role: newRole });
      } catch (convexErr) {
        console.warn('Convex updateMemberRole failed, attempting sync fallback...', convexErr);
        // Fall through to sync-roles below
      }

      // 3) Trigger a role sync to ensure consistency regardless of mutation result
      if (targetUserId) {
        try {
          await fetch('/api/organizations/sync-roles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clerkOrgId: organization.id, userId: targetUserId, role: newRole }),
          });
        } catch (syncError) {
          console.warn("Role sync warning:", syncError);
          // Don't fail the operation if sync fails
        }
      }
      
    } catch (error) {
      console.error("Error updating member role:", error);
      alert(`Failed to update member role: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setChangingIds((s) => ({ ...s, [String(membershipId)]: false }));
    }
  };

  const handleRemoveMember = async (membershipId: Id<"organizationMemberships">) => {
    if (confirm("Are you sure you want to remove this member?")) {
      try {
        await removeMember({ membershipId });
      } catch (error) {
        console.error("Error removing member:", error);
      }
    }
  };

  const isCurrentUserAdmin = members.find(m => m.userId === user?.id)?.role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Organization Members
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members.map((member) => (
            <div key={member._id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium">
                    {member.user ? `${member.user.firstName} ${member.user.lastName}` : member.userId}
                  </p>
                  <p className="text-sm text-gray-500">
                    {member.user?.emailAddresses?.[0]?.emailAddress || `User ${member.userId.slice(-4)}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                  {member.role === "admin" && <Crown className="h-3 w-3 mr-1" />}
                  {member.role}
                </Badge>
                
                {isCurrentUserAdmin && member.userId !== user?.id && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!!changingIds[String(member._id)]}
                      onClick={() => handleRoleChange(
                        member._id,
                        member.role === "admin" ? "member" : "admin",
                        member.userId
                      )}
                    >
                      {changingIds[String(member._id)] ? 'Updating...' : (member.role === "admin" ? "Make Member" : "Make Admin")}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleRemoveMember(member._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isCurrentUserAdmin && (
            <div className="pt-4 border-t">
              <Button className="w-full" variant="outline">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Members
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
