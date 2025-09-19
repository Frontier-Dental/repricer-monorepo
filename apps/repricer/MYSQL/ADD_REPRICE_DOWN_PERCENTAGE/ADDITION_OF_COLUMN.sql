use repricerDb;

alter table table_tradentDetails
add column PercentageDown decimal(5, 3);

alter table table_mvpDetails
add column PercentageDown decimal(5, 3);

alter table table_frontierDetails
add column PercentageDown decimal(5, 3);

alter table table_topDentDetails
add column PercentageDown decimal(5, 3);

alter table table_firstDentDetails
add column PercentageDown decimal(5, 3);

update table_tradentDetails
set
  PercentageDown = 0;

update table_mvpDetails
set
  PercentageDown = 0;

update table_frontierDetails
set
  PercentageDown = 0;

update table_topDentDetails
set
  PercentageDown = 0;

update table_firstDentDetails
set
  PercentageDown = 0;
