use repricerDb;

UPDATE table_scrapeProductList scpl
JOIN table_topDentDetails top ON scpl.MpId = top.MpId
SET
  scpl.LinkedTopDentDetailsInfo = top.Id;

UPDATE table_scrapeProductList scpl
JOIN table_firstDentDetails fir ON scpl.MpId = fir.MpId
SET
  scpl.LinkedFirstDentDetailsInfo = fir.Id;
