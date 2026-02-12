"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function LoginCard() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <Card className="w-full max-w-md border-white/10 bg-gray-900">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl text-white">
            Sign in to Quick<span className="text-emerald-400">GitHub</span>
          </CardTitle>
          <CardDescription className="text-gray-400">
            AI-powered documentation for any repository
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            className="w-full gap-2 bg-white text-gray-900 hover:bg-gray-200"
            onClick={() => signIn("github", { callbackUrl })}
          >
            <Github className="h-5 w-5" />
            Continue with GitHub
          </Button>
          <p className="text-center text-xs text-gray-500">
            We only request read access to your public profile
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}
