use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFullProductDetailsListByFilterV4;

delimiter / /
CREATE PROCEDURE sp_GetFullProductDetailsListByFilterV4 (IN pageNumber int, IN pageSize int) BEGIN DECLARE _skipNo Int;

DECLARE _pgSz Int;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SET
  _skipNo = pageNumber * pageSize;

SET
  _pgSz = pageSize;

CREATE TABLE IF NOT EXISTS filtered_table_view (
  Id Int NOT NULL AUTO_INCREMENT,
  MpId int not null,
  primary key (Id)
);

DELETE from filtered_table_view;

INSERT INTO
  filtered_table_view (MpId) (
    Select
      MpId
    FROM
      table_scrapeProductList
    where
      RegularCronName is not Null
    ORDER BY
      Id DESC
    LIMIT
      _pgSz
    OFFSET
      _skipNo
  );

SELECT
  *
FROM
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
      pl.IsBadgeItem,
      tdl.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_tradentDetails tdl ON tdl.id = pl.LinkedTradentDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      fdl.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_frontierDetails fdl ON fdl.id = pl.LinkedFrontiersDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      mdl.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_mvpDetails mdl ON mdl.id = pl.LinkedMvpDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      firstDl.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_firstDentDetails firstDl ON firstDl.id = pl.LinkedFirstDentDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      topDl.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_topDentDetails topDl ON topDl.id = pl.LinkedTopDentDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      trd.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_triadDetails trd ON trd.id = pl.LinkedTriadDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
    UNION
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
      pl.IsBadgeItem,
      bsd.*
    FROM
      table_scrapeProductList pl
      LEFT JOIN table_biteSupplyDetails bsd ON bsd.id = pl.LinkedBiteSupplyDetailsInfo
    WHERE
      pl.MpId IN (
        SELECT
          MpId
        FROM
          filtered_table_view
      )
  ) subQuery
WHERE
  ChannelName IS NOT NULL
ORDER BY
  ProductId;

COMMIT;

DELETE from filtered_table_view;

END;

/ /
