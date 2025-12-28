"use client";

import { useState, useMemo } from "react";
import { X, UserPlus, Check } from "lucide-react";
import { InlineLoader } from "@/components/ui/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUsers, SkillOwner, AppUser } from "@/hooks/use-knowledge";
import { cn } from "@/lib/utils";

interface OwnerManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOwners: SkillOwner[];
  onSave: (owners: SkillOwner[]) => Promise<void>;
  itemTitle: string;
}

export function OwnerManagementDialog({
  open,
  onOpenChange,
  currentOwners,
  onSave,
  itemTitle,
}: OwnerManagementDialogProps) {
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const [selectedOwners, setSelectedOwners] = useState<SkillOwner[]>(currentOwners);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Filter users by search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(query) ||
        user.email?.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  // Check if user is already an owner
  const isOwner = (user: AppUser) =>
    selectedOwners.some((o) => o.userId === user.id || o.email === user.email);

  // Add an owner
  const addOwner = (user: AppUser) => {
    if (isOwner(user)) return;
    setSelectedOwners([
      ...selectedOwners,
      {
        userId: user.id,
        name: user.name || user.email || "Unknown",
        email: user.email || undefined,
        image: user.image || undefined,
      },
    ]);
  };

  // Remove an owner
  const removeOwner = (owner: SkillOwner) => {
    setSelectedOwners(
      selectedOwners.filter(
        (o) => !(o.userId === owner.userId || o.email === owner.email)
      )
    );
  };

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(selectedOwners);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Reset on open
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      setSelectedOwners(currentOwners);
      setSearchQuery("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Owners</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Assign or remove owners for &ldquo;{itemTitle}&rdquo;
          </p>
        </DialogHeader>

        {/* Current Owners */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Current Owners</label>
          {selectedOwners.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">No owners assigned</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedOwners.map((owner) => (
                <div
                  key={owner.userId || owner.email}
                  className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
                >
                  <span>{owner.name}</span>
                  <button
                    onClick={() => removeOwner(owner)}
                    className="hover:bg-blue-200 rounded-full p-0.5"
                    aria-label={`Remove ${owner.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Owner */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Add Owner</label>
          <Input
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="max-h-48 overflow-y-auto border rounded-md">
            {usersLoading ? (
              <div className="py-4 flex items-center justify-center">
                <InlineLoader size="md" className="text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">
                {searchQuery ? "No users found" : "No users available"}
              </div>
            ) : (
              <ul className="divide-y">
                {filteredUsers.map((user) => {
                  const alreadyOwner = isOwner(user);
                  return (
                    <li
                      key={user.id}
                      className={cn(
                        "px-3 py-2 flex items-center justify-between",
                        alreadyOwner
                          ? "bg-muted/50"
                          : "hover:bg-muted/30 cursor-pointer"
                      )}
                      onClick={() => !alreadyOwner && addOwner(user)}
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {user.name || "Unnamed"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {user.email}
                        </div>
                      </div>
                      {alreadyOwner ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <InlineLoader size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
