use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetScrapeDetailsByDateRange;

delimiter / /
CREATE PROCEDURE sp_GetScrapeDetailsByDateRange (
  IN startDateStr varchar(25),
  IN endDateStr varchar(25)
) BEGIN DECLARE start_date DATETIME DEFAULT STR_TO_DATE(startDateStr, '%d-%m-%Y');

DECLARE end_date DATETIME DEFAULT STR_TO_DATE(endDateStr, '%d-%m-%Y');

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

/**Creates temporary table for all available dates within the Date Range */
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_tbl_dateValues (
  Id Int NOT NULL AUTO_INCREMENT,
  DateValue varchar(25) not null,
  primary key (Id)
);

-- Loop thorugh Start Date and End Date to insert the available dates in the Temporary Table
WHILE (start_date <= end_date) DO
INSERT INTO
  tmp_tbl_dateValues (DateValue)
VALUES
  (
    SUBSTRING(DATE_FORMAT(start_date, '%d-%m-%Y'), 1, 10)
  );

SET
  start_date = start_date + INTERVAL 1 DAY;

END
WHILE;

/**Execute the SP with Details matching with Max of RunId*/
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
  p.Mpid IN (
    SELECT
      MpId
    FROM
      table_scrapeProductList
  )
  AND ri.RunEndTime IS NOT NULL
  AND SUBSTRING(ri.RunEndTime, 1, 10) IN (
    SELECT
      DateValue
    FROM
      tmp_tbl_dateValues
  )
ORDER BY
  ri.Id DESC,
  p.ItemRank,
  pb.MinQty;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_tbl_dateValues;

END;

/ /
