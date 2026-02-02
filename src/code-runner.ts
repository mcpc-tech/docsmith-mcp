/**
 * Code runner client - uses @mcpc/code-runner-mcp npm package
 */
import { runPy, type RunPyOptions } from "@mcpc/code-runner-mcp";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve, sep } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Convert absolute file path to Pyodide virtual path
 * Determines the mount root and converts the path accordingly
 * 
 * @param filePath - Absolute path to the file
 * @returns Object with mountRoot (host path) and virtualPath (Pyodide path)
 */
function getFileSystemMapping(filePath: string): { mountRoot: string; virtualPath: string } {
  const absolutePath = resolve(filePath);
  
  // Mount the parent directory of the file
  // This allows Python to access the file and its siblings
  const mountRoot = dirname(absolutePath);
  const virtualPath = absolutePath;
  
  return { mountRoot, virtualPath };
}

/**
 * Run a Python script file using code-runner-mcp
 *
 * @param scriptPath - Path to the Python script (relative to baseDir)
 * @param args - Command line arguments to pass to the script
 * @param packages - Package name mappings (import_name -> pypi_name)
 * @param baseDir - Base directory for the script (default: "python")
 * @param filePaths - User file paths that need to be accessible (for mounting)
 * @returns The execution result
 */
export async function runPythonFile(
  scriptPath: string,
  args: string[] = [],
  packages: Record<string, string> = {},
  baseDir: string = "python",
  filePaths: string[] = []
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

  // Determine mount root from the first file path
  let mountRoot = join(__dirname, "..");  // Default: project root
  if (filePaths.length > 0) {
    const mapping = getFileSystemMapping(filePaths[0]);
    mountRoot = mapping.mountRoot;
  }

  // Execute via runPy with options
  // Mount point is the same as the mount root (Pyodide will see host paths directly)
  const options: RunPyOptions = { 
    packages, 
    nodeFSMountPoint: mountRoot,
    nodeFSRoot: mountRoot 
  };
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
