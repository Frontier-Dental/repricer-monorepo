"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Zod schema for the settings form
const settingsSchema = z.object({
  id: z.number().optional(),
  mp_id: z.number(),
  vendor_id: z.number(),
  suppress_price_break_if_Q1_not_updated: z.boolean(),
  suppress_price_break: z.boolean(),
  compete_on_price_break_only: z.boolean(),
  up_down: z.enum(["UP", "UP/DOWN", "DOWN"]),
  badge_indicator: z.enum(["ALL", "BADGE"]),
  execution_priority: z.number().min(0).max(100),
  reprice_up_percentage: z.number().min(-1).max(100),
  compare_q2_with_q1: z.boolean(),
  compete_with_all_vendors: z.boolean(),
  reprice_up_badge_percentage: z.number().min(-1).max(100),
  sister_vendor_ids: z.string(),
  exclude_vendors: z.string(),
  inactive_vendor_id: z.string(),
  handling_time_group: z.boolean(),
  keep_position: z.boolean(),
  inventory_competition_threshold: z.number().min(1).max(100),
  reprice_down_percentage: z.number().min(-1).max(100),
  max_price: z.number().min(0),
  floor_price: z.number().min(0),
  reprice_down_badge_percentage: z.number().min(-1).max(100),
  floor_compete_with_next: z.boolean(),
  compete_with_own_quantity_0: z.boolean(),
  not_cheapest: z.boolean(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

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

interface V2AlgoSettingsFormProps {
  mpId: number;
  vendorId: number;
  vendorName: string;
  initialSettings?: V2AlgoSettings;
  onSave: (settings: V2AlgoSettings) => Promise<void>;
}

export function V2AlgoSettingsForm({
  mpId,
  vendorId,
  vendorName,
  initialSettings,
  onSave,
}: V2AlgoSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: initialSettings || {
      mp_id: mpId,
      vendor_id: vendorId,
      suppress_price_break_if_Q1_not_updated: false,
      suppress_price_break: false,
      compete_on_price_break_only: false,
      up_down: "UP/DOWN",
      badge_indicator: "ALL",
      execution_priority: 0,
      reprice_up_percentage: -1,
      compare_q2_with_q1: false,
      compete_with_all_vendors: false,
      reprice_up_badge_percentage: -1,
      sister_vendor_ids: "",
      exclude_vendors: "",
      inactive_vendor_id: "",
      handling_time_group: false,
      keep_position: false,
      inventory_competition_threshold: 1,
      reprice_down_percentage: -1,
      max_price: 99999999.99,
      floor_price: 0,
      reprice_down_badge_percentage: -1,
      floor_compete_with_next: false,
      compete_with_own_quantity_0: false,
      not_cheapest: false,
    },
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    try {
      await onSave(data);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Error saving settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h3 className="text-lg font-semibold">{vendorName} Settings</h3>
        <p className="text-sm text-muted-foreground">
          Configure algorithm settings for {vendorName} (Vendor ID: {vendorId})
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* General Settings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="execution_priority">Execution Priority</Label>
            <Input
              id="execution_priority"
              type="number"
              {...form.register("execution_priority", { valueAsNumber: true })}
              min="0"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="up_down">Up/Down Direction</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("up_down", value as "UP" | "UP/DOWN" | "DOWN")
              }
              defaultValue={form.watch("up_down")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="UP">UP</SelectItem>
                <SelectItem value="UP/DOWN">UP/DOWN</SelectItem>
                <SelectItem value="DOWN">DOWN</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="badge_indicator">Badge Indicator</Label>
            <Select
              onValueChange={(value) =>
                form.setValue("badge_indicator", value as "ALL" | "BADGE")
              }
              defaultValue={form.watch("badge_indicator")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">ALL</SelectItem>
                <SelectItem value="BADGE">BADGE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="inventory_competition_threshold">
              Inventory Competition Threshold
            </Label>
            <Input
              id="inventory_competition_threshold"
              type="number"
              {...form.register("inventory_competition_threshold", {
                valueAsNumber: true,
              })}
              min="1"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reprice_up_percentage">Reprice Up Percentage</Label>
            <Input
              id="reprice_up_percentage"
              type="number"
              step="0.01"
              {...form.register("reprice_up_percentage", {
                valueAsNumber: true,
              })}
              min="-1"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reprice_down_percentage">
              Reprice Down Percentage
            </Label>
            <Input
              id="reprice_down_percentage"
              type="number"
              step="0.01"
              {...form.register("reprice_down_percentage", {
                valueAsNumber: true,
              })}
              min="-1"
              max="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="reprice_up_badge_percentage">
              Reprice Up Badge Percentage
            </Label>
            <Input
              id="reprice_up_badge_percentage"
              type="number"
              step="0.01"
              {...form.register("reprice_up_badge_percentage", {
                valueAsNumber: true,
              })}
              min="-1"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reprice_down_badge_percentage">
              Reprice Down Badge Percentage
            </Label>
            <Input
              id="reprice_down_badge_percentage"
              type="number"
              step="0.01"
              {...form.register("reprice_down_badge_percentage", {
                valueAsNumber: true,
              })}
              min="-1"
              max="100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="floor_price">Floor Price</Label>
            <Input
              id="floor_price"
              type="number"
              step="0.01"
              {...form.register("floor_price", { valueAsNumber: true })}
              min="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="max_price">Max Price</Label>
            <Input
              id="max_price"
              type="number"
              step="0.01"
              {...form.register("max_price", { valueAsNumber: true })}
              min="0"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sister_vendor_ids">Sister Vendor IDs</Label>
            <Input
              id="sister_vendor_ids"
              {...form.register("sister_vendor_ids")}
              placeholder="Comma-separated vendor IDs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exclude_vendors">Exclude Vendors</Label>
            <Input
              id="exclude_vendors"
              {...form.register("exclude_vendors")}
              placeholder="Comma-separated vendor IDs"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="inactive_vendor_id">Inactive Vendor ID</Label>
            <Input
              id="inactive_vendor_id"
              {...form.register("inactive_vendor_id")}
              placeholder="Vendor ID to mark as inactive"
            />
          </div>
        </div>

        {/* Boolean Settings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="suppress_price_break"
              checked={form.watch("suppress_price_break")}
              onCheckedChange={(checked) =>
                form.setValue("suppress_price_break", checked)
              }
            />
            <Label htmlFor="suppress_price_break">Suppress Price Break</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="compete_on_price_break_only"
              checked={form.watch("compete_on_price_break_only")}
              onCheckedChange={(checked) =>
                form.setValue("compete_on_price_break_only", checked)
              }
            />
            <Label htmlFor="compete_on_price_break_only">
              Compete on Price Break Only
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="compare_q2_with_q1"
              checked={form.watch("compare_q2_with_q1")}
              onCheckedChange={(checked) =>
                form.setValue("compare_q2_with_q1", checked)
              }
            />
            <Label htmlFor="compare_q2_with_q1">Compare Q2 with Q1</Label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="compete_with_all_vendors"
              checked={form.watch("compete_with_all_vendors")}
              onCheckedChange={(checked) =>
                form.setValue("compete_with_all_vendors", checked)
              }
            />
            <Label htmlFor="compete_with_all_vendors">
              Compete with All Vendors
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="compete_with_own_quantity_0"
              checked={form.watch("compete_with_own_quantity_0")}
              onCheckedChange={(checked) =>
                form.setValue("compete_with_own_quantity_0", checked)
              }
            />
            <Label htmlFor="compete_with_own_quantity_0">
              Compete with Own Quantity 0
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="not_cheapest"
              checked={form.watch("not_cheapest")}
              onCheckedChange={(checked) =>
                form.setValue("not_cheapest", checked)
              }
            />
            <Label htmlFor="not_cheapest">Not Cheapest</Label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="suppress_price_break_if_Q1_not_updated"
              checked={form.watch("suppress_price_break_if_Q1_not_updated")}
              onCheckedChange={(checked) =>
                form.setValue("suppress_price_break_if_Q1_not_updated", checked)
              }
            />
            <Label htmlFor="suppress_price_break_if_Q1_not_updated">
              Suppress Price Break if Q1 Not Updated
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="handling_time_group"
              checked={form.watch("handling_time_group")}
              onCheckedChange={(checked) =>
                form.setValue("handling_time_group", checked)
              }
            />
            <Label htmlFor="handling_time_group">Handling Time Group</Label>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="keep_position"
              checked={form.watch("keep_position")}
              onCheckedChange={(checked) =>
                form.setValue("keep_position", checked)
              }
            />
            <Label htmlFor="keep_position">Keep Position</Label>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="floor_compete_with_next"
              checked={form.watch("floor_compete_with_next")}
              onCheckedChange={(checked) =>
                form.setValue("floor_compete_with_next", checked)
              }
            />
            <Label htmlFor="floor_compete_with_next">
              Floor Compete with Next
            </Label>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
