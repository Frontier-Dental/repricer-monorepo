"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
  enabled: z.boolean(),
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
  initialSettings: V2AlgoSettings;
  onSave: (settings: V2AlgoSettings) => Promise<void>;
}

function formatDefaultValues(settings: V2AlgoSettings) {
  return {
    ...settings,
    reprice_up_percentage: Number(settings.reprice_up_percentage),
    reprice_down_percentage: Number(settings.reprice_down_percentage),
    reprice_up_badge_percentage: Number(settings.reprice_up_badge_percentage),
    reprice_down_badge_percentage: Number(
      settings.reprice_down_badge_percentage,
    ),
    max_price: Number(settings.max_price),
    floor_price: Number(settings.floor_price),
  };
}

export function V2AlgoSettingsForm({
  vendorId,
  vendorName,
  initialSettings,
  onSave,
}: V2AlgoSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: formatDefaultValues(initialSettings),
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* General Settings */}
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="execution_priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Execution Priority</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="up_down"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Up/Down Direction</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="UP">UP</SelectItem>
                      <SelectItem value="UP/DOWN">UP/DOWN</SelectItem>
                      <SelectItem value="DOWN">DOWN</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="badge_indicator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Badge Indicator</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ALL">ALL</SelectItem>
                      <SelectItem value="BADGE">BADGE</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="inventory_competition_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Competition Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reprice_up_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Up Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="-1"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reprice_down_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Down Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="-1"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="reprice_up_badge_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Up Badge Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="-1"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reprice_down_badge_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Down Badge Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="-1"
                      max="100"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="floor_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="max_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      {...field}
                      onChange={(e) => {
                        const value = e.target.value;
                        field.onChange(value === "" ? "" : Number(value));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="sister_vendor_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sister Vendor IDs</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Comma-separated vendor IDs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="exclude_vendors"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Exclude Vendors</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Comma-separated vendor IDs"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="inactive_vendor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inactive Vendor ID</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Vendor ID to mark as inactive"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Boolean Settings */}
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="suppress_price_break"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Suppress Price Break
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compete_on_price_break_only"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Compete on Price Break Only
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compare_q2_with_q1"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Compare Q2 with Q1
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="compete_with_all_vendors"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Compete with All Vendors
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="compete_with_own_quantity_0"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Compete with Own Quantity 0
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="not_cheapest"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Not Cheapest</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="suppress_price_break_if_Q1_not_updated"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Suppress Price Break if Q1 Not Updated
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="handling_time_group"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Handling Time Group
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="keep_position"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Keep Position</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="floor_compete_with_next"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Floor Compete with Next
                    </FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Enabled</FormLabel>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
