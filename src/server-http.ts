#!/usr/bin/env node

/**
 * HTTP Server with MCP Apps support
 * Supports both stdio and HTTP transport modes
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join, resolve } from "path";

import { runPythonFile } from "./code-runner.js";
import { detectFileType, getConfig, getPackages } from "./utils.js";
import { runPy, type RunPyOptions } from "@mcpc-tech/code-runner-mcp";
import {
  ReadDocumentSchema,
  WriteDocumentSchema,
  GetDocumentInfoSchema,
  RunPythonSchema,
} from "./schemas.js";
import { HTTP_TOOLS, UNIVERSAL_VIEWER_URI } from "./tool-definitions.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create server
const server = new Server(
  {
    name: "docsmith-mcp",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  },
);

// Store file path from last read for UI to use
let lastReadFilePath: string | null = null;
let lastReadFileType: string | null = null;

// List available tools with UI metadata
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: HTTP_TOOLS,
  };
});

// List available resources
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: UNIVERSAL_VIEWER_URI,
        name: "Universal Document Viewer",
        mimeType: "text/html",
        description: "Universal viewer supporting Excel, PDF, Word, and PowerPoint documents",
      },
    ],
  };
});

// Read resource (UI HTML files)
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  try {
    let htmlFile: string;

    if (uri === UNIVERSAL_VIEWER_URI) {
      htmlFile = "index.html";
    } else {
      throw new Error(`Unknown resource: ${uri}`);
    }

    // Read the bundled HTML file (single file build output)
    const htmlPath = join(__dirname, "..", "dist", "ui", htmlFile);
    const html = readFileSync(htmlPath, "utf-8");

    return {
      contents: [
        {
          uri,
          mimeType: "text/html",
          text: html,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read resource: ${errorMessage}`);
  }
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_document") {
      const params = ReadDocumentSchema.parse(args);
      const fileType = params.file_type || detectFileType(params.file_path);

      if (!fileType) {
        throw new Error(`Unsupported file type: ${params.file_path}`);
      }

      // Store for UI reference
      lastReadFilePath = params.file_path;
      lastReadFileType = fileType;

      const config = getConfig();
      const mode = params.mode || (config.rawFullRead ? "raw" : "paginated");
      const page = mode === "paginated" ? (params.page || 1) : undefined;
      const pageSize = params.page_size || config.pageSize;

      let scriptName: string;
      let scriptArgs: string[];

      if (fileType === "excel") {
        scriptName = "excel_handler.py";
        scriptArgs = ["read", params.file_path];
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
          scriptArgs.push(String(Math.min(pageSize, 10)));
        }
      } else {
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

      return {
        content: [{
          type: "text",
          text: JSON.stringify(resultWithPath, null, 2),
        }],
        structuredContent: resultWithPath,
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

// HTTP Server setup
async function startHTTPServer(port: number = 3000) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "docsmith-mcp", version: "0.2.0" });
  });

  // MCP HTTP endpoint
  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: (sessionId) => {
        console.error(`Session initialized: ${sessionId}`);
      },
    });

    // Clean up transport when response closes
    res.on("close", () => {
      transport.close?.();
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.listen(port, () => {
    console.log(`Docsmith MCP HTTP server running on port ${port}`);
    console.log(`MCP endpoint: http://localhost:${port}/mcp`);
    console.log(`Health check: http://localhost:${port}/health`);
  });

  // Keep the process alive
  await new Promise(() => {});
}

// Stdio server
async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Docsmith MCP server running on stdio");
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || "stdio";

  if (mode === "http") {
    const port = parseInt(args[1], 10) || 3000;
    await startHTTPServer(port);
  } else {
    await startStdioServer();
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
