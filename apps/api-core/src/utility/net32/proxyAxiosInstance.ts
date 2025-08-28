import axios, { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

export function getAxiosProxyInstance(
  url: string,
  headers: any,
  proxyHost: string,
  proxyUsername: string,
  proxyPassword: string,
  proxyPort: string,
) {
  if (!url) {
    throw new Error("Axios proxy instance URL is required");
  }

  if (!proxyHost || !proxyUsername || !proxyPassword || !proxyPort) {
    throw new Error(
      "Proxy configuration error: Proxy host, username, password and port parameters must be set.",
    );
  }

  const options: AxiosRequestConfig = {
    baseURL: url,
    httpsAgent: new HttpsProxyAgent(
      `http://${proxyUsername}:${proxyPassword}@${proxyHost}:${proxyPort}`,
    ),
  };

  if (headers) {
    options.headers = headers;
  }

  return axios.create(options);
}
