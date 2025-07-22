use repricerDb;

DELIMITER / /
DROP PROCEDURE IF EXISTS sp_GetRepricerHistoryForDateRange;

CREATE PROCEDURE "sp_GetRepricerHistoryForDateRange" (IN startDate VARCHAR(50), IN endDate VARCHAR(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

SELECT
  his.*,
  DATE_FORMAT(his.RefTime, '%Y-%m-%d %H:%i:%s') AS RefTime_Str,
  api.ApiResponse
FROM
  table_history his
  JOIN table_history_apiResponse api ON his.LinkedApiResponse = api.ApiResponseId
WHERE
  his.RefTime >= STR_TO_DATE(startDate, '%Y-%m-%d %H:%i:%s')
  AND his.RefTime <= STR_TO_DATE(endDate, '%Y-%m-%d %H:%i:%s')
ORDER BY
  his.MpId,
  his.RefTime;

COMMIT;

END;

/ /
