use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetProductDetailsByCronAndId;

delimiter / /
CREATE PROCEDURE sp_GetProductDetailsByCronAndId (IN cronId varchar(50), IN productId varchar(50)) BEGIN DECLARE linkedCron varchar(50);

SET
  linkedCron = cronId;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *
from
  table_scrapeProductList
where
  LinkedCronId = linkedCron
  and MpId = productId
  and IsActive = true;

COMMIT;

END;

/ /
