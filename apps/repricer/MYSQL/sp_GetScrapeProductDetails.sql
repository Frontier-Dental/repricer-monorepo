use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetScrapeProductDetails;

delimiter / /
CREATE PROCEDURE sp_GetScrapeProductDetails (IN pageNumber int, IN pageSize int) BEGIN DECLARE offsetCount int;

DECLARE limitCount int;

SET
  offsetCount = pageNumber;

SET
  limitCount = pageSize;

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
limit
  limitCount
offset
  offsetCount;

COMMIT;

END;

/ /
