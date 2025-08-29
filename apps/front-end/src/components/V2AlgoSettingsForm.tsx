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
import {
  AlgoHandlingTimeGroup,
  AlgoPriceStrategy,
  AlgoPriceDirection,
  AlgoBadgeIndicator,
} from "@repricer-monorepo/shared";

// Zod schema for the settings form
const settingsSchema = z.object({
  id: z.number().optional(),
  mp_id: z.number(),
  vendor_id: z.number(),
  suppress_price_break_if_Q1_not_updated: z.boolean(),
  suppress_price_break: z.boolean(),
  compete_on_price_break_only: z.boolean(),
  up_down: z.enum(AlgoPriceDirection),
  badge_indicator: z.enum(AlgoBadgeIndicator),
  execution_priority: z.number().min(0),
  reprice_up_percentage: z.number().min(-1),
  compare_q2_with_q1: z.boolean(),
  compete_with_all_vendors: z.boolean(),
  reprice_up_badge_percentage: z.number().min(-1),
  sister_vendor_ids: z.string(),
  exclude_vendors: z.string(),
  inactive_vendor_id: z.string(),
  handling_time_group: z.enum(AlgoHandlingTimeGroup),
  keep_position: z.boolean(),
  inventory_competition_threshold: z.number().min(0),
  reprice_down_percentage: z.number().min(-1).max(100),
  max_price: z.number().min(0),
  floor_price: z.number().min(0),
  reprice_down_badge_percentage: z.number().min(-1).max(100),
  floor_compete_with_next: z.boolean(),
  own_vendor_threshold: z.number().min(0),
  price_strategy: z.enum(AlgoPriceStrategy),
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

interface V2AlgoSettingsFormProps {
  mpId: number;
  vendorId: number;
  vendorName: string;
  initialSettings: V2AlgoSettings;
  onSave: (settings: V2AlgoSettings) => Promise<void>;
  onToggleEnabled: (enabled: boolean) => Promise<void>;
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
  onToggleEnabled,
}: V2AlgoSettingsFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: formatDefaultValues(initialSettings),
  });

  const onSubmit = async (data: SettingsFormData) => {
    setIsLoading(true);
    try {
      // Ensure the enabled value is preserved from the current state
      const settingsWithEnabled = {
        ...data,
        enabled: isEnabled,
      };

      await onSave(settingsWithEnabled);
      toast.success("Settings saved successfully!");
    } catch (error) {
      toast.error("Failed to save settings");
      console.error("Error saving settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isEnabled = initialSettings.enabled;

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">Enabled:</span>
            <Switch
              checked={isEnabled}
              onCheckedChange={async (checked) => {
                await onToggleEnabled(checked);
              }}
            />
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{vendorName}</h2>
        <p className="text-lg text-gray-600">Vendor ID: {vendorId}</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className={`space-y-4 ${!isEnabled ? "opacity-50 pointer-events-none" : ""}`}
        >
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
              name="handling_time_group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Handling Time Group</FormLabel>
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
                      <SelectItem value="FAST_SHIPPING">
                        FAST_SHIPPING (1 - 2 days)
                      </SelectItem>
                      <SelectItem value="STOCKED">
                        STOCKED (1 - 5 days)
                      </SelectItem>
                      <SelectItem value="LONG_HANDLING">
                        LONG_HANDLING (6+ days)
                      </SelectItem>
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
              name="price_strategy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Price Strategy</FormLabel>
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
                      <SelectItem value={AlgoPriceStrategy.UNIT}>
                        UNIT
                      </SelectItem>
                      <SelectItem value={AlgoPriceStrategy.TOTAL}>
                        TOTAL
                      </SelectItem>
                      <SelectItem value={AlgoPriceStrategy.BUY_BOX}>
                        BUY_BOX
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="inventory_competition_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Inventory Competition Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
              name="reprice_down_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Down Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
              name="reprice_up_badge_percentage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reprice Up Badge Percentage</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
              name="floor_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Floor Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
              name="max_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max Price</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
          </div>

          <div className="grid grid-cols-3 gap-3">
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
            <FormField
              control={form.control}
              name="own_vendor_threshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Own Vendor Threshold</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading || !isEnabled}>
              {isLoading ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
