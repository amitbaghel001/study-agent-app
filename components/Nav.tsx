"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-800 bg-gray-950 px-6 py-3">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link
          href="/"
          className="text-lg font-semibold text-gray-100 transition-colors hover:text-white"
        >
          Study Agent
        </Link>
        <div className="flex gap-1">
          <NavLink href="/" current={pathname === "/"}>
            Chat
          </NavLink>
          <NavLink href="/dashboard" current={pathname === "/dashboard"}>
            Dashboard
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
        current
          ? "bg-gray-800 text-gray-100"
          : "text-gray-400 hover:bg-gray-800 hover:text-gray-100"
      }`}
    >
      {children}
    </Link>
  );
}
