import { RepriceData } from "../../../../../model/reprice-model";

declare global {
  namespace jest {
    interface Matchers<R> {
      /** Assert that repriceData has isRepriced=true and newPrice is not 'N/A' */
      toBeRepriced(): R;
      /** Assert that repriceData has isRepriced=false or newPrice='N/A' */
      toBeIgnored(): R;
      /** Assert that explained string contains the given substring */
      toHaveExplainedContaining(tag: string): R;
      /** Assert that explained string does NOT contain the given substring */
      toHaveExplainedNotContaining(tag: string): R;
      /** Assert newPrice equals expected (with 0.005 tolerance for floats) */
      toHaveSuggestedPrice(price: number): R;
      /** Assert the price break is deactivated (active=false or active=0) */
      toBeDeactivated(): R;
    }
  }
}

expect.extend({
  toBeRepriced(received: RepriceData) {
    const pass = received.isRepriced === true && received.newPrice !== "N/A" && received.newPrice !== null;
    return {
      pass,
      message: () => `expected repriceData ${pass ? "not " : ""}to be repriced\n` + `  isRepriced: ${received.isRepriced}\n` + `  newPrice: ${received.newPrice}\n` + `  explained: ${received.explained}`,
    };
  },

  toBeIgnored(received: RepriceData) {
    const pass = received.isRepriced === false || received.newPrice === "N/A" || received.newPrice === null;
    return {
      pass,
      message: () => `expected repriceData ${pass ? "not " : ""}to be ignored\n` + `  isRepriced: ${received.isRepriced}\n` + `  newPrice: ${received.newPrice}`,
    };
  },

  toHaveExplainedContaining(received: RepriceData, tag: string) {
    const explained = received.explained ?? "";
    const pass = explained.includes(tag);
    return {
      pass,
      message: () => `expected explained "${explained}" ${pass ? "not " : ""}to contain "${tag}"`,
    };
  },

  toHaveExplainedNotContaining(received: RepriceData, tag: string) {
    const explained = received.explained ?? "";
    const pass = !explained.includes(tag);
    return {
      pass,
      message: () => `expected explained "${explained}" ${pass ? "" : "not "}to contain "${tag}"`,
    };
  },

  toHaveSuggestedPrice(received: RepriceData, price: number) {
    const actual = Number(received.newPrice);
    const pass = Math.abs(actual - price) < 0.005;
    return {
      pass,
      message: () => `expected newPrice ${received.newPrice} (${actual}) ${pass ? "not " : ""}to equal ${price}`,
    };
  },

  toBeDeactivated(received: RepriceData) {
    const pass = received.active === false || (received.active as any) === 0;
    return {
      pass,
      message: () => `expected price break ${pass ? "not " : ""}to be deactivated (active=${received.active})`,
    };
  },
});

export {}; // Ensure this is treated as a module
