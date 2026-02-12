import { Github, Lightbulb } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 sm:px-6">
        <p className="text-sm text-gray-500">
          Built by{" "}
          <span className="text-gray-400">Satyam</span>
        </p>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/stym06/quickgithub/issues/new?labels=enhancement&template=feature_request.md"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-300"
          >
            <Lightbulb className="h-4 w-4" />
            Request Feature
          </a>
          <a
            href="https://github.com/stym06/quickgithub"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 transition-colors hover:text-gray-300"
          >
            <Github className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}
