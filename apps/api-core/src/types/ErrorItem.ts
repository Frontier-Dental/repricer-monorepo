export interface ErrorItem {
  _id?: object;
  mpId: number;
  nextCronTime?: string;
  active?: boolean;
  contextCronId?: string;
  createdOn?: string;
  updatedOn?: string;
  insertReason?: string;
  vendorName: string;
}
