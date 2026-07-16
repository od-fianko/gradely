import type { ICodeExecutor, ExecuteInput, ExecuteOutput } from "./executor.interface";
import axios from "axios";

// Maps our language names to Piston's language identifiers
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  PYTHON: { language: "python", version: "3.10.0" },
};

export class PistonExecutor implements ICodeExecutor {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston";
  }

  async execute(input: ExecuteInput): Promise<ExecuteOutput> {
    const lang = LANGUAGE_MAP[input.language.toUpperCase()];
    if (!lang) throw new Error(`Unsupported language: ${input.language}`);

    const response = await axios.post(
      `${this.baseUrl}/execute`,
      {
        language: lang.language,
        version: input.version ?? lang.version,
        files: [{ name: "main.py", content: input.code }],
        stdin: input.stdin ?? "",
        run_timeout: (input.timeoutSeconds ?? 5) * 1000,
        compile_memory_limit: -1,
        run_memory_limit: (input.memoryLimitMb ?? 128) * 1024 * 1024,
      },
      { timeout: 15000 }
    );

    const { run } = response.data;

    return {
      stdout: run.stdout ?? "",
      stderr: run.stderr ?? "",
      exitCode: run.code ?? 0,
      executionTimeMs: run.time ?? 0,
      memoryUsedKb: (run.memory ?? 0) / 1024,
      timedOut: run.signal === "SIGKILL",
    };
  }

  async getSupportedLanguages(): Promise<string[]> {
    const response = await axios.get(`${this.baseUrl}/runtimes`);
    return response.data.map((r: { language: string }) => r.language);
  }
}
