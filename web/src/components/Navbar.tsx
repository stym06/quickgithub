"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Github, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { data: session, status } = useSession();

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold text-white">
          Quick<span className="text-emerald-400">GitHub</span>
        </Link>

        {status === "loading" ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        ) : session?.user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-8 w-8 rounded-full"
              >
                <Avatar>
                  <AvatarImage
                    src={session.user.image || undefined}
                    alt={session.user.name || "User"}
                  />
                  <AvatarFallback className="bg-emerald-600 text-white">
                    {session.user.name
                      ? session.user.name.charAt(0).toUpperCase()
                      : "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/" })}
                className="cursor-pointer"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            variant="outline"
            className="gap-2 border-white/20 bg-transparent text-white hover:bg-white/10"
            asChild
          >
            <Link href="/login">
              <Github className="h-4 w-4" />
              <span className="hidden sm:inline">Sign in with GitHub</span>
              <span className="sm:hidden">Sign in</span>
            </Link>
          </Button>
        )}
      </div>
    </nav>
  );
}
