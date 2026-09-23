import { Link, useLocation } from "react-router";
import { OlarionLogo } from "./OlarionLogo";

export function Navigation() {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            aria-label="Olarion home"
            className="flex items-center gap-3 group shrink-0"
          >
            <OlarionLogo size={40} />
            <span className="hidden sm:inline font-serif text-xl text-[var(--foreground)]">
              Olarion
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-3 sm:gap-6">
            <Link
              to="/"
              className={`hidden md:inline text-sm transition-colors ${
                isActive("/")
                  ? "text-[var(--accent-primary)] font-medium"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              Home
            </Link>
            <Link
              to="/guide"
              aria-current={isActive("/guide") ? "page" : undefined}
              className={`text-sm transition-colors ${isActive("/guide") ? "text-[var(--accent-primary)] font-medium" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            >
              Upload guide
            </Link>
            <Link
              to="/past-audits"
              className={`text-sm transition-colors ${
                isActive("/past-audits")
                  ? "text-[var(--accent-primary)] font-medium"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              History
            </Link>
            <Link
              to="/setup"
              className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm whitespace-nowrap hover:bg-[var(--accent-primary)] transition-colors"
            >
              New Audit
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
