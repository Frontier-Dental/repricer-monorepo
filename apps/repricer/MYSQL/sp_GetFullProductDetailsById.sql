use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFullProductDetailsById;

delimiter / /
CREATE PROCEDURE sp_GetFullProductDetailsById (IN mpid int) BEGIN DECLARE _mpid Int;

SET
  _mpid = mpid;

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
      pl.IsBadgeItem,
      tdl.*
    from
      table_scrapeProductList pl
      left join table_tradentDetails tdl on tdl.id = pl.LinkedTradentDetailsInfo
    where
      pl.MpId = _mpid
      and exists (
        select
          1
        from
          table_tradentDetails
        where
          ChannelName is not null
          and MpId = _mpid
      )
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
      pl.IsBadgeItem,
      fdl.*
    from
      table_scrapeProductList pl
      left join table_frontierDetails fdl on fdl.id = pl.LinkedFrontiersDetailsInfo
    where
      pl.MpId = _mpid
      and exists (
        select
          1
        from
          table_frontierDetails
        where
          ChannelName is not null
          and MpId = _mpid
      )
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
      pl.IsBadgeItem,
      mdl.*
    from
      table_scrapeProductList pl
      left join table_mvpDetails mdl on mdl.id = pl.LinkedMvpDetailsInfo
    where
      pl.MpId = _mpid
      and exists (
        select
          1
        from
          table_mvpDetails
        where
          ChannelName is not null
          and MpId = _mpid
      )
  ) subQuery
where
  ChannelName is not null;

COMMIT;

END;

/ /
