// Ensure NODE_ENV is "test" so config schema accepts it
process.env.NODE_ENV = "test";

// Ensure APP_LOG_PATH is set so real logger never sees undefined when config is partially mocked
process.env.APP_LOG_PATH = process.env.APP_LOG_PATH || "logs";

// Global mock for logger so tests that mock config (without APP_LOG_PATH) don't load real logger and hit path.join(undefined, ...)
const mockLogFn = jest.fn();
const mockChildLogger = { info: mockLogFn, error: mockLogFn, warn: mockLogFn, debug: mockLogFn, child: jest.fn(() => mockChildLogger) };
jest.mock("./src/utility/logger", () => ({
  __esModule: true,
  default: mockChildLogger,
  createLogger: jest.fn(() => mockChildLogger),
}));
