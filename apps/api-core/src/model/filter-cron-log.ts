class FilterCronItem {
  productId: string | number;
  sourceCronId: string;
  sourceCronName: string;
  destCronId: string;
  destCronName: string;
  lastUpdateTime: string;

  constructor(
    _mpid: string | number,
    _sourceCronId: string,
    _sourceCronName: string,
    _destCronId: string,
    _destCronName: string,
    _lastUpdateStr: string,
  ) {
    this.productId = _mpid;
    this.sourceCronId = _sourceCronId;
    this.sourceCronName = _sourceCronName;
    this.destCronId = _destCronId;
    this.destCronName = _destCronName;
    this.lastUpdateTime = _lastUpdateStr;
  }
}

class FilterCronLog {
  cronKey: string;
  contextCronId: string;
  cronItem: FilterCronItem[];
  filterDate: string;
  countOfProducts: number;
  startTime: Date;
  endTime: Date;

  constructor(
    _cronKey: string,
    _contextCronId: string,
    _filterDate: string,
    _cronItems: FilterCronItem[],
  ) {
    this.cronKey = _cronKey;
    this.contextCronId = _contextCronId;
    this.cronItem = _cronItems;
    this.filterDate = _filterDate;
    this.countOfProducts = _cronItems.length;
    this.startTime = new Date();
    this.endTime = new Date();
  }

  push(item: FilterCronItem): void {
    this.cronItem.push(item);
    this.countOfProducts = this.cronItem.length;
  }

  finish(): void {
    this.endTime = new Date();
  }
}

export { FilterCronItem, FilterCronLog };
