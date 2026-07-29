"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const signedIn = useStore((s) => s.signedIn);

  useEffect(() => {
    router.replace(signedIn ? "/dashboard" : "/sign-in");
  }, [signedIn, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-navy-800" />
    </div>
  );
}
