USE repricerDb;

alter table table_tradentDetails
add column TriggeredByVendor varchar(500);

alter table table_mvpDetails
add column TriggeredByVendor varchar(500);

alter table table_frontierDetails
add column TriggeredByVendor varchar(500);

alter table table_topDentDetails
add column TriggeredByVendor varchar(500);

alter table table_firstDentDetails
add column TriggeredByVendor varchar(500);
