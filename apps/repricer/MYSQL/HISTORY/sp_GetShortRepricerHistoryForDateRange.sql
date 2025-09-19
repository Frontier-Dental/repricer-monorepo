use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetShortRepricerHistoryForDateRange;

delimiter / /
CREATE PROCEDURE sp_GetShortRepricerHistoryForDateRange (IN startDate VARCHAR(50), IN endDate VARCHAR(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT
  his.*,
  DATE_FORMAT(his.RefTime, '%Y-%m-%d %H:%i:%s') AS RefTime_Str
FROM
  table_history his
WHERE
  his.RefTime >= STR_TO_DATE(startDate, '%Y-%m-%d %H:%i:%s')
  AND his.RefTime <= STR_TO_DATE(endDate, '%Y-%m-%d %H:%i:%s')
ORDER BY
  his.MpId,
  his.RefTime;

COMMIT;

END;

/ /
