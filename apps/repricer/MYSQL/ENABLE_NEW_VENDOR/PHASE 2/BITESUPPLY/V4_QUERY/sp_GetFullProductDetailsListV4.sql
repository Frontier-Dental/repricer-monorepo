use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFullProductDetailsListV4;

delimiter / /
CREATE PROCEDURE sp_GetFullProductDetailsListV4 () BEGIN
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
      firstDL.*
    from
      table_scrapeProductList pl
      left join table_firstDentDetails firstDL on firstDL.id = pl.LinkedFirstDentDetailsInfo
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
      topDl.*
    from
      table_scrapeProductList pl
      left join table_topDentDetails topDl on topDl.id = pl.LinkedTopDentDetailsInfo
    UNION
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
      trd.*
    from
      table_scrapeProductList pl
      left join table_triadDetails trd on trd.id = pl.LinkedTriadDetailsInfo
    UNION
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
      bsd.*
    from
      table_scrapeProductList pl
      left join table_biteSupplyDetails bsd on bsd.id = pl.LinkedBiteSupplyDetailsInfo
  ) subQuery
where
  ChannelName is not null
order by
  ProductId;

COMMIT;

END;

 / /
