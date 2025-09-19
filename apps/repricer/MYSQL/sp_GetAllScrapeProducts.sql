use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetAllScrapeProducts;

delimiter / /
CREATE PROCEDURE sp_GetAllScrapeProducts () BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *,
  case
    when IsActive = 1 then 'true'
    when IsActive = 0 then 'false'
  end As Is_Active,
  case
    when IsBadgeItem is null then 'false'
    when IsBadgeItem = 1 then 'true'
    when IsBadgeItem = 0 then 'false'
  end as Is_Badge
from
  table_scrapeProductList;

COMMIT;

END;

/ /
