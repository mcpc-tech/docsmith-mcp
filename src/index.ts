#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { runPythonFile } from "./code-runner.js";
import { detectFileType, getConfig, getPackages } from "./utils.js";

// Tool schemas
const ReadDocumentSchema = z.object({
  file_path: z.string().describe("Absolute path to the document file"),
  mode: z.enum(["raw", "paginated"]).optional().describe(
    "Read mode: 'raw' for full content, 'paginated' for chunked reading",
  ),
  page: z.number().optional().describe(
    "Page number for paginated mode (1-based)",
  ),
  page_size: z.number().optional().describe(
    "Items per page for paginated mode",
  ),
  sheet_name: z.string().optional().describe("Sheet name for Excel files"),
});

const WriteDocumentSchema = z.object({
  file_path: z.string().describe("Absolute path to save the document"),
  format: z.enum(["excel", "word"]).describe("Document format"),
  data: z.any().describe("Document data structure"),
});

const GetDocumentInfoSchema = z.object({
  file_path: z.string().describe("Absolute path to the document file"),
});

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
    tools: [
      {
        name: "read_document",
        description:
          "Read document content (Excel, Word, PDF). Supports raw full read or paginated mode.",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the document file",
            },
            mode: {
              type: "string",
              enum: ["raw", "paginated"],
              description: "Read mode",
            },
            page: {
              type: "number",
              description: "Page number for paginated mode",
            },
            page_size: { type: "number", description: "Items per page" },
            sheet_name: {
              type: "string",
              description: "Sheet name for Excel files",
            },
          },
          required: ["file_path"],
        },
      },
      {
        name: "write_document",
        description: "Write document content (Excel, Word)",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to save the document",
            },
            format: {
              type: "string",
              enum: ["excel", "word"],
              description: "Document format",
            },
            data: { type: "object", description: "Document data structure" },
          },
          required: ["file_path", "format", "data"],
        },
      },
      {
        name: "get_document_info",
        description:
          "Get document metadata (page count, sheet count, file size, etc.)",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to the document file",
            },
          },
          required: ["file_path"],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "read_document") {
      const params = ReadDocumentSchema.parse(args);
      const fileType = detectFileType(params.file_path);

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
        if (params.sheet_name) scriptArgs.push(params.sheet_name);
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
      } else {
        scriptName = "pdf_handler.py";
        scriptArgs = ["read", params.file_path];
        if (page) {
          scriptArgs.push(String(page));
          scriptArgs.push(String(Math.min(pageSize, 10))); // PDF pages are larger
        }
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(fileType),
        filePaths: [params.file_path],
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
      } else {
        throw new Error(`Unsupported write format: ${params.format}`);
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(params.format),
        filePaths: [params.file_path],
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    }

    if (name === "get_document_info") {
      const params = GetDocumentInfoSchema.parse(args);
      const fileType = detectFileType(params.file_path);

      if (!fileType) {
        throw new Error(`Unsupported file type: ${params.file_path}`);
      }

      let scriptName: string;
      let scriptArgs = ["info", params.file_path];

      if (fileType === "excel") {
        scriptName = "excel_handler.py";
      } else if (fileType === "word") {
        scriptName = "word_handler.py";
      } else {
        scriptName = "pdf_handler.py";
      }

      const result = await runPythonFile(scriptName, {
        args: scriptArgs,
        packages: getPackages(fileType),
        filePaths: [params.file_path],
      });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
