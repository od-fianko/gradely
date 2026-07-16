import type { ICodeExecutor } from "./executor.interface";
import { PistonExecutor } from "./piston.executor";

// To swap execution provider: set EXECUTOR_PROVIDER=docker and
// add a DockerExecutor class that implements ICodeExecutor.
export function getExecutor(): ICodeExecutor {
  const provider = process.env.EXECUTOR_PROVIDER ?? "piston";

  switch (provider) {
    case "piston":
      return new PistonExecutor();
    default:
      throw new Error(`Unknown executor provider: ${provider}`);
  }
}
