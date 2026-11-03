"use client";

import { useState } from "react";
import { forgotPassword } from "@/lib/api";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Mail, ArrowLeft, LogIn } from "lucide-react";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(username);
      setSent(true);
    } catch (e: any) {
      toast({ title: "Reset failed", description: e?.message || "Could not send reset link." });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 px-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="flex flex-row space-between items-center pb-2">
            <div className="flex flex-row items-center space-x-2">
              <Mail className="h-4 w-4" />
              <h1 className="text-2xl font-bold">Reset email sent</h1>
            </div>
          </CardHeader>
          <CardContent className="space-y-6 text-center">
            <p className="text-muted-foreground">
              If an account exists for <strong>{username}</strong>, a password reset link has been sent.
            </p>
            <div className="flex flex-col gap-3">
              <Button asChild className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="/" onClick={() => router.replace("/")}>
                  Back to home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="flex flex-row space-between items-center pb-2">
          <Button
            variant="ghost"
            size="icon"
            asChild
            onClick={() => router.replace("/login")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-row items-center space-x-2">
            <Mail className="h-4 w-4" />
            <h1 className="text-2xl font-bold">Forgot password</h1>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Enter your username and we'll send you a password reset link.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full" size="lg">
              {loading ? <LogIn className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Sending..." : "Send reset link"}
            </Button>
          </form>
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <p>Remember your password?</p>
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
