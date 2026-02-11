import axios from "axios";
import { applicationConfig } from "../utility/config";

export interface ScrapeResult {
  mpId: number;
  httpStatus: number;
  responseTimeMs: number;
  response: unknown;
  blocked: boolean;
  blockType: string | null;
  error: string | null;
}

function detectBlock(status: number, body: unknown): { blocked: boolean; blockType: string | null } {
  if (status === 403) return { blocked: true, blockType: "forbidden" };
  if (status === 429) return { blocked: true, blockType: "rate_limit" };
  if (status === 503) return { blocked: true, blockType: "service_unavailable" };

  if (typeof body === "string") {
    const lower = body.toLowerCase();
    if (lower.includes("captcha") || lower.includes("<!doctype") || lower.includes("<html")) {
      return { blocked: true, blockType: "captcha" };
    }
  }

  return { blocked: false, blockType: null };
}

export async function scrapeViaProxy(mpId: number): Promise<ScrapeResult> {
  const proxyUrl = `http://${applicationConfig.PROXY_IP}:${applicationConfig.PROXY_PORT}/tls-fetch`;
  const targetUrl = applicationConfig.SCRAPE_URL.replace("{mpId}", String(mpId));
  const start = Date.now();

  try {
    const response = await axios.get(proxyUrl, {
      params: { url: targetUrl },
      auth: {
        username: applicationConfig.PROXY_USERNAME!,
        password: applicationConfig.PROXY_PASSWORD!,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    const elapsed = Date.now() - start;
    const body = response.data;
    const proxyStatus = body?.statusCode ?? response.status;
    const responseData = body?.data ?? body;
    const bodyStr = JSON.stringify(responseData);
    const { blocked, blockType } = detectBlock(proxyStatus, bodyStr);

    return {
      mpId,
      httpStatus: proxyStatus,
      responseTimeMs: elapsed,
      response: responseData,
      blocked,
      blockType,
      error: null,
    };
  } catch (err: any) {
    const elapsed = Date.now() - start;
    const status = err.response?.data?.statusCode ?? err.response?.status ?? 0;
    const errorMsg = err.response?.data?.message ?? err.message ?? "Unknown error";

    let blockType: string | null = null;
    let blocked = false;
    if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET" || err.code === "ETIMEDOUT") {
      blocked = true;
      blockType = "connection_blocked";
    } else if (status) {
      const detection = detectBlock(status, err.response?.data);
      blocked = detection.blocked;
      blockType = detection.blockType;
    }

    return {
      mpId,
      httpStatus: status,
      responseTimeMs: elapsed,
      response: null,
      blocked,
      blockType,
      error: errorMsg,
    };
  }
}

export async function getOutboundIp(): Promise<string> {
  try {
    const proxyUrl = `http://${applicationConfig.PROXY_IP}:${applicationConfig.PROXY_PORT}/proxy`;
    const response = await axios.post(
      proxyUrl,
      {
        url: "https://api.ipify.org?format=json",
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
      {
        auth: { username: applicationConfig.PROXY_USERNAME!, password: applicationConfig.PROXY_PASSWORD! },
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
      }
    );
    return response.data?.data?.ip ?? response.data?.ip ?? "unknown";
  } catch (err: any) {
    console.warn("Failed to detect outbound IP:", err.message ?? String(err));
    return "unknown";
  }
}
