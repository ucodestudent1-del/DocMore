"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Mail, Lock, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api("/api/v1/auth/register", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      });
      router.push("/dashboard");
    } catch (e: any) {
      toast({ title: "Registration failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-1">
          <CardTitle className="text-2xl">Create account</CardTitle>
          <CardDescription>
            Start generating documents today
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="relative space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Full name
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <User size={18} strokeWidth={2} className="text-slate-400" />
              </div>
              <Input
                id="register-name"
                type="text"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="relative space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Mail size={18} strokeWidth={2} className="text-slate-400" />
              </div>
              <Input
                id="register-email"
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
                id="register-password"
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
                <User size={18} strokeWidth={2} className="mr-2" />
              )}
              Create account
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t border-input">
          <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-brand-600 dark:text-brand-400 font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
