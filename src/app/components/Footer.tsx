import { OlarionLogo } from "./OlarionLogo";
import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-white/60 backdrop-blur-sm mt-24">
      <div className="max-w-7xl mx-auto px-8 py-8">
        <div className="flex flex-wrap gap-6 items-center justify-between">
          {/* Logo and Copyright */}
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <div className="flex items-center gap-3">
              <OlarionLogo size={40} />
              <span className="font-serif text-lg text-[var(--foreground)]">
                Olarion
              </span>
            </div>
            <p className="text-sm text-[var(--muted-foreground)]">
              © 2026 Olarion. All rights reserved.
            </p>
          </div>

          {/* Additional Links */}
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/guide" className="text-sm text-blue-700 hover:underline">
              Upload guide
            </Link>
            <Link
              to="/guide#evaluation"
              className="text-sm text-blue-700 hover:underline"
            >
              Evaluation
            </Link>
            <span className="text-sm text-[var(--muted-foreground)]">
              AI-assisted ML workflow review
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
