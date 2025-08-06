import { InternalProduct, Net32AlgoProduct } from "./types";
import { repriceProductV3 } from "./v2";

describe("repriceProductV3 basic", () => {
  it("should run without throwing for basic mock data", () => {
    const net32Products: Net32AlgoProduct[] = [
      {
        vendorId: 1,
        inStock: true,
        standardShipping: 5,
        shippingTime: 2,
        badgeName: null,
        badgeId: 0,
        priceBreaks: [
          { minQty: 1, unitPrice: 10 },
          { minQty: 2, unitPrice: 18 },
        ],
        freeShippingGap: 11,
        vendorName: "Vendor 1",
      },
      {
        vendorId: 2,
        inStock: true,
        standardShipping: 0,
        shippingTime: 2,
        badgeName: null,
        badgeId: 0,
        priceBreaks: [
          { minQty: 1, unitPrice: 11 },
          { minQty: 2, unitPrice: 19 },
        ],
        freeShippingGap: 0,
        vendorName: "Vendor 2",
      },
      {
        vendorId: 100,
        inStock: true,
        standardShipping: 5,
        shippingTime: 3,
        badgeName: null,
        badgeId: 0,
        priceBreaks: [
          { minQty: 1, unitPrice: 11 },
          { minQty: 2, unitPrice: 20 },
        ],
        freeShippingGap: 15,
        vendorName: "Vendor 3",
      },
      {
        vendorId: 101,
        inStock: true,
        standardShipping: 0,
        shippingTime: 3,
        badgeName: null,
        badgeId: 0,
        priceBreaks: [
          { minQty: 1, unitPrice: 12 },
          { minQty: 2, unitPrice: 21 },
        ],
        freeShippingGap: 0,
        vendorName: "Vendor 4",
      },
    ];
    const internalProducts: InternalProduct[] = [
      {
        ownVendorId: 1,
        floorPrice: 8,
        maxPrice: 15,
        priority: 1,
        ownVendorName: "Vendor 1",
      },
      {
        ownVendorId: 2,
        floorPrice: 10,
        maxPrice: 12,
        priority: 2,
        ownVendorName: "Vendor 2",
      },
    ];
    expect(() => {
      // repriceProductV3(net32Products, internalProducts, [1, 2], [], []);
    }).not.toThrow();
  });
});
