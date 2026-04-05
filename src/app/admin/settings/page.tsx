"use client";

import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, UserPlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Admin } from "@/types/database";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const supabase = createClient();

  const fetchAdmins = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admins")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setAdmins(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setMessage({ type: "error", text: "Please enter an email address" });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Note: In a real implementation, you'd need the user's auth ID
      // This is a simplified version that assumes the user will need to sign up first
      // For now, we'll show a helpful message

      setMessage({
        type: "error",
        text: "To add a new admin, the user must first create an account. Then you can add them using their user ID.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to add admin",
      });
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (adminId: string) => {
    // Get current user to prevent self-removal
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.id === adminId) {
      setMessage({ type: "error", text: "You cannot remove yourself as an admin" });
      return;
    }

    if (admins.length <= 1) {
      setMessage({ type: "error", text: "Cannot remove the last admin" });
      return;
    }

    const { error } = await supabase
      .from("admins")
      .delete()
      .eq("id", adminId);

    if (error) {
      setMessage({ type: "error", text: "Failed to remove admin" });
    } else {
      setAdmins((prev) => prev.filter((a) => a.id !== adminId));
      setMessage({ type: "success", text: "Admin removed successfully" });
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <AdminSidebar />

      <main className="pl-64">
        <div className="p-8 max-w-4xl">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            Settings
          </h1>

          {message && (
            <div
              className={cn(
                "mb-6 p-4 rounded-lg",
                message.type === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300"
                  : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              )}
            >
              {message.text}
            </div>
          )}

          {/* Admin Users */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Admin Users</CardTitle>
              <CardDescription>
                Manage who can access the admin panel
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {admins.map((admin) => (
                      <div
                        key={admin.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">
                            {admin.email}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            ID: {admin.id.slice(0, 8)}...
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAdmin(admin.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                      To add a new admin:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-zinc-600 dark:text-zinc-400 space-y-1 mb-4">
                      <li>Have the user sign up through the login page</li>
                      <li>Get their user ID from Supabase Auth dashboard</li>
                      <li>Add them to the admins table in Supabase with their ID and email</li>
                    </ol>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Frame.io Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>Frame.io Configuration</CardTitle>
              <CardDescription>
                API token is configured via environment variables for security
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                  The Frame.io API token is stored securely in Vercel environment variables:
                </p>
                <code className="text-xs bg-zinc-200 dark:bg-zinc-700 px-2 py-1 rounded">
                  FRAMEIO_API_TOKEN
                </code>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-4">
                  To update the token, go to your Vercel project settings and update the environment variable.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
