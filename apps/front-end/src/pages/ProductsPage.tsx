"use client";

import { DataTable } from "@/components/data-table";
import { DataTableToolbar } from "@/components/data-table-toolbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlgoPriceStrategy } from "@repricer-monorepo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import {
  ColumnFiltersState,
  ColumnPinningState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
import { ArrowUpDown, Bell, Eye, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
        className="cursor-pointer h-7 w-7 p-0"
        title="View product details in new tab"
      >
        <Eye className="h-3 w-3" />
      </Button>
      {net32Url && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenNet32}
          className="cursor-pointer h-7 w-7 p-0"
          title="Open Net32 URL in new tab"
        >
          <Globe className="h-3 w-3" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRemoveFrom422}
        disabled={isRemovingFrom422 || !net32Url}
        className="cursor-pointer h-7 w-7 p-0"
        title="Remove product from 422"
      >
        <Bell className="h-3 w-3" />
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
        <SelectTrigger className="w-[120px] h-7 text-xs">
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
  price_strategy: AlgoPriceStrategy;
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
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({
    left: ["channel_name", "mp_id"],
    right: [],
  });

  // Define the columns for the data table
  const columns: ColumnDef<ProductWithAlgoData>[] = [
    {
      id: "actions",
      header: "",
      size: 80,
      cell: ({ row }) => {
        const mpId = row.getValue("mp_id") as number;
        const net32Url = row.original.net32_url as string | null;
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
            className="h-8 px-2 text-xs"
          >
            Channel
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        );
      },
      size: 100,
      cell: ({ row }) => (
        <div
          className="font-medium text-xs truncate"
          title={row.getValue("channel_name") as string}
        >
          {row.getValue("channel_name")}
        </div>
      ),
    },

    {
      accessorKey: "product_active",
      header: "Prod Active",
      size: 70,
      cell: ({ row }) => {
        const enabled = row.getValue("product_active") as number;
        return (
          <Badge
            variant={enabled === 1 ? "default" : "secondary"}
            className="text-xs px-1 py-0"
          >
            {enabled === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "enabled",
      header: "Reprice Enabled",
      size: 70,
      cell: ({ row }) => {
        const enabled = row.getValue("enabled") as number;
        return (
          <Badge
            variant={enabled === 1 ? "default" : "secondary"}
            className="text-xs px-1 py-0"
          >
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
            className="h-8 px-2 text-xs"
          >
            MP ID
            <ArrowUpDown className="ml-1 h-3 w-3" />
          </Button>
        );
      },
      size: 80,
      cell: ({ row }) => (
        <div className="font-mono text-xs">{row.getValue("mp_id")}</div>
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
      header: "Ch ID",
      size: 80,
      cell: ({ row }) => (
        <div
          className="font-mono text-xs truncate"
          title={row.getValue("channel_id") as string}
        >
          {row.getValue("channel_id") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "cron_name",
      header: "Cron",
      size: 90,
      cell: ({ row }) => (
        <div
          className="font-mono text-xs truncate"
          title={row.getValue("cron_name") as string}
        >
          {row.getValue("cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "slow_cron_name",
      header: "Slow Cron",
      size: 90,
      cell: ({ row }) => (
        <div
          className="font-mono text-xs truncate"
          title={row.getValue("slow_cron_name") as string}
        >
          {row.getValue("slow_cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_cron_run_at",
      header: "Last Run",
      size: 120,
      cell: ({ row }) => {
        const date = row.getValue("last_cron_run_at") as string;
        if (!date) return <div className="text-xs">Never</div>;

        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString();

        return (
          <div className="text-xs">
            <div>{dateStr}</div>
            <div className="text-muted-foreground">{timeStr}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "last_cron_run_name",
      header: "Run Name",
      size: 100,
      cell: ({ row }) => (
        <div
          className="font-mono text-xs truncate"
          title={row.getValue("last_cron_run_name") as string}
        >
          {row.getValue("last_cron_run_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_updated_at",
      header: "Updated",
      size: 100,
      cell: ({ row }) => {
        const date = row.getValue("last_updated_at") as string;
        if (!date) return <div className="text-xs">Never</div>;

        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString();
        const timeStr = dateObj.toLocaleTimeString();

        return (
          <div className="text-xs">
            <div>{dateStr}</div>
            <div className="text-muted-foreground">{timeStr}</div>
          </div>
        );
      },
    },
    {
      accessorKey: "last_updated_cron_name",
      header: "Update Cron",
      size: 100,
      cell: ({ row }) => (
        <div
          className="font-mono text-xs truncate"
          title={row.getValue("last_updated_cron_name") as string}
        >
          {row.getValue("last_updated_cron_name") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_reprice_comment",
      header: "Comment",
      size: 150,
      cell: ({ row }) => (
        <div
          className="text-xs truncate"
          title={row.getValue("last_reprice_comment") as string}
        >
          {row.getValue("last_reprice_comment") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "last_suggested_price",
      header: "Suggested",
      size: 80,
      cell: ({ row }) => {
        const price = row.getValue("last_suggested_price") as number;
        return <div className="text-xs">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "lowest_price",
      header: "Lowest",
      size: 70,
      cell: ({ row }) => {
        const price = row.getValue("lowest_price") as number;
        return <div className="text-xs">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "target_price",
      header: "Target",
      size: 70,
      cell: ({ row }) => {
        const price = row.getValue("target_price") as number;
        return <div className="text-xs">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "floor_price",
      header: "Floor",
      size: 70,
      cell: ({ row }) => {
        const price = row.getValue("floor_price") as number;
        return <div className="text-xs">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "max_price",
      header: "Max",
      size: 70,
      cell: ({ row }) => {
        const price = row.getValue("max_price") as number;
        return <div className="text-xs">{price ? `$${price}` : "N/A"}</div>;
      },
    },
    {
      accessorKey: "price_strategy",
      header: "Strategy",
      size: 100,
      cell: ({ row }) => {
        const priceStrategy = row.getValue(
          "price_strategy",
        ) as AlgoPriceStrategy;
        return (
          <Badge variant="outline" className="text-xs px-1 py-0">
            {priceStrategy}
          </Badge>
        );
      },
    },
    {
      accessorKey: "suppress_price_break_if_Q1_not_updated",
      header: "Suppress PB",
      size: 90,
      cell: ({ row }) => {
        const suppress = row.getValue(
          "suppress_price_break_if_Q1_not_updated",
        ) as number;
        return (
          <Badge
            variant={suppress === 1 ? "default" : "secondary"}
            className="text-xs px-1 py-0"
          >
            {suppress === 1 ? "Yes" : "No"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "triggered_by_vendor",
      header: "Triggered",
      size: 100,
      cell: ({ row }) => (
        <div
          className="text-xs truncate"
          title={row.getValue("triggered_by_vendor") as string}
        >
          {row.getValue("triggered_by_vendor") || "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "result",
      header: "Result",
      size: 120,
      cell: ({ row }) => {
        const result = row.getValue("result") as string;
        if (!result) return <div className="text-xs">N/A</div>;

        const getBadgeVariant = (result: string) => {
          if (result.includes("SUCCESS") || result.includes("OK"))
            return "default";
          if (result.includes("ERROR") || result.includes("FAIL"))
            return "destructive";
          return "secondary";
        };

        return (
          <Badge
            variant={getBadgeVariant(result)}
            className="text-xs px-1 py-0 truncate"
            title={result}
          >
            {result}
          </Badge>
        );
      },
    },
    {
      accessorKey: "algo_execution_mode",
      header: "Exec Mode",
      size: 140,
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
  ];

  // Create table instance for the toolbar
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: {
      columnPinning: {
        left: ["channel_name", "mp_id"],
        right: [],
      },
    },
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

  const handleSyncAllSettings = async () => {
    setIsSyncingSettings(true);
    try {
      const response = await fetch("/v2-algo/sync_all_vendor_settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        // Show success message with summary

        toast.success(
          <div>
            <div className="font-semibold">Sync completed successfully!</div>
          </div>,
          { duration: 5000 },
        );

        // Refresh the products data to show updated information
        await fetchProducts(true);
      } else {
        toast.error(result.message || "Failed to sync settings");
      }
    } catch (error) {
      console.error("Error syncing all settings:", error);
      toast.error("Failed to sync all settings. Please try again.");
    } finally {
      setIsSyncingSettings(false);
    }
  };

  return (
    <div className="container mx-auto py-10 px-4 max-w-[95vw]">
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
            {isLoading ? "Refreshing..." : "Refresh Data (Ignore Cache)"}
          </Button>
          <Button
            variant="default"
            onClick={handleSyncAllSettings}
            disabled={isSyncingSettings}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isSyncingSettings ? "Syncing..." : "Sync All Settings"}
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
                <span>
                  Last updated: {new Date(cacheTimestamp).toLocaleDateString()}
                </span>
                <span>{new Date(cacheTimestamp).toLocaleTimeString()}</span>
                {isCached && (
                  <span className="text-blue-600">(from cache)</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <DataTableToolbar table={table} />
      <div className="w-full overflow-x-auto">
        <DataTable
          columns={columns}
          data={data}
          isLoading={isLoading}
          table={table}
        />
      </div>
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
