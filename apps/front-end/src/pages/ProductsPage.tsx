"use client";

import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Eye, Globe, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table-toolbar";
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
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Action button component
function ActionButton({
  productId,
  net32Url,
}: {
  productId: string;
  net32Url: string | null;
}) {
  const [isRemovingFrom422, setIsRemovingFrom422] = useState(false);

  const handleView = () => {
    window.open(`/vite/product/${productId}`, "_blank");
  };

  const handleOpenNet32 = () => {
    if (net32Url) {
      window.open(net32Url, "_blank");
    }
  };

  const handleRemoveFrom422 = async () => {
    if (!net32Url) return;

    setIsRemovingFrom422(true);
    try {
      const response = await fetch("/productV2/removeFrom422", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mpIds: [parseInt(productId)] }),
      });

      const result = await response.json();
      if (response.ok && result.status) {
        toast.success("Product removed from 422 successfully!");
      } else {
        toast.error(result.message || "Failed to remove product from 422.");
      }
    } catch (err) {
      console.error("Error removing product from 422:", err);
      toast.error("Failed to remove product from 422.");
    } finally {
      setIsRemovingFrom422(false);
    }
  };

  return (
    <div className="flex items-center space-x-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        className="cursor-pointer"
        title="View product details in new tab"
      >
        <Eye className="h-4 w-4" />
      </Button>
      {net32Url && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenNet32}
          className="cursor-pointer"
          title="Open Net32 URL in new tab"
        >
          <Globe className="h-4 w-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemoveFrom422}
        disabled={isRemovingFrom422 || !net32Url}
        className="cursor-pointer"
        title="Remove product from 422"
      >
        <Bell className="h-4 w-4" />
      </Button>
    </div>
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

// Define the type for products with algo data
interface ProductWithAlgoData {
  channel_name: string;
  enabled: number;
  mp_id: number;
  channel_id: string | null;
  cron_name: string | null;
  slow_cron_name: string | null;
  last_cron_run_at: string | null;
  last_cron_run_name: string | null;
  last_updated_at: string | null;
  last_updated_cron_name: string | null;
  last_reprice_comment: string | null;
  last_suggested_price: number | null;
  floor_price: number | null;
  max_price: number | null;
  not_cheapest: number;
  suppress_price_break_if_Q1_not_updated: number;
  triggered_by_vendor: string | null;
  result: string | null;
  net32_url: string | null;
  algo_execution_mode: string | null;
}

export function ProductsPage() {
  const [data, setData] = useState<ProductWithAlgoData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isRemoving422, setIsRemoving422] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  // Define the columns for the data table
  const columns: ColumnDef<ProductWithAlgoData>[] = [
    {
      id: "actions",
      header: "",
      cell: ({ row }) => {
        const mpId = row.getValue("mp_id") as number;
        const net32Url = row.getValue("net32_url") as string | null;
        return <ActionButton productId={mpId.toString()} net32Url={net32Url} />;
      },
    },
    {
      accessorKey: "channel_name",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Channel Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("channel_name")}</div>
      ),
    },
    {
      accessorKey: "enabled",
      header: "Enabled",
      cell: ({ row }) => {
        const enabled = row.getValue("enabled") as number;
        return (
          <Badge variant={enabled === 1 ? "default" : "secondary"}>
            {enabled === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
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
      cell: ({ row }) => (
        <div className="font-mono">{row.getValue("mp_id")}</div>
      ),
      filterFn: (row, columnId, filterValue) => {
        if (!filterValue) return true;
        const rowValue = row.getValue(columnId) as number;
        const filterNum = parseInt(filterValue, 10);
        return !isNaN(filterNum) && rowValue === filterNum;
      },
    },
    {
      accessorKey: "channel_id",
      header: "Channel ID",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("channel_id") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "cron_name",
      header: "Cron Name",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "slow_cron_name",
      header: "Slow Cron Name",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("slow_cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_cron_run_at",
      header: "Last Cron Run",
      cell: ({ row }) => {
        const date = row.getValue("last_cron_run_at") as string;
        return (
          <div className="text-sm">
            {date ? new Date(date).toLocaleString() : "Never"}
          </div>
        );
      },
    },
    {
      accessorKey: "last_cron_run_name",
      header: "Last Cron Run Name",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("last_cron_run_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_updated_at",
      header: "Last Updated",
      cell: ({ row }) => {
        const date = row.getValue("last_updated_at") as string;
        return <div className="text-sm">{date ? timeAgo(date) : "Never"}</div>;
      },
    },
    {
      accessorKey: "last_updated_cron_name",
      header: "Last Updated Cron",
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {row.getValue("last_updated_cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_reprice_comment",
      header: "Last Reprice Comment",
      cell: ({ row }) => (
        <div className="text-sm max-w-[200px] truncate">
          {row.getValue("last_reprice_comment") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_suggested_price",
      header: "Last Suggested Price",
      cell: ({ row }) => {
        const price = row.getValue("last_suggested_price") as number;
        return <div className="text-sm">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "floor_price",
      header: "Floor Price",
      cell: ({ row }) => {
        const price = row.getValue("floor_price") as number;
        return <div className="text-sm">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "max_price",
      header: "Max Price",
      cell: ({ row }) => {
        const price = row.getValue("max_price") as number;
        return <div className="text-sm">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "not_cheapest",
      header: "Not Cheapest",
      cell: ({ row }) => {
        const notCheapest = row.getValue("not_cheapest") as number;
        return (
          <Badge variant={notCheapest === 1 ? "default" : "secondary"}>
            {notCheapest === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "suppress_price_break_if_Q1_not_updated",
      header: "Suppress PB if Q1 not updated",
      cell: ({ row }) => {
        const suppress = row.getValue(
          "suppress_price_break_if_Q1_not_updated",
        ) as number;
        return (
          <Badge variant={suppress === 1 ? "default" : "secondary"}>
            {suppress === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "triggered_by_vendor",
      header: "Triggered By",
      cell: ({ row }) => (
        <div className="text-sm">
          {row.getValue("triggered_by_vendor") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "result",
      header: "Result",
      cell: ({ row }) => {
        const result = row.getValue("result") as string;
        if (!result) return <div className="text-sm">N/A</div>;

        const getBadgeVariant = (result: string) => {
          if (result.includes("SUCCESS") || result.includes("OK"))
            return "default";
          if (result.includes("ERROR") || result.includes("FAIL"))
            return "destructive";
          return "secondary";
        };

        return <Badge variant={getBadgeVariant(result)}>{result}</Badge>;
      },
    },
    {
      accessorKey: "algo_execution_mode",
      header: "Execution Mode",
      cell: ({ row }) => {
        const mpId = row.getValue("mp_id") as number;
        const algoExecutionMode = row.getValue("algo_execution_mode") as string;
        return (
          <AlgoExecutionModeSelect
            productId={mpId.toString()}
            initialValue={algoExecutionMode || "V1_ONLY"}
            onToggle={(id, value) => {
              // Update the local state when execution mode changes
              const updatedData = data.map((product: ProductWithAlgoData) =>
                product.mp_id.toString() === id.toString()
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
      accessorKey: "net32_url",
      header: "Net32 URL",
      cell: ({ row }) => {
        const url = row.getValue("net32_url") as string;
        return (
          <div className="max-w-[200px]">
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View Product <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <div className="text-sm text-muted-foreground">N/A</div>
            )}
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
    data: ProductWithAlgoData[];
    cacheTimestamp: string;
    isCached: boolean;
  }

  const fetchProducts = async (ignoreCache: boolean = false) => {
    setIsLoading(true);
    setError(null);

    console.log("fetching products with algo data");

    try {
      const url = ignoreCache
        ? `/v2-algo/get_all_products_with_algo_data?ignoreCache=true`
        : `/v2-algo/get_all_products_with_algo_data`;

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
      console.error("Error fetching products with algo data:", err);
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
        <h1 className="text-3xl font-bold tracking-tight">
          Products with Algorithm Data
        </h1>
        <p className="text-muted-foreground">
          View and manage product pricing data with algorithm settings and
          execution history
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
