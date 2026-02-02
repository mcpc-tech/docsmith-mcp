#!/usr/bin/env node
/**
 * Download Python wheel files for Pyodide
 * Run this script to pre-download packages for offline use
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const WHEELS_DIR = join(__dirname, "..", "python_packages");

// Packages to download (Pyodide-compatible pure Python wheels)
const PACKAGES = [
  "openpyxl",
  "python-docx",
  "PyPDF2",
  "et_xmlfile",  // openpyxl dependency
  "lxml",        // python-docx dependency (may need special handling)
];

// PyPI simple API URL
const PYPI_URL = "https://pypi.org/simple";

async function fetchWheelUrl(packageName) {
  try {
    // Use PyPI JSON API instead of simple API
    const response = await fetch(`https://pypi.org/pypi/${packageName}/json`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${packageName}: ${response.status}`);
    }
    
    const data = await response.json();
    const urls = data.urls || [];
    
    // Find py3-none-any wheel (pure Python, platform independent)
    const wheel = urls.find(u => 
      u.packagetype === "bdist_wheel" && 
      u.filename.includes("py3-none-any")
    );
    
    if (!wheel) {
      console.warn(`⚠️ No pure Python wheel found for ${packageName}`);
      return null;
    }
    
    return wheel.url;
  } catch (error) {
    console.error(`❌ Error fetching ${packageName}:`, error.message);
    return null;
  }
}

async function downloadWheel(packageName, wheelUrl) {
  const fileName = wheelUrl.split("/").pop();
  const outputPath = join(WHEELS_DIR, fileName);
  
  if (existsSync(outputPath)) {
    console.log(`✅ ${packageName}: already exists (${fileName})`);
    return fileName;
  }
  
  try {
    console.log(`⬇️  Downloading ${packageName}...`);
    const response = await fetch(wheelUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    writeFileSync(outputPath, Buffer.from(buffer));
    console.log(`✅ ${packageName}: downloaded (${fileName}, ${(buffer.byteLength / 1024).toFixed(1)} KB)`);
    return fileName;
  } catch (error) {
    console.error(`❌ Failed to download ${packageName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("📦 Downloading Python wheels for Pyodide...\n");
  
  // Create wheels directory
  mkdirSync(WHEELS_DIR, { recursive: true });
  
  const results = {};
  
  for (const packageName of PACKAGES) {
    const wheelUrl = await fetchWheelUrl(packageName);
    if (wheelUrl) {
      const fileName = await downloadWheel(packageName, wheelUrl);
      if (fileName) {
        results[packageName] = fileName;
      }
    }
  }
  
  // Save manifest
  const manifestPath = join(WHEELS_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  
  console.log(`\n📄 Manifest saved to ${manifestPath}`);
  console.log("\n✨ Done! Wheels are ready for bundling.");
}

main().catch(console.error);
