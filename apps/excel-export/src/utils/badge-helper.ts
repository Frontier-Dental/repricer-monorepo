const badgeIndicatorMapping: Record<string, string> = {
  "1": "Best Seller",
  "2": "Choice",
  "3": "Prime",
  "4": "New",
  "5": "Limited Time Deal",
  "6": "Small Business",
  "7": "Climate Pledge Friendly",
  "8": "None",
};

export function parseBadgeIndicator(
  value: string | undefined,
  format: "KEY" | "VALUE" = "KEY",
): string {
  if (!value) return "";

  if (format === "KEY") {
    return badgeIndicatorMapping[value] || value;
  }

  const entry = Object.entries(badgeIndicatorMapping).find(
    ([_, v]) => v === value,
  );
  return entry ? entry[0] : value;
}
