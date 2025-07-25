export class SearchRequest {
  page: any;
  searchParam: any;
  resultsPerPage: any;
  isUgrIdRequired: any;
  isBuyGetPage: any;
  filters: any[];
  sorting: any[];
  constructor(_page: any, _category: any) {
    this.page = _page;
    this.searchParam = "";
    this.resultsPerPage = 60;
    this.isUgrIdRequired = false;
    this.isBuyGetPage = false;
    this.filters = [];
    this.filters.push(new Filter("availability", "in stock"));
    this.filters.push(new Filter("category", _category));
    this.sorting = [];
    this.sorting.push({ field: "priority", direction: "desc" });
  }
}
class Filter {
  field: any;
  value: any;

  constructor(_field: any, _value: any) {
    this.field = _field;
    this.value = _value;
  }
}
