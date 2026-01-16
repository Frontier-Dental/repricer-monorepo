export class CronStatusModel {
  cronTime: string;
  productsCount: number;
  maximumProductCount: number;
  status: string;
  cronId: string;
  keyGenId: string;

  constructor(cronTime: string, productsCount: number, maxProdCount: number, status: string, cronId: string, keyGen: string) {
    this.cronTime = cronTime;
    this.productsCount = productsCount;
    this.maximumProductCount = maxProdCount;
    this.status = status;
    this.cronId = cronId;
    this.keyGenId = keyGen;
  }

  SetProductCount(_count: number): void {
    this.productsCount = _count;
  }

  SetStatus(_status: string): void {
    this.status = _status;
  }
}

export default CronStatusModel;
