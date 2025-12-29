const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

/** @type {import("jest").Config} **/
module.exports = {
  testEnvironment: "node",
  transform: {
    ...tsJestTransformCfg,
  },
  collectCoverageFrom: ["src/**/*.{ts,js}", "!src/**/*.d.ts", "!src/**/*.test.ts", "!src/**/*.spec.ts", "!src/main.ts", "!src/**/__tests__/**", "!src/**/__mocks__/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};
