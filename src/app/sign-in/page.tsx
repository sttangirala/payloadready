"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Rocket, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useStore } from "@/lib/store";

export default function SignInPage() {
  const router = useRouter();
  const signIn = useStore((s) => s.signIn);
  const activateDemo = useStore((s) => s.activateDemo);
  const [email, setEmail] = useState("ava.torres@meridianorbital.example");
  const [password, setPassword] = useState("");

  function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    signIn();
    router.push("/dashboard");
  }

  function handleDemo() {
    activateDemo();
    router.push("/dashboard");
  }

  return (
    <div className="flex min-h-screen bg-navy-950">
      <div className="hidden w-1/2 flex-col justify-between bg-navy-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-500/20">
            <Rocket className="h-4 w-4 text-blue-500" />
          </div>
          <span className="text-[15px] font-semibold tracking-tight">PayloadReady</span>
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">
            Know what stands between your payload and the pad.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-white/60">
            Track readiness checklists, evidence, issues, and decisions for small satellite and hosted-payload
            missions in one coordination workspace built for launch-integration teams.
          </p>
        </div>
        <p className="text-[12px] text-white/35">
          PayloadReady is a coordination and readiness-tracking tool. It does not certify flightworthiness, safety,
          regulatory compliance, or launch approval.
        </p>
      </div>

      <div className="flex w-full flex-col items-center justify-center bg-background px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-100">
              <Rocket className="h-4 w-4 text-navy-800" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-navy-950">PayloadReady</span>
          </div>

          <h2 className="text-xl font-semibold text-navy-950">Sign in</h2>
          <p className="mt-1 text-[13px] text-slate-500">Enter your workspace credentials to continue.</p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full justify-center">
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-slate-400">Or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full justify-center" onClick={handleDemo} type="button">
            Explore the Pathfinder-1 demo mission
          </Button>
          <p className="mt-2 text-center text-[12px] text-slate-400">
            Opens a fully populated fictional mission — no account needed.
          </p>

          <p className="mt-8 text-center text-[13px] text-slate-500">
            New organization?{" "}
            <Link href="/onboarding" className="font-medium text-navy-800 hover:underline">
              Set up your workspace
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
