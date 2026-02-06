type LogLevel = "info" | "warn" | "error";

function emit(level: LogLevel, event: string, data: Record<string, unknown>) {
  const entry = {
    level,
    event,
    timestamp: new Date().toISOString(),
    service: "scrape-monitor",
    ...data,
  };
  console.log(JSON.stringify(entry));
}

export const log = {
  info: (event: string, data: Record<string, unknown> = {}) => emit("info", event, data),
  warn: (event: string, data: Record<string, unknown> = {}) => emit("warn", event, data),
  error: (event: string, data: Record<string, unknown> = {}) => emit("error", event, data),
};
