use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetLatestRunInfoByLimit;

delimiter / /
CREATE PROCEDURE sp_GetLatestRunInfoByLimit (
  IN numberOfRecords int,
  IN startTime varchar(25),
  IN endTime varchar(25)
) BEGIN DECLARE recordCount INT;

DECLARE start_time varchar(25);

DECLARE end_time varchar(25);

SET
  recordCount = numberOfRecords;

SET
  start_time = startTime;

SET
  end_time = endTime;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *
from
  repricerDb.table_runInfo
where
  RunEndTime is not null
  and STR_TO_DATE(RunStartTime, '%d-%m-%Y') >= Date(start_time)
  and STR_TO_DATE(RunEndTime, '%d-%m-%Y') <= Date(end_time)
order by
  Id desc
limit
  recordCount;

COMMIT;

END;

/ /
