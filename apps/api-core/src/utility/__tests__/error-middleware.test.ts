import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { errorMiddleware } from "../error-middleware";

describe("error-middleware", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    mockRequest = {};
    mockNext = jest.fn();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headersSent: false,
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    delete process.env.NODE_ENV;
  });

  it("should log error with stack trace when available", () => {
    const error = new Error("Test error");
    error.stack = "Error: Test error\n    at test.js:1:1";

    errorMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
    expect(consoleErrorSpy).toHaveBeenCalledWith(error.stack);
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it("should log error without stack trace when stack is not available", () => {
    const error = { message: "Test error" };

    errorMiddleware(error as Error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
    expect(consoleErrorSpy).toHaveBeenCalledWith(error);
    expect(mockResponse.status).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
  });

  it("should return error response with message", () => {
    const error = new Error("Test error message");

    errorMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: "Test error message",
      },
    });
  });

  it("should return default message when error message is not available", () => {
    const error = {};

    errorMiddleware(error as Error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: "Internal Server Error",
      },
    });
  });

  it("should include stack trace in development environment", () => {
    process.env.NODE_ENV = "development";
    const error = new Error("Test error");
    error.stack = "Error: Test error\n    at test.js:1:1";

    errorMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: "Test error",
        stack: error.stack,
      },
    });
  });

  it("should not include stack trace in production environment", () => {
    process.env.NODE_ENV = "production";
    const error = new Error("Test error");
    error.stack = "Error: Test error\n    at test.js:1:1";

    errorMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: "Test error",
      },
    });
  });

  it("should call next when headers are already sent", () => {
    mockResponse.headersSent = true;
    const error = new Error("Test error");

    errorMiddleware(error, mockRequest as Request, mockResponse as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockResponse.status).not.toHaveBeenCalled();
    expect(mockResponse.json).not.toHaveBeenCalled();
  });

  it("should handle null error gracefully", () => {
    errorMiddleware(null as any, mockRequest as Request, mockResponse as Response, mockNext);

    expect(consoleErrorSpy).toHaveBeenCalledWith("=== ERROR MIDDLEWARE ===");
    expect(consoleErrorSpy).toHaveBeenCalledWith(null);
    expect(mockResponse.json).toHaveBeenCalledWith({
      error: {
        message: "Internal Server Error",
      },
    });
  });
});
