"use client";

import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

interface V2AlgoErrorRecord {
  id: number;
  created_at: string;
  error: string;
  net32_json: string;
  mp_id: number;
  cron_name: string;
}

interface ApiResponse {
  data: V2AlgoErrorRecord[];
  count: number;
}

// Utility to format "ago" time
function timeAgo(date: Date | string | number) {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Define the columns for the data table
const columns: ColumnDef<V2AlgoErrorRecord>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <div className="font-medium">#{row.getValue("id")}</div>,
  },
  {
    accessorKey: "mp_id",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          MP ID
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-mono">{row.getValue("mp_id")}</div>,
  },
  {
    accessorKey: "cron_name",
    header: "Cron Name",
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.getValue("cron_name")}</div>
    ),
  },
  {
    accessorKey: "created_at",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Created At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const createdAt = row.getValue("created_at") as string;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{timeAgo(createdAt)}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(createdAt).toLocaleString()}
          </span>
        </div>
      );
    },
    sortingFn: "datetime",
  },
  {
    accessorKey: "error",
    header: "Error Message",
    cell: ({ row }) => {
      const error = row.getValue("error") as string;
      const truncatedError =
        error.length > 40 ? error.substring(0, 40) + "..." : error;
      return (
        <div className="max-w-md">
          <p className="text-sm">{truncatedError}</p>
        </div>
      );
    },
  },
  {
    accessorKey: "net32_json",
    header: "Net32 Data",
    cell: ({ row }) => {
      const net32Json = row.getValue("net32_json") as string;
      try {
        const productCount = Array.isArray(net32Json)
          ? net32Json.length
          : "N/A";
        return (
          <div className="text-sm">
            <Badge variant="outline">{productCount} products</Badge>
          </div>
        );
      } catch {
        return (
          <div className="text-sm text-muted-foreground">Invalid JSON</div>
        );
      }
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const record = row.original;
      return (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([record.error], {
                type: "text/plain;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Error
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const blob = new Blob([JSON.stringify(record.net32_json)], {
                type: "application/json;charset=utf-8",
              });
              const url = URL.createObjectURL(blob);
              window.open(url, "_blank");
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            View Data
          </Button>
        </div>
      );
    },
  },
];

export function ErrorsPage() {
  const [data, setData] = useState<V2AlgoErrorRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Create table instance for the toolbar
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const fetchErrors = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/v2-algo/get_all_algo_errors");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      setData(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching errors:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchErrors();
  }, []);

  const handleRefresh = () => {
    fetchErrors();
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Unhandled Errors</h1>
        <p className="text-muted-foreground">
          View and monitor algorithm execution errors
        </p>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total errors: {data.length}
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh Data"}
        </Button>
      </div>
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        table={table}
      />
      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading data
              </h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={handleRefresh}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
