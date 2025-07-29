"use client";

import { useState, useEffect } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { ProductDetails } from "@/types/product";
import { useNavigate } from "@tanstack/react-router";

// Action button component
function ActionButton({ productId }: { productId: string }) {
  const navigate = useNavigate();

  const handleView = () => {
    navigate({ to: "/product/$productId", params: { productId } });
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleView}
      className="h-8 w-8 p-0"
    >
      <Eye className="h-4 w-4" />
    </Button>
  );
}

// Define the columns for the data table
const columns: ColumnDef<ProductDetails>[] = [
  {
    id: "actions",
    header: "Actions",
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

export function ProductsPage() {
  const [data, setData] = useState<ProductDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/productV2/get_all_products_for_cron`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ProductDetails[] = await response.json();
      console.log(result);

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching products:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading products
              </h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={() => fetchProducts()}>
                  Try Again
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Products</h1>
        <p className="text-muted-foreground">
          View and manage product pricing data
        </p>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Total products: {data.length}
          </div>
        </div>
      </div>

      <DataTable columns={columns} data={data} isLoading={isLoading} />
    </div>
  );
}
