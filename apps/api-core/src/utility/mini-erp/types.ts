export interface MiniErpLoginResponse {
  access_token: string;
}

export interface MiniErpProduct {
  mpid: string;
  vendorName: string;
  quantityAvailable?: number;
}

export interface MiniErpPaginationMeta {
  page: number;
  pageSize: number;
  hasMore?: boolean;
}

export interface MiniErpNormalizedResponse {
  items: MiniErpProduct[];
  meta: MiniErpPaginationMeta;
}

export interface PaginationDecision {
  hasNextPage: boolean;
  nextPage: number;
}
