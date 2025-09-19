use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetLastMasterDataV2;

DELIMITER / /
CREATE PROCEDURE sp_GetLastMasterDataV2 () BEGIN DECLARE time_value varchar(25);

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
  ri.Id AS RunInfo_Id,
  ri.CronName,
  ri.CronId,
  ri.RunStartTime,
  ri.RunEndTime,
  ri.RunId,
  ri.KeyGenId,
  ri.RunType,
  ri.ProductCount,
  ri.EligibleCount,
  ri.ScrapedSuccessCount,
  ri.ScrapedFailureCount,
  p.Id AS ProductInfo_Id,
  p.LinkedCronInfo,
  p.Mpid,
  p.VendorId,
  p.VendorProductId,
  p.VendorProductCode,
  p.VendorName,
  p.VendorRegion,
  p.InStock,
  p.StandardShipping,
  p.StandardShippingStatus,
  p.FreeShippingGap,
  p.ShippingTime,
  p.IsFulfillmentPolicyStock,
  p.IsBackordered,
  p.BadgeId,
  p.BadgeName,
  p.ArrivalBusinessDays,
  p.ItemRank,
  p.IsOwnVendor,
  p.HeavyShippingStatus,
  p.HeavyShipping,
  p.Inventory,
  p.ArrivalDate,
  p.IsLowestTotalPrice,
  p.StartTime AS ProductInfo_StartTime,
  p.EndTime AS ProductInfo_EndTime,
  pb.Id AS PriceBreaks_Id,
  pb.LinkedProductInfo,
  pb.PMID,
  pb.MinQty,
  pb.UnitPrice,
  pb.PromoAddlDescr,
  pb.IsActive,
  scpl.IsBadgeItem,
  scpl.RegularCronName AS CronName,
  scpl.SlowCronName AS SlowCronName,
  tr.Activated AS TRA_Active,
  fr.Activated AS FRO_Active,
  mr.Activated AS MVP_Active,
  td.Activated AS TOP_Active,
  fd.Activated AS FIR_Active,
  tr.AllowReprice AS TRA_Reprice,
  fr.AllowReprice AS FRO_Reprice,
  mr.AllowReprice AS MVP_Reprice,
  td.AllowReprice AS TOP_Reprice,
  fd.AllowReprice AS FIR_Reprice,
  CASE
    WHEN tr.Activated = false then null
    else tr.FloorPrice
  END AS TRA_FloorPrice,
  CASE
    WHEN fr.Activated = false then null
    else fr.FloorPrice
  END AS FRO_FloorPrice,
  CASE
    WHEN mr.Activated = false then null
    else mr.FloorPrice
  END AS MVP_FloorPrice,
  CASE
    WHEN td.Activated = false then null
    else td.FloorPrice
  END AS TOP_FloorPrice,
  CASE
    WHEN fd.Activated = false then null
    else fd.FloorPrice
  END AS FIR_FloorPrice,
  CASE
    WHEN tr.Activated = false then null
    else tr.MaxPrice
  END AS TRA_MaxPrice,
  CASE
    WHEN fr.Activated = false then null
    else fr.MaxPrice
  END AS FRO_MaxPrice,
  CASE
    WHEN mr.Activated = false then null
    else mr.MaxPrice
  END AS MVP_MaxPrice,
  CASE
    WHEN td.Activated = false then null
    else td.MaxPrice
  END AS TOP_MaxPrice,
  CASE
    WHEN fd.Activated = false then null
    else fd.MaxPrice
  END AS FIR_MaxPrice,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastCronMessage
  END AS TRA_LastRepriceComment,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastCronMessage
  END AS FRO_LastRepriceComment,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastCronMessage
  END AS MVP_LastRepriceComment,
  CASE
    WHEN td.Activated = false then null
    else td.LastCronMessage
  END AS TOP_LastRepriceComment,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastCronMessage
  END AS FIR_LastRepriceComment,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastUpdateTime
  END AS TRA_LastPriceUpdatedOn,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastUpdateTime
  END AS FRO_LastPriceUpdatedOn,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastUpdateTime
  END AS MVP_LastPriceUpdatedOn,
  CASE
    WHEN td.Activated = false then null
    else td.LastUpdateTime
  END AS TOP_LastPriceUpdatedOn,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastUpdateTime
  END AS FIR_LastPriceUpdatedOn,
  CASE
    WHEN tr.Activated = false then null
    else tr.LowestVendorPrice
  END AS TRA_LowestVendorPrice,
  CASE
    WHEN fr.Activated = false then null
    else fr.LowestVendorPrice
  END AS FRO_LowestVendorPrice,
  CASE
    WHEN mr.Activated = false then null
    else mr.LowestVendorPrice
  END AS MVP_LowestVendorPrice,
  CASE
    WHEN td.Activated = false then null
    else td.LowestVendorPrice
  END AS TOP_LowestVendorPrice,
  CASE
    WHEN fd.Activated = false then null
    else fd.LowestVendorPrice
  END AS FIR_LowestVendorPrice,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastExistingPrice
  END AS TRA_LastExistingPrice,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastExistingPrice
  END AS FRO_LastExistingPrice,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastExistingPrice
  END AS MVP_LastExistingPrice,
  CASE
    WHEN td.Activated = false then null
    else td.LastExistingPrice
  END AS TOP_LastExistingPrice,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastExistingPrice
  END AS FIR_LastExistingPrice,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastCronTime
  END AS TRA_LastCronRunAt,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastCronTime
  END AS FRO_LastCronRunAt,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastCronTime
  END AS MVP_LastCronRunAt,
  CASE
    WHEN td.Activated = false then null
    else td.LastCronTime
  END AS TOP_LastCronRunAt,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastCronTime
  END AS FIR_LastCronRunAt,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastCronRun
  END AS TRA_LastCronRun,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastCronRun
  END AS FRO_LastCronRun,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastCronRun
  END AS MVP_LastCronRun,
  CASE
    WHEN td.Activated = false then null
    else td.LastCronRun
  END AS TOP_LastCronRun,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastCronRun
  END AS FIR_LastCronRun,
  CASE
    WHEN tr.Activated = false then null
    else tr.LastUpdatedBy
  END AS TRA_LastUpdatedCron,
  CASE
    WHEN fr.Activated = false then null
    else fr.LastUpdatedBy
  END AS FRO_LastUpdatedCron,
  CASE
    WHEN mr.Activated = false then null
    else mr.LastUpdatedBy
  END AS MVP_LastUpdatedCron,
  CASE
    WHEN td.Activated = false then null
    else td.LastUpdatedBy
  END AS TOP_LastUpdatedCron,
  CASE
    WHEN fd.Activated = false then null
    else fd.LastUpdatedBy
  END AS FIR_LastUpdatedCron,
  CASE
    WHEN tr.Activated = false then null
    else tr.IsNCNeeded
  END AS TRA_NC,
  CASE
    WHEN fr.Activated = false then null
    else fr.IsNCNeeded
  END AS FRO_NC,
  CASE
    WHEN mr.Activated = false then null
    else mr.IsNCNeeded
  END AS MVP_NC,
  CASE
    WHEN td.Activated = false then null
    else td.IsNCNeeded
  END AS TOP_NC,
  CASE
    WHEN fd.Activated = false then null
    else fd.IsNCNeeded
  END AS FIR_NC,
  CASE
    WHEN tr.Activated = false then null
    else tr.SuppressPriceBreakForOne
  END AS TRA_SuppressPriceBreakIfQ1NotUpdated,
  CASE
    WHEN fr.Activated = false then null
    else fr.SuppressPriceBreakForOne
  END AS FRO_SuppressPriceBreakIfQ1NotUpdated,
  CASE
    WHEN mr.Activated = false then null
    else mr.SuppressPriceBreakForOne
  END AS MVP_SuppressPriceBreakIfQ1NotUpdated,
  CASE
    WHEN td.Activated = false then null
    else td.SuppressPriceBreakForOne
  END AS TOP_SuppressPriceBreakIfQ1NotUpdated,
  CASE
    WHEN fd.Activated = false then null
    else fd.SuppressPriceBreakForOne
  END AS FIR_SuppressPriceBreakIfQ1NotUpdated,
  CASE
    WHEN tr.Activated = false then null
    else tr.ApplyBuyBoxLogic
  END AS TRA_KeepBuyBox,
  CASE
    WHEN fr.Activated = false then null
    else fr.ApplyBuyBoxLogic
  END AS FRO_KeepBuyBox,
  CASE
    WHEN mr.Activated = false then null
    else mr.ApplyBuyBoxLogic
  END AS MVP_KeepBuyBox,
  CASE
    WHEN td.Activated = false then null
    else td.ApplyBuyBoxLogic
  END AS TOP_KeepBuyBox,
  CASE
    WHEN fd.Activated = false then null
    else fd.ApplyBuyBoxLogic
  END AS FIR_KeepBuyBox,
  CASE
    WHEN tr.Activated = false then null
    else tr.ApplyNcForBuyBox
  END AS TRA_ApplyNcForBuyBox,
  CASE
    WHEN fr.Activated = false then null
    else fr.ApplyNcForBuyBox
  END AS FRO_ApplyNcForBuyBox,
  CASE
    WHEN mr.Activated = false then null
    else mr.ApplyNcForBuyBox
  END AS MVP_ApplyNcForBuyBox,
  CASE
    WHEN td.Activated = false then null
    else td.ApplyNcForBuyBox
  END AS TOP_ApplyNcForBuyBox,
  CASE
    WHEN fd.Activated = false then null
    else fd.ApplyNcForBuyBox
  END AS FIR_ApplyNcForBuyBox,
  CASE
    WHEN tr.Activated = false then null
    else tr.BadgeIndicator
  END AS TRA_BadgeIndicator,
  CASE
    WHEN fr.Activated = false then null
    else fr.BadgeIndicator
  END AS FRO_BadgeIndicator,
  CASE
    WHEN mr.Activated = false then null
    else mr.BadgeIndicator
  END AS MVP_BadgeIndicator,
  CASE
    WHEN td.Activated = false then null
    else td.BadgeIndicator
  END AS TOP_BadgeIndicator,
  CASE
    WHEN fd.Activated = false then null
    else fd.BadgeIndicator
  END AS FIR_BadgeIndicator,
  scpl.Net32Url
FROM
  table_productInfo p
  LEFT JOIN table_priceBreaks pb ON p.id = pb.LinkedProductInfo
  LEFT JOIN table_runInfo ri ON ri.Id = p.LinkedCronInfo
  LEFT JOIN table_scrapeProductList scpl ON scpl.MpId = p.Mpid
  LEFT JOIN table_tradentDetails tr ON tr.Id = scpl.LinkedTradentDetailsInfo
  LEFT JOIN table_frontierDetails fr ON fr.Id = scpl.LinkedFrontiersDetailsInfo
  LEFT JOIN table_mvpDetails mr ON mr.Id = scpl.LinkedMvpDetailsInfo
  LEFT JOIN table_topDentDetails td on td.Id = scpl.LinkedTopDentDetailsInfo
  LEFT JOIN table_firstDentDetails fd on fd.Id = scpl.LinkedFirstDentDetailsInfo
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
