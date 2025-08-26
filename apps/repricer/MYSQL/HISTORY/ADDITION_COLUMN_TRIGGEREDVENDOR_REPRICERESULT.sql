use repricerDb;

alter table table_history
add column TriggeredByVendor varchar(500);

alter table table_history
add column RepriceResult varchar(128);
