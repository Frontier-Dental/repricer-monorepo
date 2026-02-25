/**
 * Unit tests for MySqlProduct model.
 * Covers constructor assignment, getItemValue branches for all detail types,
 * and sqlProductDetails link info (null vs present).
 */

import MySqlProduct from "../mysql-product";

const baseAuditInfo = {
  UpdatedOn: new Date("2024-01-15T10:00:00Z"),
  UpdatedBy: "test-user",
};

// getItemValue reads from payload.*Details[identifier]; use tradentDetails so SlowCronName etc. are resolved
const baseSqlProductDetails = {
  tradentDetails: {
    slowCronName: "slow-cron",
    slowCronId: "slow-123",
    qBreakCount: 2,
    qBreakDetails: "qBreak details",
  },
  tradentLinkInfo: "tradent-link",
  frontierLinkInfo: "frontier-link",
  mvpLinkInfo: "mvp-link",
  firstDentLinkInfo: "first-dent-link",
  topDentLinkInfo: "top-dent-link",
  triadLinkInfo: "triad-link",
  biteSupplyLinkInfo: "bite-supply-link",
};

describe("MySqlProduct", () => {
  describe("constructor", () => {
    it("assigns MpId from parsed mpid string", () => {
      const payload = { tradentDetails: { productName: "P1" } };
      const product = new MySqlProduct(payload, {}, "42", baseAuditInfo);
      expect(product.MpId).toBe(42);
    });

    it("assigns LastUpdatedAt and LastUpdatedBy from auditInfo", () => {
      const payload = { tradentDetails: {} };
      const product = new MySqlProduct(payload, {}, "1", baseAuditInfo);
      expect(product.LastUpdatedAt).toEqual(new Date("2024-01-15T10:00:00Z"));
      expect(product.LastUpdatedBy).toBe("test-user");
    });

    it("assigns all payload-derived fields when payload has tradentDetails", () => {
      const payload = {
        tradentDetails: {
          net32url: "https://net32.example/1",
          isScrapeOnlyActivated: true,
          scrapeOnlyCronName: "scrape-cron",
          scrapeOnlyCronId: "scrape-id",
          productName: "Product A",
          cronName: "regular-cron",
          cronId: "regular-id",
          isSlowActivated: true,
          isBadgeItem: false,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "10", baseAuditInfo);

      expect(product.Net32Url).toBe("https://net32.example/1");
      expect(product.IsActive).toBe(true);
      expect(product.LinkedCronName).toBe("scrape-cron");
      expect(product.LinkedCronId).toBe("scrape-id");
      expect(product.ProductName).toBe("Product A");
      expect(product.RegularCronName).toBe("regular-cron");
      expect(product.RegularCronId).toBe("regular-id");
      expect(product.IsSlowActivated).toBe(true);
      expect(product.IsBadgeItem).toBe(false);
    });

    it("assigns sqlProductDetails-derived fields", () => {
      const payload = { tradentDetails: {} };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);

      expect(product.SlowCronName).toBe("slow-cron");
      expect(product.SlowCronId).toBe("slow-123");
      expect(product.QBreakCount).toBe(2);
      expect(product.QBreakDetails).toBe("qBreak details");
      expect(product.LinkedTradentDetailsInfo).toBe("tradent-link");
      expect(product.LinkedFrontiersDetailsInfo).toBe("frontier-link");
      expect(product.LinkedMvpDetailsInfo).toBe("mvp-link");
      expect(product.LinkedFirstDentDetailsInfo).toBe("first-dent-link");
      expect(product.LinkedTopDentDetailsInfo).toBe("top-dent-link");
      expect(product.LinkedTriadDetailsInfo).toBe("triad-link");
      expect(product.LinkedBiteSupplyDetailsInfo).toBe("bite-supply-link");
    });

    it("assigns null for link info when sqlProductDetails fields are null/undefined", () => {
      const payload = { tradentDetails: {} };
      const emptyDetails = {
        tradentDetails: { slowCronName: "", slowCronId: "", qBreakCount: 0, qBreakDetails: "" },
      };
      const product = new MySqlProduct(payload, emptyDetails, "1", baseAuditInfo);

      expect(product.LinkedTradentDetailsInfo).toBeNull();
      expect(product.LinkedFrontiersDetailsInfo).toBeNull();
      expect(product.LinkedMvpDetailsInfo).toBeNull();
      expect(product.LinkedFirstDentDetailsInfo).toBeNull();
      expect(product.LinkedTopDentDetailsInfo).toBeNull();
      expect(product.LinkedTriadDetailsInfo).toBeNull();
      expect(product.LinkedBiteSupplyDetailsInfo).toBeNull();
    });

    it("uses frontierDetails when present for getItemValue", () => {
      const payload = {
        frontierDetails: {
          productName: "Frontier Product",
          net32url: "https://frontier.example",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "2", baseAuditInfo);
      expect(product.ProductName).toBe("Frontier Product");
      expect(product.Net32Url).toBe("https://frontier.example");
    });

    it("uses mvpDetails when present for getItemValue", () => {
      const payload = {
        mvpDetails: {
          productName: "MVP Product",
          cronName: "mvp-cron",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "3", baseAuditInfo);
      expect(product.ProductName).toBe("MVP Product");
      expect(product.RegularCronName).toBe("mvp-cron");
    });

    it("uses topDentDetails when present for getItemValue", () => {
      const payload = {
        topDentDetails: {
          productName: "TopDent Product",
          isBadgeItem: true,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "4", baseAuditInfo);
      expect(product.ProductName).toBe("TopDent Product");
      expect(product.IsBadgeItem).toBe(true);
    });

    it("uses firstDentDetails when present for getItemValue", () => {
      const payload = {
        firstDentDetails: {
          productName: "FirstDent Product",
          isSlowActivated: false,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "5", baseAuditInfo);
      expect(product.ProductName).toBe("FirstDent Product");
      expect(product.IsSlowActivated).toBe(false);
    });

    it("uses triadDetails when present for getItemValue", () => {
      const payload = {
        triadDetails: {
          productName: "Triad Product",
          scrapeOnlyCronId: "triad-scrape-id",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "6", baseAuditInfo);
      expect(product.ProductName).toBe("Triad Product");
      expect(product.LinkedCronId).toBe("triad-scrape-id");
    });

    it("uses biteSupplyDetails when present for getItemValue", () => {
      const payload = {
        biteSupplyDetails: {
          productName: "BiteSupply Product",
          scrapeOnlyCronName: "bite-cron",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "7", baseAuditInfo);
      expect(product.ProductName).toBe("BiteSupply Product");
      expect(product.LinkedCronName).toBe("bite-cron");
    });

    it("prefers first matching details (tradentDetails over others)", () => {
      const payload = {
        tradentDetails: { productName: "Tradent" },
        frontierDetails: { productName: "Frontier" },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.ProductName).toBe("Tradent");
    });
  });

  describe("getItemValue", () => {
    it("returns value from tradentDetails when present", () => {
      const payload = { tradentDetails: { foo: "from-tradent" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "foo")).toBe("from-tradent");
    });

    it("returns value from frontierDetails when present and tradentDetails absent", () => {
      const payload = { frontierDetails: { bar: "from-frontier" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "bar")).toBe("from-frontier");
    });

    it("returns value from mvpDetails when present and earlier details absent", () => {
      const payload = { mvpDetails: { baz: "from-mvp" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "baz")).toBe("from-mvp");
    });

    it("returns value from topDentDetails when present and earlier details absent", () => {
      const payload = { topDentDetails: { qux: "from-topdent" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "qux")).toBe("from-topdent");
    });

    it("returns value from firstDentDetails when present and earlier details absent", () => {
      const payload = { firstDentDetails: { a: "from-firstdent" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "a")).toBe("from-firstdent");
    });

    it("returns value from triadDetails when present and earlier details absent", () => {
      const payload = { triadDetails: { b: "from-triad" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "b")).toBe("from-triad");
    });

    it("returns value from biteSupplyDetails when present and earlier details absent", () => {
      const payload = { biteSupplyDetails: { c: "from-bitesupply" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "c")).toBe("from-bitesupply");
    });

    it("returns undefined when payload has no detail object", () => {
      const payload = {};
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "anyKey")).toBeUndefined();
    });

    it("returns undefined when detail object exists but identifier is missing", () => {
      const payload = { tradentDetails: { otherKey: "value" } };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "missingKey")).toBeUndefined();
    });

    it("returns falsy values (false, 0, empty string) when present in details", () => {
      const payload = {
        tradentDetails: {
          flag: false,
          count: 0,
          text: "",
        },
      };
      const product = new MySqlProduct({ tradentDetails: {} }, {}, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "flag")).toBe(false);
      expect(product.getItemValue(payload, "count")).toBe(0);
      expect(product.getItemValue(payload, "text")).toBe("");
    });
  });

  describe("edge cases", () => {
    it("parses mpid with leading zeros as number", () => {
      const payload = { tradentDetails: {} };
      const product = new MySqlProduct(payload, {}, "007", baseAuditInfo);
      expect(product.MpId).toBe(7);
    });

    it("handles sqlProductDetails with only some link infos set", () => {
      const payload = { tradentDetails: {} };
      const partialDetails = {
        tradentDetails: { slowCronName: "s", slowCronId: "s1", qBreakCount: 0, qBreakDetails: "" },
        mvpLinkInfo: "only-mvp",
      };
      const product = new MySqlProduct(payload, partialDetails, "1", baseAuditInfo);
      expect(product.SlowCronName).toBe("s");
      expect(product.LinkedMvpDetailsInfo).toBe("only-mvp");
      expect(product.LinkedTradentDetailsInfo).toBeNull();
      expect(product.LinkedFrontiersDetailsInfo).toBeNull();
    });
  });
});
