import MySqlProduct from "../mysql-product";

const baseAuditInfo = {
  UpdatedOn: new Date("2025-01-15T10:00:00Z"),
  UpdatedBy: "test-user",
};

const baseSqlProductDetails = {
  slowCronName: null as string | null,
  slowCronId: null as string | null,
  tradentLinkInfo: null as string | null,
  frontierLinkInfo: null as string | null,
  mvpLinkInfo: null as string | null,
  firstDentLinkInfo: null as string | null,
  topDentLinkInfo: null as string | null,
  triadLinkInfo: null as string | null,
  biteSupplyLinkInfo: null as string | null,
};

describe("MySqlProduct", () => {
  describe("constructor", () => {
    it("assigns MpId from parsed mpid string", () => {
      const payload = { tradentDetails: { net32url: "https://example.com" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "12345", baseAuditInfo);
      expect(product.MpId).toBe(12345);
    });

    it("parses numeric mpid with leading zeros", () => {
      const payload = { tradentDetails: {} };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "007", baseAuditInfo);
      expect(product.MpId).toBe(7);
    });

    it("assigns audit fields from auditInfo", () => {
      const payload = { tradentDetails: {} };
      const audit = {
        UpdatedOn: new Date("2024-06-01T12:00:00Z"),
        UpdatedBy: "admin",
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", audit);
      expect(product.LastUpdatedAt).toEqual(new Date("2024-06-01T12:00:00Z"));
      expect(product.LastUpdatedBy).toBe("admin");
    });

    it("reads payload from tradentDetails when present", () => {
      const payload = {
        tradentDetails: {
          net32url: "https://tradent.example.com",
          isScrapeOnlyActivated: true,
          scrapeOnlyCronName: "ScrapeCron",
          scrapeOnlyCronId: "sc1",
          productName: "Tradent Product",
          cronName: "RegularCron",
          cronId: "c1",
          isSlowActivated: true,
          isBadgeItem: true,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "100", baseAuditInfo);
      expect(product.Net32Url).toBe("https://tradent.example.com");
      expect(product.IsActive).toBe(true);
      expect(product.LinkedCronName).toBe("ScrapeCron");
      expect(product.LinkedCronId).toBe("sc1");
      expect(product.ProductName).toBe("Tradent Product");
      expect(product.RegularCronName).toBe("RegularCron");
      expect(product.RegularCronId).toBe("c1");
      expect(product.IsSlowActivated).toBe(true);
      expect(product.IsBadgeItem).toBe(true);
    });

    it("reads payload from frontierDetails when present", () => {
      const payload = {
        frontierDetails: {
          net32url: "https://frontier.example.com",
          productName: "Frontier Product",
          cronId: "fc1",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "200", baseAuditInfo);
      expect(product.Net32Url).toBe("https://frontier.example.com");
      expect(product.ProductName).toBe("Frontier Product");
      expect(product.RegularCronId).toBe("fc1");
    });

    it("reads payload from mvpDetails when present", () => {
      const payload = {
        mvpDetails: {
          productName: "MVP Product",
          cronName: "MvpCron",
          isScrapeOnlyActivated: false,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "300", baseAuditInfo);
      expect(product.ProductName).toBe("MVP Product");
      expect(product.RegularCronName).toBe("MvpCron");
      expect(product.IsActive).toBe(false);
    });

    it("reads payload from topDentDetails when present", () => {
      const payload = {
        topDentDetails: {
          net32url: "https://topdent.example.com",
          productName: "TopDent Product",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "400", baseAuditInfo);
      expect(product.Net32Url).toBe("https://topdent.example.com");
      expect(product.ProductName).toBe("TopDent Product");
    });

    it("reads payload from firstDentDetails when present", () => {
      const payload = {
        firstDentDetails: {
          productName: "FirstDent Product",
          cronId: "fd1",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "500", baseAuditInfo);
      expect(product.ProductName).toBe("FirstDent Product");
      expect(product.RegularCronId).toBe("fd1");
    });

    it("reads payload from triadDetails when present", () => {
      const payload = {
        triadDetails: {
          productName: "Triad Product",
          isBadgeItem: false,
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "600", baseAuditInfo);
      expect(product.ProductName).toBe("Triad Product");
      expect(product.IsBadgeItem).toBe(false);
    });

    it("reads payload from biteSupplyDetails when present", () => {
      const payload = {
        biteSupplyDetails: {
          productName: "BiteSupply Product",
          net32url: "https://bitesupply.example.com",
        },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "700", baseAuditInfo);
      expect(product.ProductName).toBe("BiteSupply Product");
      expect(product.Net32Url).toBe("https://bitesupply.example.com");
    });

    it("prefers tradentDetails when multiple detail keys exist", () => {
      const payload = {
        tradentDetails: { productName: "Tradent" },
        frontierDetails: { productName: "Frontier" },
      };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.ProductName).toBe("Tradent");
    });

    it("assigns slow cron from sqlProductDetails when it has tradentDetails", () => {
      const sqlDetails = {
        ...baseSqlProductDetails,
        tradentDetails: { slowCronName: "SlowCron", slowCronId: "slow1" },
      };
      const product = new MySqlProduct({ tradentDetails: { productName: "P" } }, sqlDetails, "1", baseAuditInfo);
      expect(product.SlowCronName).toBe("SlowCron");
      expect(product.SlowCronId).toBe("slow1");
    });

    it("assigns all linked detail infos from sqlProductDetails when non-null", () => {
      const sqlDetails = {
        ...baseSqlProductDetails,
        tradentLinkInfo: "tradent-link",
        frontierLinkInfo: "frontier-link",
        mvpLinkInfo: "mvp-link",
        firstDentLinkInfo: "firstdent-link",
        topDentLinkInfo: "topdent-link",
        triadLinkInfo: "triad-link",
        biteSupplyLinkInfo: "bitesupply-link",
      };
      const product = new MySqlProduct({ tradentDetails: {} }, sqlDetails, "1", baseAuditInfo);
      expect(product.LinkedTradentDetailsInfo).toBe("tradent-link");
      expect(product.LinkedFrontiersDetailsInfo).toBe("frontier-link");
      expect(product.LinkedMvpDetailsInfo).toBe("mvp-link");
      expect(product.LinkedFirstDentDetailsInfo).toBe("firstdent-link");
      expect(product.LinkedTopDentDetailsInfo).toBe("topdent-link");
      expect(product.LinkedTriadDetailsInfo).toBe("triad-link");
      expect(product.LinkedBiteSupplyDetailsInfo).toBe("bitesupply-link");
    });

    it("assigns null for link infos when sqlProductDetails fields are null", () => {
      const product = new MySqlProduct({ tradentDetails: {} }, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.LinkedTradentDetailsInfo).toBeNull();
      expect(product.LinkedFrontiersDetailsInfo).toBeNull();
      expect(product.LinkedMvpDetailsInfo).toBeNull();
      expect(product.LinkedFirstDentDetailsInfo).toBeNull();
      expect(product.LinkedTopDentDetailsInfo).toBeNull();
      expect(product.LinkedTriadDetailsInfo).toBeNull();
      expect(product.LinkedBiteSupplyDetailsInfo).toBeNull();
    });

    it("assigns undefined-derived fields when payload has no detail key", () => {
      const payload = {};
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.Net32Url).toBeUndefined();
      expect(product.ProductName).toBeUndefined();
      expect(product.RegularCronId).toBeUndefined();
      expect(product.IsBadgeItem).toBeUndefined();
    });
  });

  describe("getItemValue", () => {
    it("returns value from tradentDetails for given identifier", () => {
      const payload = { tradentDetails: { foo: "bar", count: 42 } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "foo")).toBe("bar");
      expect(product.getItemValue(payload, "count")).toBe(42);
    });

    it("returns value from frontierDetails when tradentDetails absent", () => {
      const payload = { frontierDetails: { key: "frontier-value" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "key")).toBe("frontier-value");
    });

    it("returns value from mvpDetails when earlier details absent", () => {
      const payload = { mvpDetails: { id: "mvp-1" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "id")).toBe("mvp-1");
    });

    it("returns value from topDentDetails when earlier details absent", () => {
      const payload = { topDentDetails: { name: "TopDent" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "name")).toBe("TopDent");
    });

    it("returns value from firstDentDetails when earlier details absent", () => {
      const payload = { firstDentDetails: { code: "FD" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "code")).toBe("FD");
    });

    it("returns value from triadDetails when earlier details absent", () => {
      const payload = { triadDetails: { ref: "triad-ref" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "ref")).toBe("triad-ref");
    });

    it("returns value from biteSupplyDetails when earlier details absent", () => {
      const payload = { biteSupplyDetails: { sku: "BS-001" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "sku")).toBe("BS-001");
    });

    it("returns undefined when payload has no detail key", () => {
      const payload = {};
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "any")).toBeUndefined();
    });

    it("returns undefined when identifier does not exist in details", () => {
      const payload = { tradentDetails: { existing: "value" } };
      const product = new MySqlProduct(payload, baseSqlProductDetails, "1", baseAuditInfo);
      expect(product.getItemValue(payload, "missing")).toBeUndefined();
    });
  });
});
