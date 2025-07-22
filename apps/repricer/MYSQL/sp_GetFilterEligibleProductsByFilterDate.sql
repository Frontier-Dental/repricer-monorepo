use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFilterEligibleProductsByFilterDate;

delimiter / /
CREATE PROCEDURE sp_GetFilterEligibleProductsByFilterDate (IN filterDate VARCHAR(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

CREATE TEMPORARY TABLE IF NOT EXISTS tmp_tbl_filter_prod_list (
  Id Int NOT NULL AUTO_INCREMENT,
  MpId int not null,
  T_LUT Datetime,
  F_LUT Datetime,
  M_LUT Datetime,
  T_ACT boolean,
  F_ACT boolean,
  M_ACT boolean,
  primary key (Id)
);

Insert into
  tmp_tbl_filter_prod_list (MpId, T_LUT, F_LUT, M_LUT, T_ACT, F_ACT, M_ACT) (
    Select
      scl.MpId,
      tl.LastUpdateTime as T_LUT,
      fl.LastUpdateTime as F_LUT,
      ml.LastUpdateTime as M_LUT,
      tl.Activated as T_ACT,
      fl.Activated as F_ACT,
      ml.Activated as M_ACT
    from
      table_scrapeProductList scl
      left join table_tradentDetails tl on scl.MpId = tl.MpId
      left join table_frontierDetails fl on scl.MpId = fl.MpId
      left join table_mvpDetails ml on scl.MpId = ml.MpId
    where
      scl.RegularCronId is not null
    order by
      scl.MpId
  );

create Index tmp_idx_filter_mpid_tdx_lut on tmp_tbl_filter_prod_list (T_LUT);

create Index tmp_idx_filter_mpid_fdx_lut on tmp_tbl_filter_prod_list (F_LUT);

create Index tmp_idx_filter_mpid_mdx_lut on tmp_tbl_filter_prod_list (M_LUT);

create Index tmp_idx_filter_mpid_tdx_act on tmp_tbl_filter_prod_list (T_ACT);

create Index tmp_idx_filter_mpid_fdx_act on tmp_tbl_filter_prod_list (F_ACT);

create Index tmp_idx_filter_mpid_mdx_act on tmp_tbl_filter_prod_list (M_ACT);

SELECT
  tmp_Fl.MpId,
  scl.RegularCronId,
  scl.RegularCronName,
  tmp_Fl.T_LUT,
  tmp_Fl.F_LUT,
  tmp_Fl.M_LUT
FROM
  tmp_tbl_filter_prod_list tmp_Fl
  LEFT JOIN table_scrapeProductList scl ON tmp_Fl.MpId = scl.MpId
WHERE
  (
    (
      T_LUT IS NULL
      AND T_ACT IS NULL
    )
    OR (
      T_ACT = TRUE
      AND (
        T_LUT IS NULL
        OR T_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      T_ACT = FALSE
      AND (
        T_LUT IS NOT NULL
        AND T_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  )
  AND (
    (
      F_LUT IS NULL
      AND F_ACT IS NULL
    )
    OR (
      F_ACT = TRUE
      AND (
        F_LUT IS NULL
        OR F_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      F_ACT = FALSE
      AND (
        F_LUT IS NOT NULL
        AND F_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  )
  AND (
    (
      M_LUT IS NULL
      AND M_ACT IS NULL
    )
    OR (
      M_ACT = TRUE
      AND (
        M_LUT IS NULL
        OR M_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      M_ACT = FALSE
      AND (
        M_LUT IS NOT NULL
        AND M_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  );

DROP TEMPORARY TABLE IF EXISTS tmp_tbl_filter_prod_list;

COMMIT;

END;

/ /
