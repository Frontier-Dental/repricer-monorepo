use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetScrapeProductDetailsByFilter;

delimiter / /
CREATE PROCEDURE sp_GetScrapeProductDetailsByFilter (IN pageSize int, IN IdValue varchar(20)) BEGIN DECLARE limitCount int;

DECLARE idToSearch varchar(20);

SET
  limitCount = pageSize;

SET
  idToSearch = IdValue;

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
  IsBade
from
  table_scrapeProductList
where
  CAST(MpId as char) like idToSearch
limit
  limitCount;

COMMIT;

END;

/ /
