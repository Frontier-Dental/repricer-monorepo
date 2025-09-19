use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFullProductDetailsListByTag;

delimiter / /
CREATE PROCEDURE sp_GetFullProductDetailsListByTag (IN tagValue varchar(50)) BEGIN DECLARE _searchKey varchar(50);

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SET
  _searchKey = CONCAT('%', tagValue, '%');

/**Creates temporary table for all available MpIds alongwith their RunIds for RunInfo*/
CREATE TEMPORARY TABLE IF NOT EXISTS tmp_tbl_tagInfo (
  Id Int NOT NULL AUTO_INCREMENT,
  MpId varchar(25) not null,
  primary key (Id)
);

create Index tmp_idx_tagInfo_mpid on tmp_tbl_tagInfo (MpId);

INSERT INTO
  tmp_tbl_tagInfo (MpId) (
    SELECT DISTINCT
      MpId
    from
      (
        select
          MpId
        from
          table_tradentDetails
        where
          MpId like _searchKey
          OR FocusId like _searchKey
          OR ChannelId like _searchKey
        UNION
        select
          MpId
        from
          table_frontierDetails
        where
          MpId like _searchKey
          OR FocusId like _searchKey
          OR ChannelId like _searchKey
        UNION
        select
          MpId
        from
          table_mvpDetails
        where
          MpId like _searchKey
          OR FocusId like _searchKey
          OR ChannelId like _searchKey
      ) subQuery1
    where
      1 = 1
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
  ) subQuery
WHERE
  ChannelName IS NOT NULL
  AND MpId in (
    Select
      MpId
    from
      tmp_tbl_tagInfo
  )
ORDER BY
  ProductId;

DROP temporary TABLE IF EXISTS tmp_tbl_tagInfo;

COMMIT;

END;

/ /
