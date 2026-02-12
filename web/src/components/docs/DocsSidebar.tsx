"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Wrench,
  Layers,
  Package,
  Zap,
  GitFork,
  Sun,
  Moon,
  Menu,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ModuleAnalysis } from "@/types";

interface DocsSidebarProps {
  owner: string;
  repo: string;
  modules?: ModuleAnalysis[];
}

const NAV_ITEMS = [
  { label: "Overview", href: "", icon: BookOpen },
  { label: "Setup Guide", href: "/setup", icon: Wrench },
  { label: "Architecture", href: "/architecture", icon: Layers },
  { label: "Key Modules", href: "/modules", icon: Package },
  { label: "Entry Points", href: "/entry-points", icon: Zap },
  { label: "Dependencies", href: "/dependencies", icon: GitFork },
];

function SidebarContent({
  owner,
  repo,
  modules,
  onNavigate,
}: DocsSidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();
  const basePath = `/${owner}/${repo}`;
  const { theme, setTheme } = useTheme();

  return (
    <div className="p-4">
      <div className="mb-1">
        <Link href="/" className="text-sm font-bold" onClick={onNavigate}>
          Quick<span className="text-emerald-400">GitHub</span>
        </Link>
      </div>
      <div className="mb-4">
        <Link
          href={basePath}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={onNavigate}
        >
          {owner}/{repo}
        </Link>
      </div>

      <nav className="space-y-1">
        {NAV_ITEMS.map((item) => {
          const href = `${basePath}${item.href}`;
          const isActive =
            item.href === ""
              ? pathname === basePath
              : pathname.startsWith(href);

          return (
            <div key={item.href}>
              <Link
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>

              {item.href === "/modules" &&
                isActive &&
                modules &&
                modules.length > 0 && (
                  <div className="ml-6 mt-1 space-y-1">
                    {modules.map((mod, i) => (
                      <a
                        key={i}
                        href={`#module-${mod.modulePath}`}
                        className="block text-xs text-muted-foreground hover:text-foreground py-1 truncate"
                        onClick={onNavigate}
                      >
                        {mod.moduleName}
                      </a>
                    ))}
                  </div>
                )}
            </div>
          );
        })}
      </nav>
      <div className="mt-6 border-t border-border/50 pt-4">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          aria-label="Toggle theme"
        >
          <Sun className="h-4 w-4 hidden dark:block" />
          <Moon className="h-4 w-4 block dark:hidden" />
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </button>
      </div>
    </div>
  );
}

export function DocsSidebar({ owner, repo, modules }: DocsSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 border-b bg-background/95 backdrop-blur px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link href="/" className="text-sm font-bold">
          Quick<span className="text-emerald-400">GitHub</span>
        </Link>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-background border-r transform transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="text-sm font-bold">
            Quick<span className="text-emerald-400">GitHub</span>
          </span>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <ScrollArea className="h-[calc(100%-3.25rem)]">
          <SidebarContent
            owner={owner}
            repo={repo}
            modules={modules}
            onNavigate={() => setMobileOpen(false)}
          />
        </ScrollArea>
      </aside>

      {/* Desktop sidebar */}
      <aside className="w-64 border-r bg-muted/30 shrink-0 hidden md:flex flex-col">
        <ScrollArea className="flex-1 h-[calc(100vh-3.5rem)]">
          <SidebarContent owner={owner} repo={repo} modules={modules} />
        </ScrollArea>
      </aside>
    </>
  );
}
