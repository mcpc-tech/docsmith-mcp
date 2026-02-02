/**
 * Code runner client - uses @mcpc/code-runner-mcp npm package
 */
import { runPy, type RunPyOptions } from "@mcpc/code-runner-mcp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run a Python script file using code-runner-mcp
 *
 * @param scriptPath - Path to the Python script (relative to baseDir)
 * @param args - Command line arguments to pass to the script
 * @param packages - Package name mappings (import_name -> pypi_name)
 * @param baseDir - Base directory for the script (default: "python")
 * @returns The execution result
 */
export async function runPythonFile(
  scriptPath: string,
  args: string[] = [],
  packages: Record<string, string> = {},
  baseDir: string = "python"
): Promise<any> {
  // Read the Python script
  const fullPath = join(__dirname, "..", baseDir, scriptPath);
  const scriptContent = readFileSync(fullPath, "utf-8");

  // Build wrapper code that sets sys.argv and executes the script
  const wrapperCode = `
import sys
import json

# Set command line arguments
sys.argv = ['${scriptPath}'] + ${JSON.stringify(args)}

# Execute the script
${scriptContent}
`;

  // Execute via runPy with options
  // Mount project root directory (parent of src/) to /data
  const projectRoot = join(__dirname, "..");
  const options: RunPyOptions = { packages, nodeFSMountPoint: "/data", nodeFSRoot: projectRoot };
  const stream = await runPy(wrapperCode, options);

  // Read the stream output
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let stdout = "";
  let stderr = "";
  let error = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      if (chunk.startsWith("[stderr] ")) {
        stderr += chunk.slice(9);
      } else if (chunk.startsWith("[err]")) {
        error += chunk;
      } else {
        stdout += chunk;
      }
    }
  } catch (streamError) {
    // Stream error means Python execution failed
    return { error: String(streamError) };
  }

  // Check for errors
  if (error) {
    return { error: error.replace(/\[err\]\[py\]\s*/g, "").trim() };
  }

  // Parse the JSON output from the script (last line)
  const lines = stdout.trim().split("\n");
  const lastLine = lines[lines.length - 1];

  try {
    return JSON.parse(lastLine);
  } catch {
    return { stdout, stderr };
  }
}
