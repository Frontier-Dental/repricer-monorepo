import { getKnexInstance } from "../knex-wrapper";

export async function getAllProductDetails() {
  const db = getKnexInstance();
  const result = db("table_scrapeProductList as pl").select(
    "pl.Id as ProductIdentifier",
    "pl.MpId as ProductId",
    "pl.ProductName",
    "pl.Net32Url",
    "pl.IsActive",
    "pl.RegularCronName",
    "pl.RegularCronId",
    "pl.SlowCronName",
    "pl.SlowCronId",
    "pl.IsSlowActivated",
    "pl.IsBadgeItem",
    "pl.v2_algo_only",
  );

  return result;
}

export async function updateV2AlgoOnly(
  mpId: number,
  v2AlgoOnly: boolean,
): Promise<number> {
  const db = getKnexInstance();
  const result = await db("table_scrapeProductList")
    .where("MpId", mpId)
    .update({ v2_algo_only: v2AlgoOnly });

  return result;
}

export async function getV2AlgoOnlyStatus(mpId: number): Promise<boolean> {
  const db = getKnexInstance();
  const result = await db("table_scrapeProductList")
    .select("v2_algo_only")
    .where("MpId", mpId)
    .first();

  return result?.v2_algo_only || false;
}
