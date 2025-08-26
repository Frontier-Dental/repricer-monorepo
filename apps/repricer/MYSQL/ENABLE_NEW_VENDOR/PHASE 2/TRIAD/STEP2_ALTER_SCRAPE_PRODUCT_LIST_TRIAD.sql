use repricerDb;

alter table table_scrapeProductList
add column LinkedTriadDetailsInfo int;

select
  *
from
  table_scrapeProductList;
