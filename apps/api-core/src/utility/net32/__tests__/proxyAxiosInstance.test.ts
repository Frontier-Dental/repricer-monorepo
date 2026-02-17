// Mock dependencies before imports
jest.mock("axios", () => ({
  create: jest.fn(),
}));
jest.mock("https-proxy-agent", () => ({
  HttpsProxyAgent: jest.fn(),
}));

import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import { getAxiosProxyInstance } from "../proxyAxiosInstance";

describe("proxyAxiosInstance", () => {
  const mockCreate = axios.create as jest.MockedFunction<typeof axios.create>;
  const mockHttpsProxyAgent = HttpsProxyAgent as jest.MockedClass<typeof HttpsProxyAgent>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReturnValue({} as any);
    mockHttpsProxyAgent.mockImplementation(() => ({}) as any);
  });

  describe("getAxiosProxyInstance", () => {
    it("should create axios instance with proxy configuration", () => {
      const url = "https://api.example.com";
      const headers = { "Content-Type": "application/json" };
      const proxyHost = "proxy.example.com";
      const proxyUsername = "user";
      const proxyPassword = "pass";
      const proxyPort = "8080";

      const result = getAxiosProxyInstance(url, headers, proxyHost, proxyUsername, proxyPassword, proxyPort);

      expect(mockHttpsProxyAgent).toHaveBeenCalledWith("http://user:pass@proxy.example.com:8080");
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: url,
        httpsAgent: {},
        headers,
      });
      expect(result).toBeDefined();
    });

    it("should create axios instance without headers when headers is null", () => {
      const url = "https://api.example.com";
      const proxyHost = "proxy.example.com";
      const proxyUsername = "user";
      const proxyPassword = "pass";
      const proxyPort = "8080";

      getAxiosProxyInstance(url, null, proxyHost, proxyUsername, proxyPassword, proxyPort);

      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: url,
        httpsAgent: {},
      });
    });

    it("should create axios instance without headers when headers is undefined", () => {
      const url = "https://api.example.com";
      const proxyHost = "proxy.example.com";
      const proxyUsername = "user";
      const proxyPassword = "pass";
      const proxyPort = "8080";

      getAxiosProxyInstance(url, undefined, proxyHost, proxyUsername, proxyPassword, proxyPort);

      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: url,
        httpsAgent: {},
      });
    });

    it("should throw error when url is not provided", () => {
      expect(() => {
        getAxiosProxyInstance("", null, "host", "user", "pass", "8080");
      }).toThrow("Axios proxy instance URL is required");
    });

    it("should throw error when proxyHost is not provided", () => {
      expect(() => {
        getAxiosProxyInstance("https://api.example.com", null, "", "user", "pass", "8080");
      }).toThrow("Proxy configuration error: Proxy host, username, password and port parameters must be set.");
    });

    it("should throw error when proxyUsername is not provided", () => {
      expect(() => {
        getAxiosProxyInstance("https://api.example.com", null, "host", "", "pass", "8080");
      }).toThrow("Proxy configuration error: Proxy host, username, password and port parameters must be set.");
    });

    it("should throw error when proxyPassword is not provided", () => {
      expect(() => {
        getAxiosProxyInstance("https://api.example.com", null, "host", "user", "", "8080");
      }).toThrow("Proxy configuration error: Proxy host, username, password and port parameters must be set.");
    });

    it("should throw error when proxyPort is not provided", () => {
      expect(() => {
        getAxiosProxyInstance("https://api.example.com", null, "host", "user", "pass", "");
      }).toThrow("Proxy configuration error: Proxy host, username, password and port parameters must be set.");
    });

    it("should handle special characters in proxy credentials", () => {
      const url = "https://api.example.com";
      const proxyHost = "proxy.example.com";
      const proxyUsername = "user@domain";
      const proxyPassword = "p@ssw0rd!";
      const proxyPort = "8080";

      getAxiosProxyInstance(url, null, proxyHost, proxyUsername, proxyPassword, proxyPort);

      expect(mockHttpsProxyAgent).toHaveBeenCalledWith("http://user@domain:p@ssw0rd!@proxy.example.com:8080");
    });
  });
});
