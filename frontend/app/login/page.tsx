"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (e: any) {
      toast({ title: "Login failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl">Welcome back</CardTitle>
          <CardDescription>
            Sign in to access your documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail size={18} strokeWidth={2} className="text-slate-400" />
              </div>
              <Input
                id="login-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
              />
            </div>

            <div className="relative space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Lock size={18} strokeWidth={2} className="text-slate-400" />
              </div>
              <Input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10"
              />
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <ArrowRight size={18} strokeWidth={2} className="mr-2 animate-spin" />
              ) : (
                <UserIcon size={18} strokeWidth={2} className="mr-2" />
              )}
              Sign in
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t border-input">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Don't have an account?{" "}
            <Link href="/register" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
              Create one
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function UserIcon({ className, size = 18, strokeWidth = 2, ...props }: React.SVGProps<SVGSVGElement> & { size?: number; strokeWidth?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
