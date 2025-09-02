"use client";

import { V2AlgoSettingsForm } from "@/components/V2AlgoSettingsForm";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cross2Icon } from "@radix-ui/react-icons";
import {
  VendorNameLookup,
  VendorId,
  AlgoPriceStrategy,
  AlgoPriceDirection,
  AlgoHandlingTimeGroup,
  AlgoBadgeIndicator,
} from "@repricer-monorepo/shared";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ArrowUpDown, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
  new_price_breaks: string | null;
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
  up_down: AlgoPriceDirection;
  badge_indicator: AlgoBadgeIndicator;
  execution_priority: number;
  reprice_up_percentage: number;
  compare_q2_with_q1: boolean;
  compete_with_all_vendors: boolean;
  reprice_up_badge_percentage: number;
  sister_vendor_ids: string;
  exclude_vendors: string;
  inactive_vendor_id: string;
  handling_time_group: AlgoHandlingTimeGroup;
  keep_position: boolean;
  inventory_competition_threshold: number;
  reprice_down_percentage: number;
  max_price: number;
  floor_price: number;
  reprice_down_badge_percentage: number;
  floor_compete_with_next: boolean;
  own_vendor_threshold: number;
  price_strategy: AlgoPriceStrategy;
  enabled: boolean;
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
  const [isManualRepricing, setIsManualRepricing] = useState(false);
  const [isRemovingFrom422, setIsRemovingFrom422] = useState(false);
  const [isSyncingSettings, setIsSyncingSettings] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");
  const [algoExecutionMode, setAlgoExecutionMode] = useState<string>("V1_ONLY");
  const [isUpdatingAlgoExecutionMode, setIsUpdatingAlgoExecutionMode] =
    useState(false);
  const [net32Url, setNet32Url] = useState<string | null>(null);
  const [isLoadingNet32Url, setIsLoadingNet32Url] = useState(false);

  const openHtmlInNewTab = (htmlContent: string) => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    URL.revokeObjectURL(url);
  };

  const handleManualReprice = async () => {
    setIsManualRepricing(true);
    try {
      const response = await fetch("/productV2/runManualCron", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mpIds: [parseInt(mpId)] }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Manual reprice initiated:", result);

      // Show success message or handle response as needed
      toast.success("Manual reprice succeeded!");

      // Refresh the data table to show updated results
      await fetchData();
    } catch (error) {
      console.error("Error initiating manual reprice:", error);
      toast.error("Failed to initiate manual reprice. Please try again.");
    } finally {
      setIsManualRepricing(false);
    }
  };

  const handleRemoveFrom422 = async () => {
    setIsRemovingFrom422(true);
    try {
      const response = await fetch("/productV2/removeFrom422", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ mpIds: [parseInt(mpId)] }),
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

  const handleSyncVendorSettings = async () => {
    setIsSyncingSettings(true);
    try {
      const response = await fetch(`/v2-algo/sync_vendor_settings/${mpId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();
      if (response.ok && result.success) {
        toast.success("Vendor settings synced successfully!");
        // Refresh the settings data after sync
        await fetchSettings();
      } else {
        toast.error(result.message || "Failed to sync vendor settings.");
      }
    } catch (err) {
      console.error("Error syncing vendor settings:", err);
      toast.error("Failed to sync vendor settings.");
    } finally {
      setIsSyncingSettings(false);
    }
  };

  const handleAlgoExecutionModeChange = async (value: string) => {
    setIsUpdatingAlgoExecutionMode(true);
    try {
      const response = await fetch(
        `/v2-algo/update_algo_execution_mode/${mpId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ algo_execution_mode: value }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setAlgoExecutionMode(value);
      toast.success("Algorithm execution mode updated successfully!");
    } catch (error) {
      console.error("Error updating algorithm execution mode:", error);
      toast.error(
        "Failed to update algorithm execution mode. Please try again.",
      );
      // Revert the change if the update failed
      setAlgoExecutionMode(algoExecutionMode);
    } finally {
      setIsUpdatingAlgoExecutionMode(false);
    }
  };

  const fetchAlgoExecutionMode = async () => {
    try {
      const response = await fetch(`/v2-algo/get_algo_execution_mode/${mpId}`);
      if (response.ok) {
        const result = await response.json();
        setAlgoExecutionMode(result.algo_execution_mode || "V1_ONLY");
      }
    } catch (err) {
      console.error("Error fetching algorithm execution mode:", err);
    }
  };

  const fetchNet32Url = async () => {
    setIsLoadingNet32Url(true);
    try {
      const response = await fetch(`/v2-algo/get_net32_url/${mpId}`);
      if (response.ok) {
        const result = await response.json();
        setNet32Url(result.net32_url);
      }
    } catch (err) {
      console.error("Error fetching net32 URL:", err);
    } finally {
      setIsLoadingNet32Url(false);
    }
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

  const createDefaultSettings = (vendorId: number): V2AlgoSettings => ({
    mp_id: parseInt(mpId),
    vendor_id: vendorId,
    suppress_price_break_if_Q1_not_updated: false,
    suppress_price_break: false,
    compete_on_price_break_only: false,
    up_down: AlgoPriceDirection.UP_DOWN,
    badge_indicator: AlgoBadgeIndicator.ALL,
    execution_priority: 0,
    reprice_up_percentage: -1,
    compare_q2_with_q1: false,
    compete_with_all_vendors: false,
    reprice_up_badge_percentage: -1,
    sister_vendor_ids: "",
    exclude_vendors: "",
    inactive_vendor_id: "",
    handling_time_group: AlgoHandlingTimeGroup.ALL,
    keep_position: false,
    inventory_competition_threshold: 1,
    reprice_down_percentage: -1,
    max_price: 99999999.99,
    floor_price: 0,
    reprice_down_badge_percentage: -1,
    floor_compete_with_next: false,
    own_vendor_threshold: 1,
    price_strategy: AlgoPriceStrategy.UNIT,
    enabled: false,
  });

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
    fetchAlgoExecutionMode();
    fetchNet32Url();
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

  // Custom sorting function for dates
  const dateSortingFn = (
    rowA: Row<V2AlgoResultWithExecution>,
    rowB: Row<V2AlgoResultWithExecution>,
    columnId: string,
  ) => {
    const dateA = rowA.getValue(columnId) as string;
    const dateB = rowB.getValue(columnId) as string;

    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;

    return new Date(dateA).getTime() - new Date(dateB).getTime();
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
      header: "Triggered By Vendor",
      cell: ({ row }) => <div>{row.getValue("triggered_by_vendor")}</div>,
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
      accessorKey: "new_price_breaks",
      header: "Resulting Price Breaks",
      cell: ({ row }) => <div>{row.getValue("new_price_breaks")}</div>,
    },
    {
      accessorKey: "sister_position_check",
      header: "Sister Position Check",
      cell: ({ row }) => {
        const result = row.getValue("sister_position_check") as string;
        return <Badge variant={getResultBadgeVariant(result)}>{result}</Badge>;
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
      sortingFn: dateSortingFn,
      sortUndefined: false,
    },
    {
      accessorKey: "comment",
      header: "Comment",
      cell: ({ row }) => {
        const comment = row.getValue("comment") as string;
        return (
          <div className="max-w-md">
            <p className="text-sm">{truncateComment(comment)}</p>
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "",
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
            onClick={() => navigate({ to: "/" })}
            className="mb-4 flex items-center gap-2"
          >
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
        <h1 className="text-3xl font-bold tracking-tight">Product Details</h1>
        <p className="text-muted-foreground">Product ID: {mpId}</p>

        {isLoadingNet32Url ? (
          <div className="mt-4">
            <Button variant="outline" disabled>
              Loading Net32 URL...
            </Button>
          </div>
        ) : net32Url ? (
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => window.open(net32Url, "_blank")}
              // className="bg-blue-600 hover:bg-blue-700"
            >
              Open Net32 Product Page
            </Button>
          </div>
        ) : (
          <div className="mt-4">
            <Button variant="outline" disabled>
              No Net32 URL Available
            </Button>
          </div>
        )}
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
          <div className="flex items-center space-x-2">
            <Button
              variant="default"
              onClick={handleManualReprice}
              disabled={isManualRepricing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isManualRepricing ? "Repricing..." : "Manual Reprice"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveFrom422}
              disabled={isRemovingFrom422}
            >
              {isRemovingFrom422 ? "Removing..." : "Remove from 422"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSyncVendorSettings}
              disabled={isSyncingSettings}
              className="bg-green-600 hover:bg-green-700 text-white border-green-600"
            >
              {isSyncingSettings ? "Syncing..." : "Sync Vendor Settings"}
            </Button>
            <Button variant="outline" onClick={fetchData} disabled={isLoading}>
              {isLoading ? "Loading..." : "Refresh"}
            </Button>
          </div>
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
              {
                id: "id",
                desc: false,
              },
            ]}
          />
        </>
      )}

      {/* Algorithm Execution Mode Section */}
      <div className="mt-8 mb-6">
        <div className="flex items-center space-x-4 mb-4">
          <Label
            htmlFor="algo-execution-mode"
            className="text-base font-semibold"
          >
            Algorithm Execution Mode
          </Label>
          <div className="flex items-center space-x-2">
            <Select
              value={algoExecutionMode}
              onValueChange={handleAlgoExecutionModeChange}
              disabled={isUpdatingAlgoExecutionMode}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select execution mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="V1_ONLY">V1 Only</SelectItem>
                <SelectItem value="V2_ONLY">V2 Only</SelectItem>
                <SelectItem value="V2_EXECUTE_V1_DRY">
                  V2 Execute, V1 Dry Run
                </SelectItem>
                <SelectItem value="V1_EXECUTE_V2_DRY">
                  V1 Execute, V2 Dry Run
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

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

      <Tabs defaultValue="" className="w-full">
        <div className="flex gap-6">
          {/* Left sidebar with vertical tabs */}
          <div className="w-64 flex-shrink-0">
            <TabsList className="flex flex-col h-auto w-full bg-transparent p-0">
              {Object.values(VendorId)
                .filter((x) => typeof x === "number")
                .map((vendorId) => {
                  console.log(vendorId);
                  const vendorIdNumber = Number(vendorId);
                  const vendorSettings = settingsData.find(
                    (s) => s.vendor_id === vendorIdNumber,
                  );
                  const isEnabled = vendorSettings?.enabled || false;

                  return (
                    <TabsTrigger
                      key={vendorId}
                      value={vendorId.toString()}
                      className={`w-full justify-start h-auto p-3 mb-2 ${
                        isEnabled
                          ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200 data-[state=active]:bg-green-200"
                          : "bg-red-100 text-red-800 border-red-300 hover:bg-red-200 data-[state=active]:bg-red-200"
                      }`}
                    >
                      {
                        VendorNameLookup[
                          vendorId as keyof typeof VendorNameLookup
                        ]
                      }
                    </TabsTrigger>
                  );
                })}
            </TabsList>
          </div>

          {/* Right content area */}
          <div className="flex-1">
            {/* Default tab content when no vendor is selected */}
            <TabsContent value="" className="mt-0">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      Select a Vendor
                    </h3>
                    <p className="text-gray-600">
                      Choose a vendor from the tabs on the left to view and
                      configure their algorithm settings.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {Object.values(VendorId).map((vendorId) => {
              const vendorIdNumber = Number(vendorId);
              const vendorSettings = settingsData.find(
                (s) => s.vendor_id === vendorIdNumber,
              );

              // Use existing settings or create default settings
              const settings =
                vendorSettings || createDefaultSettings(vendorIdNumber);

              return (
                <TabsContent
                  key={vendorId}
                  value={vendorId.toString()}
                  className="mt-0"
                >
                  <V2AlgoSettingsForm
                    mpId={parseInt(mpId)}
                    vendorId={vendorIdNumber}
                    vendorName={
                      VendorNameLookup[
                        vendorId as keyof typeof VendorNameLookup
                      ]
                    }
                    initialSettings={settings}
                    onSave={handleSaveSettings}
                    onToggleEnabled={async (enabled: boolean) => {
                      try {
                        const response = await fetch(
                          `/v2-algo/toggle_enabled/${mpId}/${vendorIdNumber}`,
                          {
                            method: "PUT",
                            headers: {
                              "Content-Type": "application/json",
                            },
                          },
                        );

                        if (response.ok) {
                          // Refresh settings to get updated data
                          await fetchSettings();
                          toast.success(
                            `Vendor ${enabled ? "enabled" : "disabled"} successfully`,
                          );
                        } else {
                          toast.error("Failed to toggle vendor status");
                        }
                      } catch (error) {
                        console.error("Error toggling vendor status:", error);
                        toast.error("Failed to toggle vendor status");
                      }
                    }}
                  />
                </TabsContent>
              );
            })}
          </div>
        </div>
      </Tabs>
    </div>
  );
}
