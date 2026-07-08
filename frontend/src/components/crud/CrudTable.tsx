import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

export type CrudTableColumn<T> = {
  key: string;
  header: string;
  className?: string;
  align?: "left" | "right";
  cell: (item: T) => ReactNode;
};

type CrudTableProps<T extends { id: string }> = {
  columns: Array<CrudTableColumn<T>>;
  rows: T[];
  loading?: boolean;
  totalItems: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  emptyTitle: string;
  emptyDescription: string;
};

export function CrudTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  emptyTitle,
  emptyDescription
}: CrudTableProps<T>) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const from = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-[28px] border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full border-collapse">
            <thead className="bg-slate-950/80">
              <tr className="border-b border-slate-800">
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn(
                      "px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500",
                      column.align === "right" ? "text-right" : "text-left",
                      column.className
                    )}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-slate-500">
                    Loading records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12">
                    <div className="mx-auto max-w-md rounded-[28px] border border-dashed border-slate-800 bg-slate-950/70 p-8 text-center">
                      <p className="text-base font-semibold text-white">{emptyTitle}</p>
                      <p className="mt-2 text-sm text-slate-400">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/70 bg-slate-950/35 last:border-b-0">
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={cn(
                          "px-4 py-4 align-top text-sm text-slate-200",
                          column.align === "right" ? "text-right" : "text-left",
                          column.className
                        )}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Showing <span className="font-semibold text-white">{from}</span>-
          <span className="font-semibold text-white">{to}</span> of{" "}
          <span className="font-semibold text-white">{totalItems}</span>
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="gap-2"
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-slate-300">
            Page {currentPage} / {totalPages}
          </div>
          <Button
            variant="secondary"
            className="gap-2"
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
