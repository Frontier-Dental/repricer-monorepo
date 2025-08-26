use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetActiveFullProductDetailsListByCronV2;

delimiter / /
CREATE PROCEDURE sp_GetActiveFullProductDetailsListByCronV2 (IN cronId varchar(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT
  *
FROM
  (
    (
      SELECT
        pl.Id AS ProductIdentifier,
        pl.MpId AS ProductId,
        pl.ProductName,
        pl.Net32Url,
        pl.IsActive AS ScrapeOnlyActive,
        pl.LinkedCronName AS LinkedScrapeOnlyCron,
        pl.LinkedCronId AS LinkedScrapeOnlyCronId,
        pl.RegularCronName,
        pl.RegularCronId,
        pl.SlowCronName,
        pl.SlowCronId,
        pl.IsSlowActivated,
        tdl.*
      FROM
        table_scrapeProductList pl
        LEFT JOIN table_tradentDetails tdl ON tdl.id = pl.LinkedTradentDetailsInfo
      WHERE
        pl.RegularCronId = cronId
        AND pl.IsSlowActivated != TRUE
        AND tdl.ChannelName IS NOT NULL
        AND tdl.Activated = TRUE
    )
    UNION
    (
      SELECT
        pl.Id AS ProductIdentifier,
        pl.MpId AS ProductId,
        pl.ProductName,
        pl.Net32Url,
        pl.IsActive AS ScrapeOnlyActive,
        pl.LinkedCronName AS LinkedScrapeOnlyCron,
        pl.LinkedCronId AS LinkedScrapeOnlyCronId,
        pl.RegularCronName,
        pl.RegularCronId,
        pl.SlowCronName,
        pl.SlowCronId,
        pl.IsSlowActivated,
        fdl.*
      FROM
        table_scrapeProductList pl
        LEFT JOIN table_frontierDetails fdl ON fdl.id = pl.LinkedFrontiersDetailsInfo
      WHERE
        pl.RegularCronId = cronId
        AND pl.IsSlowActivated != TRUE
        AND fdl.ChannelName IS NOT NULL
        AND fdl.Activated = TRUE
    )
    UNION
    (
      SELECT
        pl.Id AS ProductIdentifier,
        pl.MpId AS ProductId,
        pl.ProductName,
        pl.Net32Url,
        pl.IsActive AS ScrapeOnlyActive,
        pl.LinkedCronName AS LinkedScrapeOnlyCron,
        pl.LinkedCronId AS LinkedScrapeOnlyCronId,
        pl.RegularCronName,
        pl.RegularCronId,
        pl.SlowCronName,
        pl.SlowCronId,
        pl.IsSlowActivated,
        mdl.*
      FROM
        table_scrapeProductList pl
        LEFT JOIN table_mvpDetails mdl ON mdl.id = pl.LinkedMvpDetailsInfo
      WHERE
        pl.RegularCronId = cronId
        AND pl.IsSlowActivated != TRUE
        AND mdl.ChannelName IS NOT NULL
        AND mdl.Activated = TRUE
    )
    UNION
    (
      SELECT
        pl.Id AS ProductIdentifier,
        pl.MpId AS ProductId,
        pl.ProductName,
        pl.Net32Url,
        pl.IsActive AS ScrapeOnlyActive,
        pl.LinkedCronName AS LinkedScrapeOnlyCron,
        pl.LinkedCronId AS LinkedScrapeOnlyCronId,
        pl.RegularCronName,
        pl.RegularCronId,
        pl.SlowCronName,
        pl.SlowCronId,
        pl.IsSlowActivated,
        firstDl.*
      FROM
        table_scrapeProductList pl
        LEFT JOIN table_firstDentDetails firstDl ON firstDl.id = pl.LinkedFirstDentDetailsInfo
      WHERE
        pl.RegularCronId = cronId
        AND pl.IsSlowActivated != TRUE
        AND firstDl.ChannelName IS NOT NULL
        AND firstDl.Activated = TRUE
    )
    UNION
    (
      SELECT
        pl.Id AS ProductIdentifier,
        pl.MpId AS ProductId,
        pl.ProductName,
        pl.Net32Url,
        pl.IsActive AS ScrapeOnlyActive,
        pl.LinkedCronName AS LinkedScrapeOnlyCron,
        pl.LinkedCronId AS LinkedScrapeOnlyCronId,
        pl.RegularCronName,
        pl.RegularCronId,
        pl.SlowCronName,
        pl.SlowCronId,
        pl.IsSlowActivated,
        topDl.*
      FROM
        table_scrapeProductList pl
        LEFT JOIN table_topDentDetails topDl ON topDl.id = pl.LinkedTopDentDetailsInfo
      WHERE
        pl.RegularCronId = cronId
        AND pl.IsSlowActivated != TRUE
        AND topDl.ChannelName IS NOT NULL
        AND topDl.Activated = TRUE
    )
  ) subQuery
WHERE
  ChannelName IS NOT NULL
ORDER BY
  ProductId;

COMMIT;

END;

/ /
