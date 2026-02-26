import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { applicationConfig } from "../config";
import { errorMiddleware } from "../error-middleware";

jest.mock("../config", () => {
  const config = { NODE_ENV: "test" };
  return { applicationConfig: config };
});

describe("errorMiddleware", () => {
  let req: jest.Mocked<Request>;
  let res: jest.Mocked<Response>;
  let next: jest.MockedFunction<NextFunction>;
  let consoleErrorSpy: jest.SpyInstance;

  const createRes = (headersSent = false): jest.Mocked<Response> => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return {
      headersSent,
      status,
      json,
    } as unknown as jest.Mocked<Response>;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {} as jest.Mocked<Request>;
    res = createRes(false);
    next = jest.fn();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe("logging", () => {
    it("logs ERROR MIDDLEWARE header", () => {
      const err = new Error("test error");
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
    });

    it("logs err.stack when err has stack", () => {
      const err = new Error("stack error");
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
      expect(consoleErrorSpy).toHaveBeenCalledWith(err.stack);
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(err);
    });

    it("logs err when err has no stack", () => {
      const err = { message: "no stack" };
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
      expect(consoleErrorSpy).toHaveBeenCalledWith(err);
    });

    it("logs err.response.data when present", () => {
      const err = {
        message: "axios error",
        response: { data: { code: "E001", detail: "Bad request" } },
      };
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Response data:", JSON.stringify(err.response.data, null, 2));
    });

    it("does not log response data when err.response.data is absent", () => {
      const err = new Error("plain error");
      errorMiddleware(err, req, res, next);
      const responseDataCalls = consoleErrorSpy.mock.calls.filter((c) => c[0] === "Response data:");
      expect(responseDataCalls).toHaveLength(0);
    });
  });

  describe("headersSent", () => {
    it("calls next(err) and does not send response when res.headersSent is true", () => {
      res = createRes(true);
      const err = new Error("too late");
      errorMiddleware(err, req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("sends response when res.headersSent is false", () => {
      const err = new Error("send me");
      errorMiddleware(err, req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalled();
    });
  });

  describe("response body", () => {
    it("sends err.message in error body when present", () => {
      const err = new Error("Custom message");
      errorMiddleware(err, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "Custom message",
        }),
      });
    });

    it("sends 'Internal Server Error' when err.message is absent", () => {
      const err = {};
      errorMiddleware(err, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "Internal Server Error",
        }),
      });
    });

    it("sends 'Internal Server Error' when err is null", () => {
      errorMiddleware(null as any, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "Internal Server Error",
        }),
      });
    });

    it("sends 'Internal Server Error' when err is undefined", () => {
      errorMiddleware(undefined as any, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "Internal Server Error",
        }),
      });
    });
  });

  describe("NODE_ENV development", () => {
    it("includes stack in response when NODE_ENV is development", () => {
      applicationConfig.NODE_ENV = "development";
      const err = new Error("dev error");
      errorMiddleware(err, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "dev error",
          stack: err.stack,
        }),
      });
      applicationConfig.NODE_ENV = "test";
    });

    it("omits stack in response when NODE_ENV is not development", () => {
      applicationConfig.NODE_ENV = "production";
      const err = new Error("prod error");
      errorMiddleware(err, req, res, next);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: {
          message: "prod error",
        },
      });
      applicationConfig.NODE_ENV = "test";
    });

    it("omits stack when NODE_ENV is test", () => {
      applicationConfig.NODE_ENV = "test";
      const err = new Error("test env error");
      errorMiddleware(err, req, res, next);
      const call = (res.status(StatusCodes.INTERNAL_SERVER_ERROR).json as jest.Mock).mock.calls[0][0];
      expect(call.error).not.toHaveProperty("stack");
      expect(call.error.message).toBe("test env error");
    });
  });

  describe("edge cases", () => {
    it("handles err with message but no stack", () => {
      const err = { message: "string only" };
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith(err);
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({ message: "string only" }),
      });
    });

    it("handles axios-like err with response.data", () => {
      const err = {
        message: "Request failed with status code 422",
        response: { data: { errors: ["validation failed"] } },
      };
      errorMiddleware(err, req, res, next);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Response data:", JSON.stringify(err.response.data, null, 2));
      expect(res.status(StatusCodes.INTERNAL_SERVER_ERROR).json).toHaveBeenCalledWith({
        error: expect.objectContaining({
          message: "Request failed with status code 422",
        }),
      });
    });
  });
});
