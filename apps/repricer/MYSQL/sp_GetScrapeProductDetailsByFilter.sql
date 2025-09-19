DROP PROCEDURE IF EXISTS sp_GetScrapeProductDetailsByFilter;

DELIMITER / / CREATE DEFINER = "db_admin" @"%" PROCEDURE "sp_GetScrapeProductDetailsByFilter" (
  IN pageSize int,
  IN IdValue varchar(20),
  IN pgNumber int
) BEGIN DECLARE limitCount int;

DECLARE idToSearch varchar(20);

DECLARE off_set int default 0;

SET
  limitCount = pageSize;

SET
  idToSearch = IdValue;

SET
  off_set = (pgNumber - 1) * pageSize;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  Id,
  MpId,
  Net32Url,
  IsActive,
  LinkedCronName,
  LinkedCronId,
  LastUpdatedBy,
  LastUpdatedAt,
  LastScrapedDate,
  IsBadgeItem
from
  table_scrapeProductList
where
  1 = 1
  and CAST(MpId as char) like idToSearch
limit
  limitCount
offset
  off_set;

END / / DELIMITER;
