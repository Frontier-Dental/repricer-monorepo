use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetActiveFullProductDetailsListBySlowCronV3;

delimiter / /
CREATE PROCEDURE sp_GetActiveFullProductDetailsListBySlowCronV3 (IN cronId varchar(50)) BEGIN
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
      pl.algo_execution_mode,
      tdl.*
    from
      table_scrapeProductList pl
      left join table_tradentDetails tdl on tdl.id = pl.LinkedTradentDetailsInfo
    where
      pl.SlowCronId = cronId
      and tdl.Activated = true
      and pl.IsSlowActivated = true
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
      pl.algo_execution_mode,
      fdl.*
    from
      table_scrapeProductList pl
      left join table_frontierDetails fdl on fdl.id = pl.LinkedFrontiersDetailsInfo
    where
      pl.SlowCronId = cronId
      and fdl.Activated = true
      and pl.IsSlowActivated = true
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
      pl.algo_execution_mode,
      mdl.*
    from
      table_scrapeProductList pl
      left join table_mvpDetails mdl on mdl.id = pl.LinkedMvpDetailsInfo
    where
      pl.SlowCronId = cronId
      and mdl.Activated = true
      and pl.IsSlowActivated = true
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
      pl.algo_execution_mode,
      firstDl.*
    from
      table_scrapeProductList pl
      left join table_firstDentDetails firstDl on firstDl.id = pl.LinkedFirstDentDetailsInfo
    where
      pl.SlowCronId = cronId
      and firstDl.Activated = true
      and pl.IsSlowActivated = true
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
      pl.algo_execution_mode,
      topDl.*
    from
      table_scrapeProductList pl
      left join table_topDentDetails topDl on topDl.id = pl.LinkedTopDentDetailsInfo
    where
      pl.SlowCronId = cronId
      and topDl.Activated = true
      and pl.IsSlowActivated = true
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
      pl.algo_execution_mode,
      triadDl.*
    from
      table_scrapeProductList pl
      left join table_triadDetails triadDl on triadDl.id = pl.LinkedTriadDetailsInfo
    where
      pl.SlowCronId = cronId
      and triadDl.Activated = true
      and pl.IsSlowActivated = true
  ) subQuery
where
  ChannelName is not null
order by
  ProductId;

COMMIT;

END;

/ /
