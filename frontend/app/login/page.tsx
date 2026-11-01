"use client";

import { useState } from "react";
import { loginUser } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginUser(username, password);
      toast({ title: "Logged in", description: "Welcome back!" });
      router.push("/dashboard");
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row space-between items-center pb-2">
          <div className="flex flex-row items-center space-x-2 rtl:space-x-reverse">
            <LogIn className="h-4 w-4" />
            <h1 className="text-2xl font-bold">Sign in</h1>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <p>Don't have an account?</p>
            <Link href="/register" className="underline underline-offset-4 hover:text-primary">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
