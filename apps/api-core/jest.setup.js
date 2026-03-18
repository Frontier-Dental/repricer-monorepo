// Ensure NODE_ENV is "test" so config schema accepts it
process.env.NODE_ENV = "test";

// Global mock for logger so tests don't load real logger
const mockLogFn = jest.fn();
const mockChildLogger = { info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn, child: jest.fn(() => mockChildLogger) };
jest.mock("./src/utility/logger", () => ({
  __esModule: true,
  default: mockChildLogger,
  createLogger: jest.fn(() => mockChildLogger),
}));
