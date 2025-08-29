"use client";

import React from "react";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function CreateProjectButton() {
  const { openCreateOrganization } = useClerk();

  const handleClick = () => {
    openCreateOrganization();
  };

  return (
    <Button onClick={handleClick}>
      <Plus className="h-4 w-4 mr-2" />
      Create Project
    </Button>
  );
}

