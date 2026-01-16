use repricerDb;

alter table table_scrapeProductList
add column LinkedBiteSupplyDetailsInfo int;

select
  *
from
  table_scrapeProductList;
