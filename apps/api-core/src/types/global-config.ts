export interface PrioritySettings {
  tradent_priority: string;
  frontier_priority: string;
  mvp_priority: string;
  firstDent_priority: string;
  topDent_priority: string;
  triad_priority: string;
  biteSupply_priority: string;
}

export interface OverrideExecutionPriorityDetails {
  override_priority: string;
  priority_settings: PrioritySettings;
}

export interface AuditInfo {
  UpdatedBy?: string;
  UpdatedOn?: string;
}

export interface GlobalConfig {
  _id?: object;
  delay?: string;
  source: string;
  override_all?: string;
  override_execution_priority_details?: OverrideExecutionPriorityDetails;
  AuditInfo?: AuditInfo;
  FrontierApiKey?: string;
  DevIntegrationKey?: string;
  expressCronBatchSize?: string;
  expressCronOverlapThreshold?: string;
  expressCronInstanceLimit?: string;
}
