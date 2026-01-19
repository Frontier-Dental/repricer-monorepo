use repricerDb;

DROP PROCEDURE IF EXISTS sp_GetFilterEligibleProductsByFilterDateV4;

delimiter / /
CREATE PROCEDURE sp_GetFilterEligibleProductsByFilterDateV4 (IN filterDate VARCHAR(50)) BEGIN
SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;

CREATE TEMPORARY TABLE IF NOT EXISTS tmp_tbl_filter_prod_list (
  Id Int NOT NULL AUTO_INCREMENT,
  MpId int not null,
  T_LUT Datetime,
  F_LUT Datetime,
  M_LUT Datetime,
  FIR_LUT Datetime,
  TOP_LUT Datetime,
  CAR_LUT Datetime,
  BIT_LUT Datetime,
  T_ACT boolean,
  F_ACT boolean,
  M_ACT boolean,
  FIR_ACT boolean,
  TOP_ACT boolean,
  CAR_ACT boolean,
  BIT_ACT boolean,
  primary key (Id)
);

Insert into
  tmp_tbl_filter_prod_list (
    MpId,
    T_LUT,
    F_LUT,
    M_LUT,
    FIR_LUT,
    TOP_LUT,
    CAR_LUT,
    BIT_LUT,
    T_ACT,
    F_ACT,
    M_ACT,
    FIR_ACT,
    TOP_ACT,
    CAR_ACT,
    BIT_ACT
  ) (
    Select
      scl.MpId,
      tl.LastUpdateTime as T_LUT,
      fl.LastUpdateTime as F_LUT,
      ml.LastUpdateTime as M_LUT,
      firl.LastUpdateTime as FIR_LUT,
      topl.LastUpdateTime as TOP_LUT,
      trd.LastUpdateTime as CAR_LUT,
      bsd.LastUpdateTime as BIT_LUT,
      tl.Activated as T_ACT,
      fl.Activated as F_ACT,
      ml.Activated as M_ACT,
      firl.Activated as FIR_ACT,
      topl.Activated as TOP_ACT,
      trd.Activated as CAR_ACT,
      bsd.Activated as BIT_ACT
    from
      table_scrapeProductList scl
      left join table_tradentDetails tl on scl.MpId = tl.MpId
      left join table_frontierDetails fl on scl.MpId = fl.MpId
      left join table_mvpDetails ml on scl.MpId = ml.MpId
      left join table_firstDentDetails firl on scl.MpId = firl.MpId
      left join table_topDentDetails topl on scl.MpId = topl.MpId
      left join table_triadDetails trd on scl.MpId = trd.MpId
      left join table_biteSupplyDetails bsd on scl.MpId = bsd.MpId
    where
      scl.RegularCronId is not null
    order by
      scl.MpId
  );

create Index tmp_idx_filter_mpid_tdx_lut on tmp_tbl_filter_prod_list (T_LUT);

create Index tmp_idx_filter_mpid_fdx_lut on tmp_tbl_filter_prod_list (F_LUT);

create Index tmp_idx_filter_mpid_mdx_lut on tmp_tbl_filter_prod_list (M_LUT);

create Index tmp_idx_filter_mpid_firdx_lut on tmp_tbl_filter_prod_list (FIR_LUT);

create Index tmp_idx_filter_mpid_topdx_lut on tmp_tbl_filter_prod_list (TOP_LUT);

create Index tmp_idx_filter_mpid_cardx_lut on tmp_tbl_filter_prod_list (CAR_LUT);

create Index tmp_idx_filter_mpid_bitdx_lut on tmp_tbl_filter_prod_list (BIT_LUT);

create Index tmp_idx_filter_mpid_tdx_act on tmp_tbl_filter_prod_list (T_ACT);

create Index tmp_idx_filter_mpid_fdx_act on tmp_tbl_filter_prod_list (F_ACT);

create Index tmp_idx_filter_mpid_mdx_act on tmp_tbl_filter_prod_list (M_ACT);

create Index tmp_idx_filter_mpid_firdx_act on tmp_tbl_filter_prod_list (FIR_ACT);

create Index tmp_idx_filter_mpid_topdx_act on tmp_tbl_filter_prod_list (TOP_ACT);

CREATE INDEX tmp_idx_filter_mpid_cardx_act on tmp_tbl_filter_prod_list (CAR_ACT);

create Index tmp_idx_filter_mpid_bitdx_act on tmp_tbl_filter_prod_list (BIT_ACT);

SELECT
  tmp_Fl.MpId,
  scl.RegularCronId,
  scl.RegularCronName,
  tmp_Fl.T_LUT,
  tmp_Fl.F_LUT,
  tmp_Fl.M_LUT,
  tmp_Fl.FIR_LUT,
  tmp_Fl.TOP_LUT,
  tmp_Fl.CAR_LUT,
  tmp_Fl.BIT_LUT
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
  )
  AND (
    (
      FIR_LUT IS NULL
      AND FIR_ACT IS NULL
    )
    OR (
      FIR_ACT = TRUE
      AND (
        FIR_LUT IS NULL
        OR FIR_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      FIR_ACT = FALSE
      AND (
        FIR_LUT IS NOT NULL
        AND FIR_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  )
  AND (
    (
      TOP_LUT IS NULL
      AND TOP_ACT IS NULL
    )
    OR (
      TOP_ACT = TRUE
      AND (
        TOP_LUT IS NULL
        OR TOP_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      TOP_ACT = FALSE
      AND (
        TOP_LUT IS NOT NULL
        AND TOP_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  )
  AND (
    (
      CAR_LUT IS NULL
      AND CAR_ACT IS NULL
    )
    OR (
      CAR_ACT = TRUE
      AND (
        CAR_LUT IS NULL
        OR CAR_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      CAR_ACT = FALSE
      AND (
        CAR_LUT IS NOT NULL
        AND CAR_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  )
  AND (
    (
      BIT_LUT IS NULL
      AND BIT_ACT IS NULL
    )
    OR (
      BIT_ACT = TRUE
      AND (
        BIT_LUT IS NULL
        OR BIT_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
    OR (
      BIT_ACT = FALSE
      AND (
        BIT_LUT IS NOT NULL
        AND BIT_LUT <= STR_TO_DATE(filterDate, '%Y-%m-%d %H:%i:%s')
      )
    )
  );

DROP TEMPORARY TABLE IF EXISTS tmp_tbl_filter_prod_list;

COMMIT;

END;

/ /
