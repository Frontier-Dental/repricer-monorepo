USE repricerDb;

alter table table_tradentDetails
add column HandlingTimeFilter varchar(50);

alter table table_mvpDetails
add column HandlingTimeFilter varchar(50);

alter table table_frontierDetails
add column HandlingTimeFilter varchar(50);

alter table table_topDentDetails
add column HandlingTimeFilter varchar(50);

alter table table_firstDentDetails
add column HandlingTimeFilter varchar(50);
