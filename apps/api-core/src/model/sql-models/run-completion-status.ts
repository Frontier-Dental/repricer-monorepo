export class RunCompletionStatus {
  KeyGenId: any;
  RunType: any;
  IsCompleted: any;

  constructor(keyGen: any, runType: any, isCompleted: any) {
    this.KeyGenId = keyGen;
    this.RunType = runType;
    this.IsCompleted = isCompleted;
  }
}
