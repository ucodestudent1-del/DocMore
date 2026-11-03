"use client";

import { useState, useEffect } from "react";
import {
  adminListUsers,
  adminUpdateUser,
  adminDeleteUser,
  adminListTiers,
  adminGetStats,
  adminListJobs,
  adminRunRetention,
  adminGDPRDeleteUser,
  getToken,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  User,
  Users,
  Settings,
  Layers,
  Activity,
  BarChart3,
  Trash2,
  RefreshCw,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [tiers, setTiers] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    loadData();
  }, [router, getToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, u, j, t] = await Promise.all([
        adminGetStats().catch(() => null),
        adminListUsers().catch(() => null),
        adminListJobs().catch(() => null),
        adminListTiers().catch(() => null),
      ]);
      setStats(s);
      setUsers((s?.users || []).map((u: any) => u));
      setJobs((j?.jobs || []).map((j: any) => j));
      setTiers(t);
    } catch {
      // Ignore load errors
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast({ title: "Refreshed" });
  };

  const handleUpdateUser = async (username: string, field: string, value: any) => {
    try {
      await adminUpdateUser(username, { [field]: value });
      toast({ title: "Updated", description: `${field} set to ${value}` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message });
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!confirm(`Delete user ${username}?`)) return;
    try {
      await adminDeleteUser(username);
      toast({ title: "Deleted", description: `User ${username} removed` });
      await loadData();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message });
    }
  };

  const handleGDPRDelete = async (username: string) => {
    if (!confirm(`GDPR delete ${username} and ALL their data? This cannot be undone.`)) return;
    try {
      await adminGDPRDeleteUser(username);
      toast({ title: "GDPR deleted", description: `User ${username} and all data removed` });
      await loadData();
    } catch (err: any) {
      toast({ title: "GDPR delete failed", description: err.message });
    }
  };

  const handleRunRetention = async () => {
    try {
      const result = await adminRunRetention(24);
      toast({
        title: "Retention run",
        description: `${result.removed_files || 0} file(s) removed`,
      });
      await loadData();
    } catch (err: any) {
      toast({ title: "Retention failed", description: err.message });
    }
  };

  const tierBadge = (tier: string) => {
    const variants: Record<string, string> = {
      free: "bg-gray-100 text-gray-800",
      premium: "bg-blue-100 text-blue-800",
      enterprise: "bg-purple-100 text-purple-800",
    };
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${variants[tier] || "bg-gray-100 text-gray-800"}`}>
        {tier.charAt(0).toUpperCase() + tier.slice(1)}
      </span>
    );
  };

  const roleBadge = (role: string) => {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${role === "admin" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}`}>
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "failed": return "text-red-600";
      case "running": return "text-blue-600";
      case "pending": return "text-yellow-600";
      default: return "text-gray-600";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading admin dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">Platform management, user oversight, and system health.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} size="sm">
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <Button onClick={handleRunRetention} variant="outline" size="sm">
            <ShieldAlert className="mr-2 h-4 w-4" /> Run Retention (24h)
          </Button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold">{stats?.total_users || "--"}</span>
              <span className="text-sm text-muted-foreground">users</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.verified_users || 0} verified
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats?.total_uploads || "--"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Outputs</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-bold">{stats?.total_outputs || "--"}</span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold">{stats?.total_jobs || "--"}</span>
              <span className="text-sm text-muted-foreground">jobs</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts & breakdowns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users by Tier</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.users_by_tier || {}).map(([tier, count]) => (
                <div key={tier} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm">{tier.charAt(0).toUpperCase() + tier.slice(1)}</span>
                  <span className="text-sm font-mono font-bold">{String(count)}</span>
                </div>
              ))}
              {Object.keys(stats?.users_by_tier || {}).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats?.jobs_by_status || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className={`text-sm ${statusColor(status)}`}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </span>
                  <span className="text-sm font-mono font-bold">{String(count)}</span>
                </div>
              ))}
              {Object.keys(stats?.jobs_by_status || {}).length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No data</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>User Management</CardTitle>
            <p className="text-xs text-muted-foreground">View, edit, and delete user accounts.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-3">Username</th>
                  <th className="text-left pb-3">Email</th>
                  <th className="text-left pb-3">Tier</th>
                  <th className="text-left pb-3">Role</th>
                  <th className="text-left pb-3">Verified</th>
                  <th className="text-left pb-3">Joined</th>
                  <th className="text-right pb-3 w-48">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map((u: any) => (
                  <tr key={u.username} className="hover:bg-muted/50 transition-colors">
                    <td className="pb-3 font-medium">{u.username}</td>
                    <td className="pb-3 text-muted-foreground">{u.email}</td>
                    <td className="pb-3">{tierBadge(u.tier)}</td>
                    <td className="pb-3">{roleBadge(u.role)}</td>
                    <td className="pb-3">
                      {u.is_verified ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <span className="text-xs text-muted-foreground">-</span>}
                    </td>
                    <td className="pb-3 text-xs text-muted-foreground font-mono">
                      {new Date(u.created_at || 0).toLocaleDateString()}
                    </td>
                    <td className="pb-3 text-right">
                      <Select
                        value={u.tier}
                        onValueChange={(val) => handleUpdateUser(u.username, "tier", val)}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>{u.tier}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {["free", "premium", "enterprise"].map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => handleUpdateUser(u.username, "role", u.role === "admin" ? "user" : "admin")}
                        variant="ghost"
                        size="icon"
                        className="ml-2"
                      >
                        {u.role === "admin" ? <User className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3 text-red-500" />}
                      </Button>
                      <Button
                        onClick={() => handleGDPRDelete(u.username)}
                        variant="destructive"
                        size="icon"
                        className="ml-2"
                        title="GDPR Delete"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="pb-6 text-center text-muted-foreground text-sm">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Jobs monitoring */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Job Queue</CardTitle>
            <p className="text-xs text-muted-foreground">Recent background jobs across all users.</p>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left pb-3">Job</th>
                  <th className="text-left pb-3">User</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-left pb-3">Progress</th>
                  <th className="text-left pb-3">Created</th>
                  <th className="text-left pb-3">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {jobs.slice(0, 20).map((j: any) => (
                  <tr key={j.id} className="hover:bg-muted/50 transition-colors">
                    <td className="pb-3 font-medium truncate max-w-xs">{j.task_name}</td>
                    <td className="pb-3 text-muted-foreground">{j.user_id || "—"}</td>
                    <td className="pb-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${statusColor(j.status)}`}>
                        <span className={`h-2 w-2 rounded-full bg-${j.status === "completed" ? "green" : j.status === "failed" ? "red" : j.status === "running" ? "blue" : "yellow"}-500`} />
                        {j.status.charAt(0).toUpperCase() + j.status.slice(1)}
                      </span>
                    </td>
                    <td className="pb-3">{j.progress}%</td>
                    <td className="pb-3 text-xs text-muted-foreground font-mono">
                      {new Date(j.created_at || 0).toLocaleString()}
                    </td>
                    <td className="pb-3 text-xs text-red-500 truncate max-w-xs">
                      {j.error || "—"}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="pb-6 text-center text-muted-foreground text-sm">
                      No jobs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
