"use client";

import { useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface V2AlgoExecution {
  id: number;
  scrape_product_id: number;
  time: string;
  chain_of_thought_html: string;
  comment: string;
}

interface ProductDetail {
  ProductIdentifier: number;
  ProductId: number;
  IsSlowActivated: boolean;
  IsBadgeItem: boolean;
  ChannelName: string;
  Activated: boolean;
  UnitPrice: number;
  FloorPrice: number;
  MaxPrice: number;
  ChannelId: string;
  LastCronTime: string;
  LastUpdateTime: string;
  LastCronMessage: string;
  LowestVendor: string;
  LowestVendorPrice: string;
  LastExistingPrice: string;
  LastSuggestedPrice: string;
  ExecutionPriority: number;
  LastCronRun: string;
  BadgeIndicator: string;
  BadgePercentage: number;
  RepricingRule: number;
  PriorityValue: number;
  IsNCNeeded: boolean;
  ScrapeOn: boolean;
  AllowReprice: boolean;
}

interface ApiResponse {
  status: boolean;
  data: {
    algorithmExecutions: V2AlgoExecution[];
    productDetails: ProductDetail[];
  };
  message: string;
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { productId } = useParams({ from: "/product/$productId" });
  const [algoData, setAlgoData] = useState<V2AlgoExecution[]>([]);
  const [productData, setProductData] = useState<ProductDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleBack = () => {
    navigate({ to: "/" });
  };

  const downloadHtmlFile = (htmlContent: string, timestamp: string) => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chain_of_thought_${productId}_${timestamp}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/productV2/v2_algo_execution/${productId}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: ApiResponse = await response.json();

      if (result.status) {
        setAlgoData(result.data.algorithmExecutions);
        setProductData(result.data.productDetails);
      } else {
        setError(result.message);
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
  }, [productId]);

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
          <p className="text-muted-foreground">Product ID: {productId}</p>
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
        <p className="text-muted-foreground">Product ID: {productId}</p>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Product Information</h2>
          <Button variant="outline" onClick={fetchData} disabled={isLoading}>
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex items-center space-x-4 animate-pulse"
                  >
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                    <div className="h-4 bg-gray-200 rounded w-32"></div>
                    <div className="h-4 bg-gray-200 rounded w-48"></div>
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Product Details Table */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">Product Details</h3>
              {productData.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  No product details found for this product.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Channel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scrape</TableHead>
                      <TableHead>Reprice</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Floor Price</TableHead>
                      <TableHead>Max Price</TableHead>
                      <TableHead>Channel ID</TableHead>
                      <TableHead>Last Cron Message</TableHead>
                      <TableHead>Last Cron Time</TableHead>
                      <TableHead>Last Update</TableHead>
                      <TableHead>Lowest Vendor</TableHead>
                      <TableHead>Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productData.map((product, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">
                          {product.ChannelName}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              product.Activated ? "default" : "secondary"
                            }
                          >
                            {product.Activated ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={product.ScrapeOn ? "default" : "secondary"}
                          >
                            {product.ScrapeOn ? "On" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              product.AllowReprice ? "default" : "secondary"
                            }
                          >
                            {product.AllowReprice ? "On" : "Off"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatPrice(product.UnitPrice)}</TableCell>
                        <TableCell>{formatPrice(product.FloorPrice)}</TableCell>
                        <TableCell>{formatPrice(product.MaxPrice)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {product.ChannelId || "N/A"}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <div
                            className="truncate"
                            title={product.LastCronMessage || "N/A"}
                          >
                            {product.LastCronMessage || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(product.LastCronTime)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(product.LastUpdateTime)}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {product.LowestVendor || "N/A"}
                        </TableCell>
                        <TableCell>
                          {product.ExecutionPriority || "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Algorithm Executions Table */}
          <Card>
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">
                Algorithm Execution History
              </h3>
              {algoData.length === 0 ? (
                <p className="text-center text-muted-foreground">
                  No algorithm execution records found for this product.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">ID</TableHead>
                      <TableHead>Execution Time</TableHead>
                      <TableHead>Comment</TableHead>
                      <TableHead className="w-[200px]">HTML Content</TableHead>
                      <TableHead className="w-[120px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {algoData.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          #{record.id}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatDate(record.time)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(record.time).toISOString()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-md">
                            <p className="text-sm">
                              {truncateComment(record.comment)}
                            </p>
                            {record.comment && record.comment.length > 100 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {record.comment.length} characters total
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            <span className="text-sm font-medium">
                              {record.chain_of_thought_html.length} characters
                            </span>
                            <span className="text-xs text-muted-foreground">
                              HTML content available
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              downloadHtmlFile(
                                record.chain_of_thought_html,
                                record.time,
                              )
                            }
                            className="flex items-center gap-2"
                          >
                            <Download className="h-4 w-4" />
                            Download
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
