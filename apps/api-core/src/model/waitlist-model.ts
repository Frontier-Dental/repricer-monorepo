export class WaitlistModel {
  mp_id: number;
  vendor_name: string;
  old_inventory: number;
  new_inventory: number;
  net32_inventory: number;
  api_status?: string;
  message?: string;
  created_at?: Date;
  updated_at?: Date;
  id?: number;

  constructor(
    mp_id: number,
    vendor_name: string,
    old_inventory: number,
    new_inventory: number,
    net32_inventory: number,
    api_status?: string,
    message?: string,
    created_at?: Date,
    updated_at?: Date,
    id?: number,
  ) {
    this.mp_id = mp_id;
    this.vendor_name = vendor_name;
    this.old_inventory = old_inventory;
    this.new_inventory = new_inventory;
    this.net32_inventory = net32_inventory;
    this.api_status = api_status;
    this.message = message;
    this.created_at = created_at;
    this.updated_at = updated_at;
    this.id = id;
  }
}
