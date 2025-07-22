SELECT
  *
FROM
  repricerDb.table_runInfo;

delete from repricerDb.table_runInfo
where
  Id in (1, 2, 3);

ALTER TABLE repricerDb.table_runInfo AUTO_INCREMENT = 1;

SELECT
  *
FROM
  repricerDb.table_runInfo;

SELECT
  *
FROM
  repricerDb.table_productInfo;

SELECT
  *
FROM
  repricerDb.table_priceBreaks;

delete from repricerDb.table_priceBreaks;

delete from repricerDb.table_productInfo;

delete from repricerDb.table_runInfo;

ALTER TABLE repricerDb.table_runInfo AUTO_INCREMENT = 1;

ALTER TABLE repricerDb.table_productInfo AUTO_INCREMENT = 1;

ALTER TABLE repricerDb.table_priceBreaks AUTO_INCREMENT = 1;

drop table repricerDb.table_priceBreaks;

drop table repricerDb.table_productInfo;

drop table repricerDb.table_runInfo;

delete from repricerDb.table_runInfo
where
  Id = 6;

update repricerDb.table_runInfo
set
  ScrapedSuccessCount = 2000,
  ScrapedFailureCount = 0
where
  Id = 2
