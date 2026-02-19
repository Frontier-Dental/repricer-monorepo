import fc from "fast-check";
import { RepriceData, RepriceModel } from "../../../../model/reprice-model";
import { Net32Product, Net32PriceBreak } from "../../../../types/net32";

// ---------------------------------------------------------------------------
// Primitive arbitraries
// ---------------------------------------------------------------------------

export const arbPrice = fc.double({ min: 0.01, max: 999.99, noNaN: true, noDefaultInfinity: true }).map((p) => Math.round(p * 100) / 100);

export const arbPriceString = arbPrice.map((p) => p.toFixed(2));

export const arbMinQty = fc.constantFrom(1, 2, 3, 5, 6, 10, 12, 24);

// ---------------------------------------------------------------------------
// RepriceData arbitrary
// ---------------------------------------------------------------------------

export const arbRepriceData = fc
  .record({
    oldPrice: arbPrice,
    newPrice: arbPriceString,
    minQty: arbMinQty,
  })
  .map(({ oldPrice, newPrice, minQty }) => {
    const rd = new RepriceData(oldPrice, parseFloat(newPrice), true, "CHANGE: test", minQty);
    rd.isRepriced = true;
    rd.active = true;
    rd.lowestVendor = "TestVendor";
    rd.lowestVendorPrice = oldPrice;
    return rd;
  });

export const arbIgnoredRepriceData = fc
  .record({
    oldPrice: arbPrice,
    minQty: arbMinQty,
  })
  .map(({ oldPrice, minQty }) => {
    const rd = new RepriceData(oldPrice, null, false, "IGNORE: test", minQty);
    rd.active = true;
    rd.lowestVendor = "TestVendor";
    rd.lowestVendorPrice = oldPrice;
    return rd;
  });

// ---------------------------------------------------------------------------
// RepriceModel arbitraries
// ---------------------------------------------------------------------------

export const arbSingleBreakRepriceModel = arbRepriceData.map((rd) => {
  const model = new RepriceModel("TEST-123", null, "Test Product", null, false, false, [], null);
  model.repriceDetails = rd;
  model.vendorName = "TestVendor";
  model.vendorId = "99999";
  return model;
});

export const arbMultiBreakRepriceModel = fc
  .record({
    break1: arbRepriceData.map((rd) => {
      rd.minQty = 1;
      return rd;
    }),
    break2Price: arbPrice,
    break3Price: fc.option(arbPrice, { nil: undefined }),
    break4Price: fc.option(arbPrice, { nil: undefined }),
  })
  .map(({ break1, break2Price, break3Price, break4Price }) => {
    const breaks: RepriceData[] = [break1];

    const rd2 = new RepriceData(break2Price, break2Price * 0.95, true, "CHANGE: test", 2);
    rd2.isRepriced = true;
    rd2.active = true;
    rd2.lowestVendor = "TestVendor";
    rd2.lowestVendorPrice = break2Price;
    breaks.push(rd2);

    if (break3Price !== undefined) {
      const rd3 = new RepriceData(break3Price, break3Price * 0.9, true, "CHANGE: test", 6);
      rd3.isRepriced = true;
      rd3.active = true;
      rd3.lowestVendor = "TestVendor";
      rd3.lowestVendorPrice = break3Price;
      breaks.push(rd3);
    }

    if (break4Price !== undefined) {
      const rd4 = new RepriceData(break4Price, break4Price * 0.85, true, "CHANGE: test", 12);
      rd4.isRepriced = true;
      rd4.active = true;
      rd4.lowestVendor = "TestVendor";
      rd4.lowestVendorPrice = break4Price;
      breaks.push(rd4);
    }

    const model = new RepriceModel("TEST-456", null, "Test Multi Product", null, false, true, breaks, null);
    model.vendorName = "TestVendor";
    model.vendorId = "99999";
    return model;
  });

// ---------------------------------------------------------------------------
// Constrained arbitraries for specific invariant tests
// ---------------------------------------------------------------------------

export const arbDownwardPriceMove = fc
  .record({
    oldPrice: fc.double({ min: 1.0, max: 999.99, noNaN: true, noDefaultInfinity: true }),
    delta: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ oldPrice, delta }) => {
    const old = Math.round(oldPrice * 100) / 100;
    const newP = Math.round(Math.max(0.01, old - delta) * 100) / 100;
    return { oldPrice: old, newPrice: newP };
  })
  .filter(({ oldPrice, newPrice }) => newPrice < oldPrice);

export const arbUpwardPriceMove = fc
  .record({
    oldPrice: fc.double({ min: 0.01, max: 899.99, noNaN: true, noDefaultInfinity: true }),
    delta: fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true }),
  })
  .map(({ oldPrice, delta }) => {
    const old = Math.round(oldPrice * 100) / 100;
    const newP = Math.round(Math.min(999.99, old + delta) * 100) / 100;
    return { oldPrice: old, newPrice: newP };
  })
  .filter(({ oldPrice, newPrice }) => newPrice > oldPrice);
