use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetLatestRunInfoForCronByLimit;

delimiter / /
CREATE PROCEDURE sp_GetLatestRunInfoForCronByLimit (
  IN numberOfRecords int,
  IN startTime varchar(25),
  IN endTime varchar(25),
  IN linkedCron varchar(50)
) BEGIN DECLARE recordCount INT;

DECLARE start_time varchar(25);

DECLARE end_time varchar(25);

DECLARE linked_cron varchar(50);

SET
  recordCount = numberOfRecords;

SET
  start_time = startTime;

SET
  end_time = endTime;

SET
  linked_cron = linkedCron;

SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

select
  *
from
  repricerDb.table_runInfo
where
  RunEndTime is not null
  and STR_TO_DATE(RunStartTime, '%d-%m-%Y') >= Date(start_time)
  and STR_TO_DATE(RunEndTime, '%d-%m-%Y') <= Date(end_time)
  and CronId = linked_cron
order by
  Id desc
limit
  recordCount;

COMMIT;

END;

/ /
