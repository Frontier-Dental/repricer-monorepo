use repricerDb;

alter table table_tradentDetails
add column RepriceResult varchar(128);

alter table table_mvpDetails
add column RepriceResult varchar(128);

alter table table_frontierDetails
add column RepriceResult varchar(128);

alter table table_topDentDetails
add column RepriceResult varchar(128);

alter table table_firstDentDetails
add column RepriceResult varchar(128);

alter table table_triadDetails
add column RepriceResult varchar(128);
