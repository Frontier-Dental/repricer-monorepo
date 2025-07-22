use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetAllScrapeDetailsById;

delimiter / /
CREATE PROCEDURE sp_GetAllScrapeDetailsById (IN productId varchar(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT
  ri.Id,
  ri.CronName,
  ri.CronId,
  ri.RunStartTime,
  ri.RunEndTime,
  ri.RunId,
  ri.KeyGenId,
  ri.RunType,
  p.StartTime,
  p.EndTime,
  p.Mpid,
  p.VendorId,
  p.VendorName,
  p.VendorRegion,
  p.InStock,
  p.StandardShipping,
  p.StandardShippingStatus,
  p.HeavyShippingStatus,
  p.HeavyShipping,
  p.FreeShippingGap,
  p.ShippingTime,
  p.BadgeName,
  p.ItemRank,
  p.IsOwnVendor,
  pb.MinQty,
  pb.UnitPrice,
  pb.PromoAddlDescr,
  pb.IsActive,
  pInfo.Net32Url
FROM
  table_productInfo p
  LEFT JOIN table_priceBreaks pb ON p.id = pb.LinkedProductInfo
  LEFT JOIN table_runInfo ri ON ri.Id = p.LinkedCronInfo
  LEFT JOIN table_scrapeProductList pInfo ON pInfo.MpId = p.Mpid
WHERE
  p.Mpid = productId
  AND ri.RunEndTime IS NOT NULL
ORDER BY
  ri.Id DESC,
  p.ItemRank,
  pb.MinQty;

COMMIT;

END;

/ /
