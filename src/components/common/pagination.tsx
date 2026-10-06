import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Accessible, controlled pager used by request search, the donor directory and
 * the admin tables. Renders numbered buttons on wider screens and a compact
 * "Page x of y" control on small screens.
 */
export function SimplePagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  label = "Pagination",
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  label?: string;
}) {
  if (totalPages <= 1) return null;

  const windowSize = 5;
  const start = Math.max(
    1,
    Math.min(currentPage - Math.floor(windowSize / 2), totalPages - windowSize + 1),
  );
  const end = Math.min(totalPages, start + windowSize - 1);
  const pages: number[] = [];
  for (let page = Math.max(1, start); page <= end; page += 1) pages.push(page);

  return (
    <nav aria-label={label} className={cn("flex items-center justify-center gap-2", className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      <ul className="hidden items-center gap-1 sm:flex">
        {pages.map((page) => (
          <li key={page}>
            <Button
              variant={page === currentPage ? "default" : "ghost"}
              size="sm"
              className="min-w-9"
              aria-current={page === currentPage ? "page" : undefined}
              onClick={() => onPageChange(page)}
            >
              {page}
            </Button>
          </li>
        ))}
      </ul>

      <p className="text-sm font-semibold text-muted-foreground sm:hidden" aria-live="polite">
        Page {currentPage} of {totalPages}
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage >= totalPages}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
