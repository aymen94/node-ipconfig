import { execFile } from "node:child_process";

export class IpconfigError extends Error {
  constructor(
    message,
    {
      code = "EIPCONFIG",
      cause,
      command,
      stdout = "",
      stderr = "",
      exitCode,
    } = {},
  ) {
    super(message, { cause });
    this.name = "IpconfigError";
    this.code = code;
    if (command) this.command = command;
    this.stdout = stdout;
    this.stderr = stderr;
    if (exitCode !== undefined) this.exitCode = exitCode;
  }
}

export function createRunner({
  platform = process.platform,
  exec = execFile,
} = {}) {
  return function run(args = [], options = {}) {
    if (platform !== "win32")
      return Promise.reject(
        new IpconfigError("node-ipconfig is supported only on Windows.", {
          code: "ENOTSUP",
        }),
      );
    return new Promise((resolve, reject) => {
      const command = ["ipconfig.exe", ...args];
      const finish = (error, stdout = "", stderr = "") => {
        const output =
          typeof stdout === "string"
            ? stdout
            : stdout?.toString(options.encoding ?? "utf8");
        const errorOutput =
          typeof stderr === "string"
            ? stderr
            : stderr?.toString(options.encoding ?? "utf8");
        const exitCode = Number.isInteger(error?.code)
          ? error.code
          : error
            ? null
            : 0;
        // Some ipconfig commands emit useful localized diagnostics and a non-zero exit status.
        if (
          error &&
          !output?.trim() &&
          !(options.rawResult && Number.isInteger(error.code))
        ) {
          const code =
            error.code === "EACCES" || error.code === "EPERM"
              ? "EACCES"
              : error.code === "ENOENT"
                ? "ENOENT"
                : error.code === "ETIMEDOUT" ||
                    (error.killed && options.timeout)
                  ? "ETIMEDOUT"
                  : error.name === "AbortError"
                    ? "ABORT_ERR"
                    : (error.code ?? "EIPCONFIG");
          const message =
            code === "EACCES"
              ? "Permission denied while running ipconfig; retry from an appropriately authorized terminal."
              : code === "ENOENT"
                ? "ipconfig.exe could not be found on PATH."
                : code === "ETIMEDOUT"
                  ? "ipconfig timed out; increase timeout or retry."
                  : code === "ABORT_ERR"
                    ? "ipconfig was aborted."
                    : `ipconfig failed${error.message ? `: ${error.message}` : ""}`;
          reject(
            new IpconfigError(message, {
              code,
              cause: error,
              command,
              stdout: output ?? "",
              stderr: errorOutput ?? "",
              exitCode: exitCode ?? undefined,
            }),
          );
          return;
        }
        if (options.rawResult)
          resolve({
            stdout: output ?? "",
            stderr: errorOutput ?? "",
            exitCode: exitCode ?? 0,
          });
        else resolve((output ?? "") || (errorOutput ?? ""));
      };
      try {
        exec(
          "ipconfig.exe",
          args,
          {
            windowsHide: true,
            encoding: options.encoding ?? "utf8",
            timeout: options.timeout ?? 15000,
            maxBuffer: 4 * 1024 * 1024,
            ...(options.signal ? { signal: options.signal } : {}),
          },
          finish,
        );
      } catch (error) {
        finish(error);
      }
    });
  };
}
