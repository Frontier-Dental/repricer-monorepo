use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetActiveFullProductDetailsListByCron;

delimiter / /
CREATE PROCEDURE sp_GetActiveFullProductDetailsListByCron (IN cronId varchar(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *
from
  (
    select
      pl.Id as ProductIdentifier,
      pl.MpId as ProductId,
      pl.ProductName,
      pl.Net32Url,
      pl.IsActive as ScrapeOnlyActive,
      pl.LinkedCronName as LinkedScrapeOnlyCron,
      pl.LinkedCronId as LinkedScrapeOnlyCronId,
      pl.RegularCronName,
      pl.RegularCronId,
      pl.SlowCronName,
      pl.SlowCronId,
      pl.IsSlowActivated,
      tdl.*
    from
      table_scrapeProductList pl
      left join table_tradentDetails tdl on tdl.id = pl.LinkedTradentDetailsInfo
    where
      pl.RegularCronId = cronId
      and pl.IsSlowActivated != true
      and tdl.ChannelName is not Null
      and tdl.Activated = true
    union
    select
      pl.Id as ProductIdentifier,
      pl.MpId as ProductId,
      pl.ProductName,
      pl.Net32Url,
      pl.IsActive as ScrapeOnlyActive,
      pl.LinkedCronName as LinkedScrapeOnlyCron,
      pl.LinkedCronId as LinkedScrapeOnlyCronId,
      pl.RegularCronName,
      pl.RegularCronId,
      pl.SlowCronName,
      pl.SlowCronId,
      pl.IsSlowActivated,
      fdl.*
    from
      table_scrapeProductList pl
      left join table_frontierDetails fdl on fdl.id = pl.LinkedFrontiersDetailsInfo
    where
      pl.RegularCronId = cronId
      and pl.IsSlowActivated != true
      and fdl.ChannelName is not Null
      and fdl.Activated = true
    union
    select
      pl.Id as ProductIdentifier,
      pl.MpId as ProductId,
      pl.ProductName,
      pl.Net32Url,
      pl.IsActive as ScrapeOnlyActive,
      pl.LinkedCronName as LinkedScrapeOnlyCron,
      pl.LinkedCronId as LinkedScrapeOnlyCronId,
      pl.RegularCronName,
      pl.RegularCronId,
      pl.SlowCronName,
      pl.SlowCronId,
      pl.IsSlowActivated,
      mdl.*
    from
      table_scrapeProductList pl
      left join table_mvpDetails mdl on mdl.id = pl.LinkedMvpDetailsInfo
    where
      pl.RegularCronId = cronId
      and pl.IsSlowActivated != true
      and mdl.ChannelName is not Null
      and mdl.Activated = true
  ) subQuery
where
  ChannelName is not null
order by
  ProductId;

COMMIT;

END;

/ /
