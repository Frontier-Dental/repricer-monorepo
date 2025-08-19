"use client";

import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Download, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

interface V2AlgoResultWithExecution {
  // From v2_algo_results table
  id: number;
  job_id: string;
  suggested_price: number | null;
  comment: string;
  triggered_by_vendor: string | null;
  result: string;
  quantity: number;
  vendor_id: number;
  vendor_name: string; // New field for vendor name
  mp_id: number;
  cron_name: string;
  run_time: string;
  q_break_valid: boolean;
  price_update_result: string | null;

  // Only the HTML content from v2_algo_execution
  chain_of_thought_html: string | null;
}

interface AlgoApiResponse {
  data: V2AlgoResultWithExecution[];
  mp_id: number;
  count: number;
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { mpId } = useParams({ from: "/product/$mpId" });
  const [algoData, setAlgoData] = useState<V2AlgoResultWithExecution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    navigate({ to: "/" });
  };

  const openHtmlInNewTab = (htmlContent: string) => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    URL.revokeObjectURL(url);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const algoResponse = await fetch(
        `/v2-algo/get_algo_results_with_execution/${mpId}`,
      );

      if (!algoResponse.ok) {
        throw new Error(`HTTP error! status: ${algoResponse.status}`);
      }

      const algoResult: AlgoApiResponse = await algoResponse.json();

      if (algoResponse.status) {
        setAlgoData(algoResult.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      console.error("Error fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [mpId]);

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const truncateComment = (comment: string, maxLength: number = 100) => {
    if (!comment) return "No comment provided";
    if (comment.length <= maxLength) return comment;
    return comment.substring(0, maxLength) + "...";
  };

  const formatPrice = (price: number | string) => {
    if (price === null || price === undefined || price === "") return "N/A";
    return `$${parseFloat(price.toString()).toFixed(2)}`;
  };

  const getResultBadgeVariant = (result: string) => {
    switch (result?.toUpperCase()) {
      case "CHANGE_DOWN":
        return "destructive";
      case "CHANGE_UP":
        return "default";
      case "IGNORE_FLOOR":
        return "secondary";
      case "IGNORE_MAX":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getPriceUpdateResultBadgeVariant = (result: string | null) => {
    if (!result) return "secondary";
    switch (result.toUpperCase()) {
      case "SUCCESS":
        return "default";
      case "FAILED":
        return "destructive";
      case "PENDING":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Define columns for the DataTable
  const columns: ColumnDef<V2AlgoResultWithExecution>[] = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <div className="font-medium">#{row.getValue("id")}</div>
      ),
    },
    {
      accessorKey: "job_id",
      header: "Job ID",
      cell: ({ row }) => (
        <div className="font-mono text-xs">{row.getValue("job_id")}</div>
      ),
    },
    {
      accessorKey: "vendor_id",
      header: "Vendor ID",
      cell: ({ row }) => <div>{row.getValue("vendor_id")}</div>,
    },
    {
      accessorKey: "vendor_name",
      header: "Vendor Name",
      cell: ({ row }) => <div>{row.getValue("vendor_name")}</div>,
    },
    {
      accessorKey: "quantity",
      header: "Quantity",
      cell: ({ row }) => <div>{row.getValue("quantity")}</div>,
    },
    {
      accessorKey: "suggested_price",
      header: "Suggested Price",
      cell: ({ row }) => {
        const price = row.getValue("suggested_price") as number | null;
        return <div>{price ? formatPrice(price) : "N/A"}</div>;
      },
    },
    {
      accessorKey: "result",
      header: "Result",
      cell: ({ row }) => {
        const result = row.getValue("result") as string;
        return <Badge variant={getResultBadgeVariant(result)}>{result}</Badge>;
      },
    },
    {
      accessorKey: "triggered_by_vendor",
      header: "Triggered By",
      cell: ({ row }) => {
        const triggeredBy = row.getValue("triggered_by_vendor") as
          | string
          | null;
        return (
          <div className="text-sm">
            {triggeredBy ? (
              <Badge variant="outline" className="text-xs">
                {triggeredBy}
              </Badge>
            ) : (
              <span className="text-muted-foreground">N/A</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "price_update_result",
      header: "Price Update Result",
      cell: ({ row }) => {
        const result = row.getValue("price_update_result") as string | null;
        return (
          <Badge variant={getPriceUpdateResultBadgeVariant(result)}>
            {result || "N/A"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "q_break_valid",
      header: "Q-Break Valid",
      cell: ({ row }) => {
        const isValid = row.getValue("q_break_valid") as boolean;
        return (
          <Badge variant={isValid ? "default" : "secondary"}>
            {isValid ? "Valid" : "Invalid"}
          </Badge>
        );
      },
    },
    {
      accessorKey: "cron_name",
      header: "Cron Name",
      cell: ({ row }) => (
        <div className="text-sm">{row.getValue("cron_name")}</div>
      ),
    },
    {
      accessorKey: "run_time",
      header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Run Time
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const runTime = row.getValue("run_time") as string;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{formatDate(runTime)}</span>
          </div>
        );
      },
      sortingFn: "datetime",
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) => {
        const comment = row.getValue("comment") as string;
        return (
          <div className="max-w-md">
            <p className="text-sm">{truncateComment(comment)}</p>
            {comment && comment.length > 100 && (
              <p className="text-xs text-muted-foreground mt-1">
                {comment.length} characters total
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const record = row.original;
        return (
          <div>
            {record.chain_of_thought_html ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => openHtmlInNewTab(record.chain_of_thought_html!)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                View HTML
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">No HTML</span>
            )}
          </div>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={handleBack}
            className="mb-4 flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Product Details</h1>
          <p className="text-muted-foreground">Product ID: {mpId}</p>
        </div>

        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading data
              </h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
              <div className="mt-4">
                <Button variant="outline" onClick={fetchData}>
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
        <Button
          variant="outline"
          onClick={handleBack}
          className="mb-4 flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Product Details</h1>
        <p className="text-muted-foreground">Product ID: {mpId}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              Algorithm Results & Execution History
            </h2>
            <p className="text-muted-foreground mt-1">
              {algoData.length} algorithm execution
              {algoData.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {algoData.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No algorithm results found for this product.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={algoData}
          isLoading={isLoading}
          initialSorting={[
            {
              id: "run_time",
              desc: true,
            },
          ]}
        />
      )}
    </div>
  );
}
