import { getKnexInstance } from "../knex-wrapper";

export async function getAllProductDetails() {
  const db = getKnexInstance();
  const result = db("table_scrapeProductList as pl").select(
    "pl.Id as ProductIdentifier",
    "pl.MpId as ProductId",
    "pl.ProductName",
    "pl.Net32Url",
    "pl.IsActive as ScrapeOnlyActive",
    "pl.LinkedCronName as LinkedScrapeOnlyCron",
    "pl.LinkedCronId as LinkedScrapeOnlyCronId",
    "pl.RegularCronName",
    "pl.RegularCronId",
    "pl.SlowCronName",
    "pl.SlowCronId",
    "pl.IsSlowActivated",
    "pl.IsBadgeItem",
  );

  return result;
}
