import { Lightbulb } from "lucide-react";

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 sm:flex-row sm:justify-between sm:gap-0 sm:px-6">
        <p className="text-sm text-gray-500">
          Built by{" "}
          <a
            href="https://x.com/stym06"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-gray-400 transition-colors hover:text-gray-300"
          >
            <XIcon className="h-3.5 w-3.5" />
            @stym06
          </a>
        </p>
        <a
          href="https://x.com/stym06"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
        >
          <Lightbulb className="h-4 w-4" />
          Request Feature
        </a>
      </div>
    </footer>
  );
}
