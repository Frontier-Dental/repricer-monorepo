use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetScrapeDetailsByIdAndDate;

delimiter / /
CREATE PROCEDURE sp_GetScrapeDetailsByIdAndDate (IN productId varchar(25), IN dateStr varchar(50)) BEGIN DECLARE time_value varchar(25);

DECLARE runInfo_Id int;

SET
  time_value = concat(dateStr, '%');

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  ri.Id into runInfo_Id
from
  table_productInfo p
  left join table_runInfo ri on ri.Id = p.LinkedCronInfo
where
  p.Mpid = productId
  and ri.RunEndTime is not null
  and ri.RunEndTime like time_value
order by
  ri.Id desc
limit
  1;

#SELECT runInfo_Id;
select
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
  pb.IsActive
from
  table_productInfo p
  left join table_priceBreaks pb on p.id = pb.LinkedProductInfo
  left join table_runInfo ri on ri.Id = p.LinkedCronInfo
where
  p.Mpid = productId
  and ri.RunEndTime is not null
  and ri.RunEndTime like time_value
  and ri.Id = runInfo_Id
order by
  ri.Id desc,
  p.ItemRank,
  pb.MinQty;

COMMIT;

END;

/ /
