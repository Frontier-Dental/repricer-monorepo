"use client";

import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { ProductDetails } from "@/types/product";
import { toast } from "sonner";

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
    accessorKey: "ChannelName",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Channel
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div>{row.getValue("ChannelName")}</div>,
  },
  {
    accessorKey: "ChannelId",
    header: "Channel ID",
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.getValue("ChannelId")}</div>
    ),
  },
  {
    accessorKey: "UnitPrice",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Unit Price
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const price = row.getValue("UnitPrice") as string;
      return <div className="font-medium">${price}</div>;
    },
  },
  {
    accessorKey: "FloorPrice",
    header: "Floor Price",
    cell: ({ row }) => {
      const price = row.getValue("FloorPrice") as string;
      return <div>${price}</div>;
    },
  },
  {
    accessorKey: "MaxPrice",
    header: "Max Price",
    cell: ({ row }) => {
      const price = row.getValue("MaxPrice") as string;
      return <div>${price}</div>;
    },
  },
  {
    accessorKey: "Activated",
    header: "Status",
    cell: ({ row }) => {
      const activated = row.getValue("Activated") as number;
      return (
        <Badge variant={activated === 1 ? "default" : "secondary"}>
          {activated === 1 ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "ScrapeOn",
    header: "Scrape On",
    cell: ({ row }) => {
      const scrapeOn = row.getValue("ScrapeOn") as number;
      return (
        <Badge variant={scrapeOn === 1 ? "default" : "secondary"}>
          {scrapeOn === 1 ? "Yes" : "No"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "AllowReprice",
    header: "Allow Reprice",
    cell: ({ row }) => {
      const allowReprice = row.getValue("AllowReprice") as number;
      return (
        <Badge variant={allowReprice === 1 ? "default" : "secondary"}>
          {allowReprice === 1 ? "Yes" : "No"}
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
    accessorKey: "LowestVendor",
    header: "Lowest Vendor",
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate">
        {row.getValue("LowestVendor")}
      </div>
    ),
  },
  {
    accessorKey: "LowestVendorPrice",
    header: "Lowest Vendor Price",
    cell: ({ row }) => (
      <div className="font-mono text-sm">
        {row.getValue("LowestVendorPrice")}
      </div>
    ),
  },
  {
    accessorKey: "LastExistingPrice",
    header: "Last Existing Price",
    cell: ({ row }) => (
      <div className="font-mono text-sm">
        {row.getValue("LastExistingPrice")}
      </div>
    ),
  },
  {
    accessorKey: "LastSuggestedPrice",
    header: "Last Suggested Price",
    cell: ({ row }) => (
      <div className="font-mono text-sm">
        {row.getValue("LastSuggestedPrice")}
      </div>
    ),
  },
  {
    accessorKey: "LastCronMessage",
    header: "Last Cron Message",
    cell: ({ row }) => {
      const message = row.getValue("LastCronMessage") as string;
      return <div className="max-w-[300px] truncate text-sm">{message}</div>;
    },
  },
  {
    accessorKey: "LastCronTime",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Cron Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("LastCronTime"));
      return (
        <div className="text-sm">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      );
    },
  },
  {
    accessorKey: "LastUpdateTime",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Last Update Time
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("LastUpdateTime"));
      return (
        <div className="text-sm">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      );
    },
  },
  {
    accessorKey: "RegularCronName",
    enableColumnFilter: true,
    header: "Regular Cron",
    cell: ({ row }) => (
      <div className="font-mono text-sm">{row.getValue("RegularCronName")}</div>
    ),
  },
  {
    accessorKey: "LinkedScrapeOnlyCron",
    header: "Scrape Only Cron",
    cell: ({ row }) => (
      <div className="font-mono text-sm">
        {row.getValue("LinkedScrapeOnlyCron")}
      </div>
    ),
  },
  {
    accessorKey: "ExecutionPriority",
    header: "Execution Priority",
    cell: ({ row }) => (
      <div className="font-mono">{row.getValue("ExecutionPriority")}</div>
    ),
  },
  {
    accessorKey: "PriorityValue",
    header: "Priority Value",
    cell: ({ row }) => (
      <div className="font-mono">{row.getValue("PriorityValue")}</div>
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
  {
    accessorKey: "UpdatedAt",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Updated At
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const date = new Date(row.getValue("UpdatedAt"));
      return (
        <div className="text-sm">
          {date.toLocaleDateString()} {date.toLocaleTimeString()}
        </div>
      );
    },
  },
  {
    accessorKey: "UpdatedBy",
    header: "Updated By",
    cell: ({ row }) => (
      <div className="text-sm">{row.getValue("UpdatedBy")}</div>
    ),
  },
];

interface ApiResponse {
  data: ProductDetails[];
  cacheTimestamp: string;
  isCached: boolean;
}

export function ProductsPage() {
  const [data, setData] = useState<ProductDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheTimestamp, setCacheTimestamp] = useState<string | null>(null);
  const [isCached, setIsCached] = useState<boolean>(false);
  const [isRemoving422, setIsRemoving422] = useState(false);

  const fetchProducts = async (ignoreCache: boolean = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const url = ignoreCache
        ? `/productV2/get_all_products_for_cron?ignoreCache=true`
        : `/productV2/get_all_products_for_cron`;

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
      <DataTable columns={columns} data={data} isLoading={isLoading} />
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
