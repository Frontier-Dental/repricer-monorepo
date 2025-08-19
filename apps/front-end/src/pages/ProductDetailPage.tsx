"use client";

import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Download, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { V2AlgoSettingsForm } from "@/components/V2AlgoSettingsForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Cross2Icon } from "@radix-ui/react-icons";

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

interface V2AlgoSettings {
  id?: number;
  mp_id: number;
  vendor_id: number;
  suppress_price_break_if_Q1_not_updated: boolean;
  suppress_price_break: boolean;
  compete_on_price_break_only: boolean;
  up_down: "UP" | "UP/DOWN" | "DOWN";
  badge_indicator: "ALL" | "BADGE";
  execution_priority: number;
  reprice_up_percentage: number;
  compare_q2_with_q1: boolean;
  compete_with_all_vendors: boolean;
  reprice_up_badge_percentage: number;
  sister_vendor_ids: string;
  exclude_vendors: string;
  inactive_vendor_id: string;
  handling_time_group: boolean;
  keep_position: boolean;
  inventory_competition_threshold: number;
  reprice_down_percentage: number;
  max_price: number;
  floor_price: number;
  reprice_down_badge_percentage: number;
  floor_compete_with_next: boolean;
  compete_with_own_quantity_0: boolean;
  not_cheapest: boolean;
}

interface AlgoApiResponse {
  data: V2AlgoResultWithExecution[];
  mp_id: number;
  count: number;
}

interface SettingsApiResponse {
  data: V2AlgoSettings[];
  mp_id: number;
  count: number;
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { mpId } = useParams({ from: "/product/$mpId" });
  const [algoData, setAlgoData] = useState<V2AlgoResultWithExecution[]>([]);
  const [settingsData, setSettingsData] = useState<V2AlgoSettings[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");

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

  const fetchSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await fetch(`/v2-algo/get_algo_settings/${mpId}`);
      if (response.ok) {
        const result: SettingsApiResponse = await response.json();
        setSettingsData(result.data || []);
      }
    } catch (err) {
      console.error("Error fetching settings:", err);
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleSaveSettings = async (settings: V2AlgoSettings) => {
    const response = await fetch(`/v2-algo/update_algo_settings/${mpId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      throw new Error("Failed to save settings");
    }

    // Refresh settings data
    await fetchSettings();
  };

  useEffect(() => {
    fetchData();
    fetchSettings();
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

  // Get unique vendors from algo data
  const uniqueVendors = Array.from(
    new Map(
      algoData.map((item) => [item.vendor_id, item.vendor_name]),
    ).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));

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

  const filteredAlgoData = algoData.filter((item) => {
    const matchesVendor = item.vendor_name
      .toLowerCase()
      .includes(vendorFilter.toLowerCase());
    const matchesJobId = item.job_id
      .toLowerCase()
      .includes(jobFilter.toLowerCase());
    return matchesVendor && matchesJobId;
  });

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
        <>
          {/* Filters */}
          <div className="flex items-center space-x-2 pb-4">
            <Input
              id="vendor-filter"
              placeholder="Filter by vendor..."
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="h-8 w-[150px] lg:w-[200px]"
            />
            <Input
              id="job-filter"
              placeholder="Filter by job ID..."
              value={jobFilter}
              onChange={(e) => setJobFilter(e.target.value)}
              className="h-8 w-[150px] lg:w-[200px]"
            />
            {(vendorFilter || jobFilter) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setVendorFilter("");
                  setJobFilter("");
                }}
                className="h-8 px-2 lg:px-3"
              >
                Reset
                <Cross2Icon className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>

          <DataTable
            columns={columns}
            data={filteredAlgoData}
            isLoading={isLoading}
            initialSorting={[
              {
                id: "run_time",
                desc: true,
              },
            ]}
          />
        </>
      )}

      {/* Vendor Settings Section */}
      <div className="mt-12 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">
              Vendor Algorithm Settings
            </h2>
            <p className="text-muted-foreground mt-1">
              Configure algorithm settings for each vendor
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchSettings}
            disabled={isLoadingSettings}
          >
            {isLoadingSettings ? "Loading..." : "Refresh Settings"}
          </Button>
        </div>
      </div>

      {uniqueVendors.length > 0 && (
        <Tabs
          defaultValue={uniqueVendors[0]?.[0]?.toString()}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-5">
            {uniqueVendors.map(([vendorId, vendorName]) => (
              <TabsTrigger key={vendorId} value={vendorId.toString()}>
                {vendorName}
              </TabsTrigger>
            ))}
          </TabsList>

          {uniqueVendors.map(([vendorId, vendorName]) => {
            const vendorSettings = settingsData.find(
              (s) => s.vendor_id === vendorId,
            );

            return (
              <TabsContent
                key={vendorId}
                value={vendorId.toString()}
                className="mt-6"
              >
                <V2AlgoSettingsForm
                  mpId={parseInt(mpId)}
                  vendorId={vendorId}
                  vendorName={vendorName}
                  initialSettings={vendorSettings}
                  onSave={handleSaveSettings}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
