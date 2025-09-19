use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetLastScrapeDetails;

delimiter / /
CREATE PROCEDURE sp_GetLastScrapeDetails () BEGIN DECLARE time_value varchar(25);

SET
  time_value = concat(DATE_FORMAT(CURDATE(), '%d-%m-%Y'), '%');

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

/**Creates temporary table for all available MpIds alongwith their RunIds for RunInfo*/
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_tbl_runInfo (
  Id Int NOT NULL AUTO_INCREMENT,
  RunId Int,
  Mpid varchar(25) not null,
  CronName varchar(25) not null,
  primary key (Id)
);

Insert into
  tmp_tbl_runInfo (RunId, Mpid, CronName) (
    select distinct
      ri.Id,
      p.Mpid,
      ri.CronName
    from
      table_productInfo p
      left join table_runInfo ri on ri.Id = p.LinkedCronInfo
    where
      p.Mpid in (
        select
          MpId
        from
          table_scrapeProductList
      )
      and ri.RunEndTime is not null
      and ri.RunEndTime like time_value
    order by
      ri.Id desc
  );

create Index tmp_idx_runInfo_mpid on tmp_tbl_runInfo (Mpid);

create Index tmp_idx_runInfo_runid on tmp_tbl_runInfo (RunId);

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
  AND ri.RunEndTime LIKE time_value
  AND ri.Id IN (
    SELECT
      MAX(RunId)
    FROM
      tmp_tbl_runInfo
    WHERE
      Mpid = p.Mpid
  )
ORDER BY
  ri.Id DESC,
  p.ItemRank,
  pb.MinQty;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS tmp_tbl_runInfo;

END;

/ /
