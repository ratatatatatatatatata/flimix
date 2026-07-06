"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { t } from "@/lib/i18n";

/**
 * Always-visible inline search in the site header (md+ screens). Submits to
 * /search?q=... via router.push so the search page renders with the query
 * prefilled and results already loading.
 */
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      action="/search"
      className="relative hidden md:block"
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
      }}
    >
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mist-500"
        aria-hidden="true"
      />
      <input
        type="search"
        name="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.searchPlaceholder}
        aria-label={t.search}
        className="w-56 rounded-lg border border-ink-600 bg-ink-800 py-2 pl-9 pr-3 text-sm text-mist-100 placeholder:text-mist-500 transition-all duration-300 focus:w-72 focus:border-royal-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
      />
    </form>
  );
}
