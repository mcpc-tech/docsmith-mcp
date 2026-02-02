/**
 * Code runner client - uses @mcpc/code-runner-mcp npm package
 */
import { runPy, type RunPyOptions } from "@mcpc/code-runner-mcp";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Options for running Python script files
 */
export interface RunPythonFileOptions {
  /** Command line arguments to pass to the script */
  args?: string[];
  /** Package name mappings (import_name -> pypi_name) */
  packages?: Record<string, string>;
  /** Base directory for the script (default: "python") */
  baseDir?: string;
  /** User file paths that need to be accessible (for file system mounting) */
  filePaths?: string[];
}

/**
 * Check if pre-downloaded wheels exist and get their paths
 */
function getLocalWheels(): Record<string, string> {
  const wheelsDir = join(__dirname, "..", "python_packages");
  const manifestPath = join(wheelsDir, "manifest.json");
  
  if (!existsSync(manifestPath)) {
    return {};
  }
  
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const wheels: Record<string, string> = {};
    
    for (const [packageName, fileName] of Object.entries(manifest)) {
      const wheelPath = join(wheelsDir, fileName as string);
      if (existsSync(wheelPath)) {
        wheels[packageName] = wheelPath;
      }
    }
    
    return wheels;
  } catch {
    return {};
  }
}

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
 * @param options - Execution options
 * @returns The execution result
 */
export async function runPythonFile(
  scriptPath: string,
  options: RunPythonFileOptions = {}
): Promise<any> {
  const {
    args = [],
    packages = {},
    baseDir = "python",
    filePaths = []
  } = options;

  // Read the Python script
  const fullPath = join(__dirname, "..", baseDir, scriptPath);
  const scriptContent = readFileSync(fullPath, "utf-8");

  // Check for local wheels
  const localWheels = getLocalWheels();
  const hasLocalWheels = Object.keys(localWheels).length > 0;

  // Build wrapper code that installs local wheels first, then executes the script
  const wheelInstallCode = hasLocalWheels ? `
# Install pre-downloaded wheels if available
import micropip
import asyncio

local_wheels = ${JSON.stringify(localWheels)}
packages_to_install = []

for pkg_name, wheel_path in local_wheels.items():
    try:
        await micropip.install(wheel_path)
        print(f"[py] Installed {pkg_name} from local wheel")
    except Exception as e:
        print(f"[py] Failed to install {pkg_name} from local wheel: {e}")
        packages_to_install.append(pkg_name)

# Install remaining packages from PyPI if needed
if packages_to_install:
    await micropip.install(packages_to_install)
` : '';

  const wrapperCode = `
import sys
import json

${wheelInstallCode}

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
  const runPyOptions: RunPyOptions = { 
    packages, 
    nodeFSMountPoint: mountRoot,
    nodeFSRoot: mountRoot 
  };
  const stream = await runPy(wrapperCode, runPyOptions);

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
