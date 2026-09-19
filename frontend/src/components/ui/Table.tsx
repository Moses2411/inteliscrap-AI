import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface Column<T> {
  key: string;
  label: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  render: (row: T) => ReactNode;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  dense?: boolean;
  className?: string;
}

export function Table<T>({ columns, rows, rowKey, empty, dense, className }: Props<T>) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  "whitespace-nowrap px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500",
                  dense ? "py-2" : "py-2.5",
                  col.align === "right" && "text-right",
                  col.align === "center" && "text-center",
                  col.className,
                )}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-800/40"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={cn(
                    "px-3 text-slate-700 dark:text-slate-200",
                    dense ? "py-2" : "py-3",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.className,
                  )}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && empty && <div>{empty}</div>}
    </div>
  );
}