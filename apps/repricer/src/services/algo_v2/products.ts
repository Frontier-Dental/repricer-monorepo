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
    "pl.algo_execution_mode",
  );

  return result;
}

export async function updateAlgoExecutionMode(
  mpId: number,
  algoExecutionMode: string,
): Promise<number> {
  const db = getKnexInstance();
  const result = await db("table_scrapeProductList")
    .where("MpId", mpId)
    .update({ algo_execution_mode: algoExecutionMode });

  return result;
}

export async function getAlgoExecutionMode(mpId: number): Promise<string> {
  const db = getKnexInstance();
  const result = await db("table_scrapeProductList")
    .select("algo_execution_mode")
    .where("MpId", mpId)
    .first();

  return result.algo_execution_mode;
}
