// The abstraction boundary between the app and any code execution provider.
// Swap Piston for Docker sandbox by implementing this interface and updating executor.factory.ts.

export type ExecuteInput = {
  language: string;
  version?: string;
  code: string;
  stdin?: string;
  timeoutSeconds?: number;
  memoryLimitMb?: number;
};

export type ExecuteOutput = {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  memoryUsedKb: number;
  timedOut: boolean;
};

export interface ICodeExecutor {
  execute(input: ExecuteInput): Promise<ExecuteOutput>;
  getSupportedLanguages(): Promise<string[]>;
}
