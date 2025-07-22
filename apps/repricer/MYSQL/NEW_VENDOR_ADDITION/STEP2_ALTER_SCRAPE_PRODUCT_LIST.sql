use repricerDb;

alter table table_scrapeProductList
add column LinkedTopDentDetailsInfo int;

alter table table_scrapeProductList
add column LinkedFirstDentDetailsInfo int;

select
  *
from
  table_scrapeProductList;
