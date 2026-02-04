#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { runPythonFile } from "./code-runner.js";
import { detectFileType, getConfig, getPackages } from "./utils.js";
import { runPy, type RunPyOptions } from "@mcpc-tech/code-runner-mcp";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import {
  ReadDocumentSchema,
  WriteDocumentSchema,
  GetDocumentInfoSchema,
  RunPythonSchema,
} from "./schemas.js";
import { STDIO_TOOLS, UNIVERSAL_VIEWER_URI } from "./tool-definitions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Server setup
const server = new Server(
  {
    name: "docsmith-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: STDIO_TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_document") {
      const params = ReadDocumentSchema.parse(args);
      // Use explicit file_type if provided, otherwise detect from extension
      const fileType = params.file_type || detectFileType(params.file_path);

      if (!fileType) {
        throw new Error(`Unsupported file type: ${params.file_path}`);
      }

      // Determine read mode
      const config = getConfig();
      const mode = params.mode || (config.rawFullRead ? "raw" : "paginated");
      const page = mode === "paginated" ? (params.page || 1) : undefined;
      const pageSize = params.page_size || config.pageSize;

      let scriptName: string;
      let scriptArgs: string[];

      if (fileType === "excel") {
        scriptName = "excel_handler.py";
        scriptArgs = ["read", params.file_path];
        // Always push sheet_name (even if undefined) to maintain arg positions
        scriptArgs.push(params.sheet_name || "");
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(pageSize));
        }
      } else if (fileType === "word") {
        scriptName = "word_handler.py";
        scriptArgs = ["read", params.file_path];
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(pageSize));
        }
      } else if (fileType === "pptx") {
        scriptName = "pptx_handler.py";
        scriptArgs = ["read", params.file_path];
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(pageSize));
        }
      } else if (fileType === "pdf") {
        scriptName = "pdf_handler.py";
        scriptArgs = ["read", params.file_path];
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(Math.min(pageSize, 10))); // PDF pages are larger
        }
      } else {
        // text files
        scriptName = "text_handler.py";
        scriptArgs = ["read", params.file_path];
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(pageSize));
        }
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(fileType),
        filePaths: [params.file_path],
      });

      // Add file_path to result for UI reference
      const resultWithPath = { ...result, file_path: params.file_path, file_type: fileType };

      // Use universal viewer for all file types
      const uiResourceUri = UNIVERSAL_VIEWER_URI;

      return {
        content: [{
          type: "text",
          text: JSON.stringify(resultWithPath, null, 2),
        }],
        structuredContent: resultWithPath,
        // Include UI resource for MCP Apps
        _meta: {
          ui: {
            resourceUri: uiResourceUri,
          },
        },
      };
    }

    if (name === "write_document") {
      const params = WriteDocumentSchema.parse(args);

      let scriptName: string;
      let scriptArgs: string[];

      if (params.format === "excel") {
        scriptName = "excel_handler.py";
        scriptArgs = ["write", params.file_path, JSON.stringify(params.data)];
      } else if (params.format === "word") {
        scriptName = "word_handler.py";
        const paragraphs = params.data.paragraphs || [];
        const tables = params.data.tables || null;
        scriptArgs = ["write", params.file_path, JSON.stringify(paragraphs)];
        if (tables) scriptArgs.push(JSON.stringify(tables));
      } else if (params.format === "pptx") {
        scriptName = "pptx_handler.py";
        const slides = params.data.slides || params.data || [];
        scriptArgs = ["write", params.file_path, JSON.stringify(slides)];
      } else if (params.format === "text") {
        scriptName = "text_handler.py";
        const content = typeof params.data === "string"
          ? params.data
          : JSON.stringify(params.data);
        scriptArgs = ["write", params.file_path, content];
      } else {
        throw new Error(`Unsupported write format: ${params.format}`);
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(params.format),
        filePaths: [params.file_path],
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
        structuredContent: result,
      };
    }

    if (name === "get_document_info") {
      const params = GetDocumentInfoSchema.parse(args);
      // Use explicit file_type if provided, otherwise detect from extension
      const fileType = params.file_type || detectFileType(params.file_path);

      if (!fileType) {
        throw new Error(`Unsupported file type: ${params.file_path}`);
      }

      let scriptName: string;
      let scriptArgs = ["info", params.file_path];

      if (fileType === "excel") {
        scriptName = "excel_handler.py";
      } else if (fileType === "word") {
        scriptName = "word_handler.py";
      } else if (fileType === "pptx") {
        scriptName = "pptx_handler.py";
      } else if (fileType === "pdf") {
        scriptName = "pdf_handler.py";
      } else {
        scriptName = "text_handler.py";
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(fileType),
        filePaths: [params.file_path],
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
        structuredContent: result,
      };
    }

    if (name === "run_python") {
      const params = RunPythonSchema.parse(args);

      // Determine mount root from file paths - find common ancestor
      let mountRoot = join(__dirname, "..");
      if (params.file_paths && params.file_paths.length > 0) {
        const { dirname, sep } = await import("path");
        const paths = params.file_paths.map(p => dirname(resolve(p)));

        // Find common ancestor
        const findCommonAncestor = (paths: string[]): string => {
          if (paths.length === 0) return "";
          if (paths.length === 1) return paths[0];

          const parts = paths.map(p => p.split(sep));
          const first = parts[0];
          let common = [];

          for (let i = 0; i < first.length; i++) {
            if (parts.every(p => p[i] === first[i])) {
              common.push(first[i]);
            } else {
              break;
            }
          }

          return common.join(sep) || sep;
        };

        mountRoot = findCommonAncestor(paths);
      }

      const runPyOptions: RunPyOptions = {
        packages: params.packages || {},
        nodeFSMountPoint: mountRoot,
        nodeFSRoot: mountRoot,
      };

      const stream = await runPy(params.code, runPyOptions);

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
        return {
          content: [{ type: "text", text: `Error: ${String(streamError)}` }],
          isError: true,
        };
      }

      // Check for errors
      if (error) {
        return {
          content: [{ type: "text", text: `Error: ${error.replace(/\[err\]\[py\]\s*/g, "").trim()}` }],
          isError: true,
        };
      }

      // Try to parse last line as JSON result
      let result = null;
      const lines = stdout.trim().split("\n");
      const lastLine = lines[lines.length - 1];
      try {
        result = JSON.parse(lastLine);
      } catch {
        // Not JSON, use full stdout
      }

      const response = {
        success: !error,
        result: result,
        stdout: stdout,
        stderr: stderr || undefined,
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(response, null, 2),
        }],
        structuredContent: response,
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text", text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Docsmith MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
