use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetActiveScrapeProductDetailsByCron;

delimiter / /
CREATE PROCEDURE sp_GetActiveScrapeProductDetailsByCron (IN cronId varchar(50)) BEGIN DECLARE linkedCron varchar(50);

SET
  linkedCron = cronId;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *
from
  table_scrapeProductList
where
  LinkedCronId = linkedCron
  and IsActive = true;

COMMIT;

END;

/ /
