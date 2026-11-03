"use client";

import { useEffect, useState } from "react";
import { loginUser, forgotPassword, getToken } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { LogIn, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (getToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const validateField = (name: string, value: string) => {
    if (name === "username") {
      if (!value.trim()) {
        setUsernameError("Username is required");
      } else {
        setUsernameError(null);
      }
    }
    if (name === "password") {
      if (!value) {
        setPasswordError("Password is required");
      } else {
        setPasswordError(null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let valid = true;

    if (!username.trim()) {
      setUsernameError("Username is required");
      valid = false;
    }
    if (!password) {
      setPasswordError("Password is required");
      valid = false;
    }

    if (!valid) return;

    setLoading(true);
    try {
      await loginUser(username, password);
      toast({ title: "Signed in", description: "Welcome back!" });
      router.replace("/dashboard");
    } catch (e: any) {
      const message = e?.message || "Invalid username or password. Please try again.";
      toast({ title: "Sign in failed", description: message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!username) {
      setUsernameError("Username is required");
      return;
    }
    try {
      await forgotPassword(username);
      toast({ title: "Reset link sent", description: "If an account exists, a password reset link has been sent." });
    } catch (e: any) {
      toast({ title: "Reset failed", description: e?.message || "Could not send reset link." });
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-row space-between items-center pb-2">
          <div className="flex flex-row items-center space-x-2 rtl:space-x-reverse">
            <LogIn className="h-4 w-4" />
            <h1 className="text-2xl font-bold">Sign in</h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  validateField("username", e.target.value);
                }}
                onBlur={(e) => validateField("username", e.target.value)}
                required
                aria-invalid={!!usernameError}
                aria-describedby={usernameError ? "username-error" : undefined}
              />
              {usernameError && (
                <p id="username-error" className="text-sm text-destructive">
                  {usernameError}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  validateField("password", e.target.value);
                }}
                onBlur={(e) => validateField("password", e.target.value)}
                required
                aria-invalid={!!passwordError}
                aria-describedby={passwordError ? "password-error" : undefined}
              />
              {passwordError && (
                <p id="password-error" className="text-sm text-destructive">
                  {passwordError}
                </p>
              )}
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <ArrowRight className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <Separator />
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <p>Don't have an account?</p>
            <Link href="/register" className="text-primary font-medium hover:underline">
              Create one
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Separator() {
  return (
    <div className="relative w-full my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border/50"></span>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center text-xs font-semibold text-muted-foreground bg-background px-4">
        Or continue with
      </div>
    </div>
  );
}
