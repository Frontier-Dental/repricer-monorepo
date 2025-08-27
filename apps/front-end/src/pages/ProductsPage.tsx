"use client";

import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import type { ProductDetails } from "@/types/product";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
} from "@tanstack/react-table";

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

// Action button component
function ActionButton({ productId }: { productId: string }) {
  const handleView = () => {
    window.open(`/vite/product/${productId}`, "_blank");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleView}
      className="cursor-pointer"
      title="View product details in new tab"
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}

// Algorithm Execution Mode component
function AlgoExecutionModeSelect({
  productId,
  initialValue,
  onToggle,
}: {
  productId: string;
  initialValue: string;
  onToggle: (productId: string, value: string) => void;
}) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [value, setValue] = useState(initialValue);

  const handleChange = async (newValue: string) => {
    setIsUpdating(true);
    try {
      const response = await fetch(
        `/v2-algo/update_algo_execution_mode/${productId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ algo_execution_mode: newValue }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setValue(newValue);
      onToggle(productId, newValue);
      toast.success("Algorithm execution mode updated successfully!");
    } catch (error) {
      console.error("Error updating algorithm execution mode:", error);
      toast.error(
        "Failed to update algorithm execution mode. Please try again.",
      );
      // Revert the change if the update failed
      setValue(value);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Select value={value} onValueChange={handleChange} disabled={isUpdating}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="V1_ONLY">V1 Only</SelectItem>
          <SelectItem value="V2_ONLY">V2 Only</SelectItem>
          <SelectItem value="V2_EXECUTE_V1_DRY">V2 + V1 Dry</SelectItem>
          <SelectItem value="V1_EXECUTE_V2_DRY">V1 + V2 Dry</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ProductsPage() {
  const [data, setData] = useState<ProductDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isRemoving422, setIsRemoving422] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Define the columns for the data table
  const columns: ColumnDef<ProductDetails>[] = [
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const productId = row.getValue("ProductId") as string;
        return <ActionButton productId={productId} />;
      },
    },
    {
      accessorKey: "ProductId",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            MPID
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-mono">{row.getValue("ProductId")}</div>
      ),
      filterFn: (row, columnId, filterValue) => {
        return parseInt(row.getValue(columnId)) === parseInt(filterValue);
      },
    },
    {
      accessorKey: "IsActive",
      header: "Status",
      cell: ({ row }) => {
        const activated = row.getValue("IsActive") as number;
        return (
          <Badge variant={activated === 1 ? "default" : "secondary"}>
            {activated === 1 ? "Active" : "Inactive"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "IsBadgeItem",
      header: "Badge Item",
      cell: ({ row }) => {
        const isBadgeItem = row.getValue("IsBadgeItem") as number;
        return (
          <Badge variant={isBadgeItem === 1 ? "default" : "secondary"}>
            {isBadgeItem === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "algo_execution_mode",
      header: "Execution Mode",
      cell: ({ row }) => {
        const productId = row.getValue("ProductId") as string;
        const algoExecutionMode = row.getValue("algo_execution_mode") as string;
        return (
          <AlgoExecutionModeSelect
            productId={productId}
            initialValue={algoExecutionMode || "V1_ONLY"}
            onToggle={(id, value) => {
              // Update the local state when execution mode changes
              const updatedData = data.map((product: ProductDetails) =>
                product.ProductId.toString() === id.toString()
                  ? { ...product, algo_execution_mode: value }
                  : product,
              );
              setData(updatedData);
            }}
          />
        );
      },
    },
    {
      accessorKey: "RegularCronName",
      enableColumnFilter: true,
      header: "Regular Cron",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("RegularCronName")}
        </div>
      ),
    },
    {
      accessorKey: "Net32Url",
      header: "Net32 URL",
      cell: ({ row }) => {
        const url = row.getValue("Net32Url") as string;
        return (
          <div className="max-w-[200px]">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              View Product <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        );
      },
    },
  ];

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

  interface ApiResponse {
    data: ProductDetails[];
    cacheTimestamp: string;
    isCached: boolean;
  }

  const fetchProducts = async (ignoreCache: boolean = false) => {
    setIsLoading(true);
    setError(null);

    console.log("fetching products");

    try {
      const url = ignoreCache
        ? `/v2-algo/get_all_products_for_cron?ignoreCache=true`
        : `/v2-algo/get_all_products_for_cron`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();
      setData(result.data);
      setCacheTimestamp(result.cacheTimestamp);
      setIsCached(result.isCached);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load data on mount
  useEffect(() => {
    fetchProducts(false);
  }, []);

  const handleRefresh = () => {
    fetchProducts(true);
  };

  const handleRemoveAllFrom422 = async () => {
    setIsRemoving422(true);
    try {
      const response = await fetch("/productV2/removeFrom422ForAll");
      const result = await response.json();
      if (response.ok && result.status) {
        toast.success("All products removed from 422.");
      } else {
        toast.error(result.message || "Failed to remove products from 422.");
      }
    } catch (err) {
      console.error("Error removing products from 422:", err);
      toast.error("Failed to remove products from 422.");
    } finally {
      setIsRemoving422(false);
    }
  };

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          View and manage product pricing data
        </p>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total products: {data.length}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? "Refreshing..." : "Refresh Data"}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemoveAllFrom422}
            disabled={isRemoving422}
          >
            {isRemoving422 ? "Removing..." : "Remove All From 422"}
          </Button>
          <div className="flex flex-col items-end text-xs text-muted-foreground">
            {cacheTimestamp && (
              <>
                <span>Last updated: {timeAgo(cacheTimestamp)}</span>
                {isCached && (
                  <span className="text-blue-600">(from cache)</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <DataTableToolbar table={table} />
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
                Error loading products
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
