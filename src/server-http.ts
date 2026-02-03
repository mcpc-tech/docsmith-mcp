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
import { z } from "zod";
import express from "express";
import cors from "cors";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { runPythonFile } from "./code-runner.js";
import { detectFileType, getConfig, getPackages } from "./utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Tool schemas
const ReadDocumentSchema = z.object({
  file_path: z.string().describe("Absolute path to the document file"),
  file_type: z.enum(["excel", "word", "pptx", "pdf", "text"]).optional()
    .describe("Override file type detection"),
  mode: z.enum(["raw", "paginated"]).optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
  sheet_name: z.string().optional(),
});

const WriteDocumentSchema = z.object({
  file_path: z.string(),
  format: z.enum(["excel", "word", "pptx", "text"]),
  data: z.any(),
});

const GetDocumentInfoSchema = z.object({
  file_path: z.string(),
  file_type: z.enum(["excel", "word", "pptx", "pdf", "text"]).optional(),
});

// UI Resource URI - Universal viewer for all document types
const UNIVERSAL_VIEWER_URI = "ui://read-document/viewer.html";

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
    tools: [
      {
        name: "read_document",
        description: "Read document content (Excel, Word, PowerPoint, PDF, TXT, CSV, Markdown, JSON, YAML). Supports raw full read or paginated mode.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string", description: "Absolute path to the document file" },
            file_type: { type: "string", enum: ["excel", "word", "pptx", "pdf", "text"] },
            mode: { type: "string", enum: ["raw", "paginated"] },
            page: { type: "number" },
            page_size: { type: "number" },
            sheet_name: { type: "string" },
          },
          required: ["file_path"],
        },
        outputSchema: {
          type: "object",
          properties: {
            success: { type: "boolean" },
            error: { type: "string" },
            encoding: { type: "string" },
            sheet_name: { type: "string" },
            sheets: { type: "array", items: { type: "string" } },
            total_rows: { type: "number" },
            total_cols: { type: "number" },
            current_page: { type: ["number", "null"] },
            total_pages: { type: "number" },
            paragraphs: { type: "array" },
            tables: { type: "array" },
            total_slides: { type: "number" },
            slides: { type: "array" },
            content: {},
            data: {},
            page: { type: "number" },
            page_size: { type: ["number", "null"] },
            has_more: { type: "boolean" },
          },
        },
        // MCP Apps UI metadata - universal viewer for all file types
        _meta: {
          ui: {
            resourceUri: UNIVERSAL_VIEWER_URI,
          },
        },
      },
      {
        name: "write_document",
        description: "Write document content (Excel, Word, PowerPoint, Text)",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            format: { type: "string", enum: ["excel", "word", "pptx", "text"] },
            data: {},
          },
          required: ["file_path", "format", "data"],
        },
      },
      {
        name: "get_document_info",
        description: "Get document metadata (page count, sheet count, slide count, file size, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            file_type: { type: "string", enum: ["excel", "word", "pptx", "pdf", "text"] },
          },
          required: ["file_path"],
        },
      },
    ],
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
