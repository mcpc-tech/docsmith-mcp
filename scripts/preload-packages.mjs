#!/usr/bin/env node
/**
 * Preload Python packages during installation
 * This script runs runPy to install packages into Pyodide's cache
 *
 * Note: Requires Node.js with --experimental-wasm-stack-switching flag
 */
import { runPy } from "@mcpc-tech/code-runner-mcp";

const PACKAGES = [
  "openpyxl",
  "python-docx",
  "PyPDF2",
];

async function preloadPackages() {
  console.log("📦 Preloading Python packages for Pyodide...\n");

  // Use async wrapper to allow await
  const code = `
import micropip
import asyncio

async def main():
    packages = ${JSON.stringify(PACKAGES)}
    
    print(f"Installing {len(packages)} packages...")
    for pkg in packages:
        print(f"  - {pkg}")
    
    await micropip.install(packages)
    print("\\n✅ All packages installed successfully!")

asyncio.run(main())
`;

  try {
    const stream = await runPy(code, {
      packages: {
        openpyxl: "openpyxl",
        "python-docx": "python-docx",
        PyPDF2: "PyPDF2",
      },
    });

    const reader = stream.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      process.stdout.write(text);
    }

    console.log("\n✨ Preload complete!");
  } catch (error) {
    console.error("\n❌ Preload failed:", error.message);
    // Don't fail the install, just warn
    console.log("⚠️  Packages will be downloaded on first use");
  }
}

preloadPackages();
