const path = require("path");

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      { tsconfig: path.join(__dirname, "tsconfig.jest.json") },
    ],
  },
  collectCoverageFrom: ["src/**/*.{ts,js}", "!src/**/*.d.ts", "!src/**/*.test.ts", "!src/**/*.spec.ts", "!src/main.ts", "!src/**/__tests__/**", "!src/**/__mocks__/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
