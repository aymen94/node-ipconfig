# AGENTS.md — node-ipconfig

## Project

`node-ipconfig` is a lightweight Node.js npm package that wraps the native Windows `ipconfig` command and exposes network configuration through a clean JavaScript API.

## Instructions

- Inspect the existing code before making changes.
- Implement features directly; do not return plans instead of code.
- Preserve existing functionality and public APIs.
- Keep changes minimal, modular, and maintainable.
- Use modern JavaScript and minimize dependencies.
- Support CommonJS, ESM, and TypeScript declarations where practical.
- Never overwrite unrelated user changes.

## Features

Implement and maintain:

- Parsed and raw network configuration.
- Network adapter discovery and filtering.
- IPv4, IPv6, MAC addresses, gateways, and DNS servers.
- DHCP release and renewal.
- DNS cache display, flush, and registration.
- Safe command execution and structured error handling.
- Comprehensive documentation and runnable examples.

## Keeping the API aligned with Windows

- Treat Microsoft's current `ipconfig` command reference as the source of truth for native command names, switches, arguments, behavior, and supported Windows versions: https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig
- When adding or changing a public function, first check the official reference for newly documented switches and argument rules. Record the date/version checked in the pull request when the change depends on a newly documented option.
- Map native commands to a small, explicit JavaScript API. Keep command names and argument arrays in the allowlist; never expose arbitrary executable arguments or shell strings.
- Make each new function opt-in. Configuration discovery must remain read-only and must never trigger release, renew, flush, register, or other state-changing actions.
- Before adding a native operation, classify and document it as read-only or state-changing, describe connectivity/permission effects, and validate every user-provided argument. Preserve adapter names containing spaces as single process arguments. Only support wildcards or special values when Microsoft's reference documents them and the API validates them deliberately.
- Add mocked tests proving the exact executable arguments, success/error behavior, option validation, and that discovery does not invoke the operation. Tests must run on non-Windows platforms.
- Update ESM and CommonJS entry points, TypeScript declarations, README API/command tables and examples, and package exports when relevant. Keep JSON as the default parsed configuration response; document and test any new serialization format separately.
- If an option's effect or behavior is unclear, do not infer it from its name. Check the official documentation and capture observed output in a fixture where parsing is involved.
- Review the official reference when maintaining the package and whenever Windows behavior is reported to have changed. Do not automatically mirror every switch: add only commands that fit the package API and can be exposed safely and tested.

## Security

- Use `execFile` or `spawn`; never interpolate user input into shell commands.
- Validate commands and arguments against an allowlist.
- Never execute state-changing commands automatically.
- Clearly document operations that may disrupt connectivity or require administrator privileges.
- Do not collect telemetry or transmit network configuration.

## Architecture

- Separate command execution, parsing, public API, and errors.
- Keep parsing independent of Windows so it can be tested with fixtures.
- Handle missing fields, multiple adapters, IPv6, Unicode, and localized output where supported.
- Reject unsupported platforms with clear errors.
- Maintain consistent return types and documented behavior.

## Testing

- Add tests for every feature and bug fix.
- Mock native command execution in unit tests.
- Cover malformed output, missing fields, command failures, invalid arguments, and security edge cases.
- Run existing tests, linting, type checks, and builds where configured.
- Never claim tests passed unless they actually ran.

## Documentation and releases

- Keep `README.md`, API documentation, examples, and TypeScript declarations synchronized with the implementation.
- Verify `package.json`, exports, dependencies, license, and npm package contents.
- Preserve backward compatibility unless explicitly requested.
- Never publish or release without authorization.
- When a Git remote and repository workflow are available, prepare a focused pull request for review after implementation and local verification. Include the Microsoft reference link, behavior/side-effect classification, test results, and user-visible API/documentation changes. Do not create a pull request if the workspace has no Git repository or authenticated remote; report that limitation instead.

## Definition of Done

Implement the requested changes, test them, review the diff, and report:

1. Changes made.
2. Files modified.
3. Actual test results.
4. Remaining limitations or breaking changes.

**Principle:** Inspect first, implement directly, test thoroughly, keep it simple, and report honestly.
