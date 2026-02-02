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
  format: z.enum(["excel", "word", "text"]).describe("Document format"),
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

// Output schemas (reusable)
const BaseOutputSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", description: "Operation success status" },
    error: { type: "string", description: "Error message if failed" },
  },
} as const;

const PaginationSchema = {
  current_page: { type: "number", description: "Current page number" },
  page_size: { type: "number", description: "Items per page" },
  total_pages: { type: "number", description: "Total number of pages" },
  page: { type: "number", description: "Current page number (alternative)" },
  has_more: { type: "boolean", description: "Whether more pages exist" },
} as const;

const ExcelReadOutputSchema = {
  type: "object",
  properties: {
    sheet_name: { type: "string", description: "Active sheet name" },
    sheets: {
      type: "array",
      items: { type: "string" },
      description: "All sheet names",
    },
    total_rows: { type: "number", description: "Total rows in sheet" },
    total_cols: { type: "number", description: "Total columns in sheet" },
    data: {
      type: "array",
      items: { type: "array", items: {} },
      description: "Sheet data as array of rows",
    },
    ...PaginationSchema,
  },
} as const;

const WordReadOutputSchema = {
  type: "object",
  properties: {
    paragraphs: {
      type: "array",
      items: { type: "string" },
      description: "Document paragraphs",
    },
    tables: {
      type: "array",
      items: { type: "array", items: { type: "array", items: { type: "string" } } },
      description: "Tables data",
    },
    total_paragraphs: { type: "number", description: "Total paragraph count" },
    total_tables: { type: "number", description: "Total table count" },
    ...PaginationSchema,
  },
} as const;

const PDFReadOutputSchema = {
  type: "object",
  properties: {
    total_pages: { type: "number", description: "Total pages in PDF" },
    content: {
      type: "array",
      items: {
        type: "object",
        properties: {
          page_number: { type: "number" },
          text: { type: "string" },
        },
      },
      description: "Page content array",
    },
    current_page_group: { type: "number" },
    page_size: { type: "number" },
  },
} as const;

const TextReadOutputSchema = {
  type: "object",
  properties: {
    ...BaseOutputSchema.properties,
    content: { type: "string", description: "Text content" },
    total_lines: { type: "number", description: "Total line count" },
    encoding: { type: "string", description: "File encoding" },
    ...PaginationSchema,
  },
} as const;

const CSVReadOutputSchema = {
  type: "object",
  properties: {
    ...BaseOutputSchema.properties,
    headers: {
      type: "array",
      items: { type: "string" },
      description: "CSV headers",
    },
    data: {
      type: "array",
      items: { type: "object" },
      description: "Structured data as array of objects",
    },
    total_rows: { type: "number", description: "Total data rows" },
    encoding: { type: "string", description: "File encoding" },
    ...PaginationSchema,
  },
} as const;

const JSONReadOutputSchema = {
  type: "object",
  properties: {
    ...BaseOutputSchema.properties,
    data: { type: "object", description: "Parsed JSON data" },
    encoding: { type: "string", description: "File encoding" },
  },
} as const;

const WriteOutputSchema = {
  type: "object",
  properties: {
    success: { type: "boolean", description: "Write operation success" },
    file_path: { type: "string", description: "Written file path" },
    message: { type: "string", description: "Success message" },
    error: { type: "string", description: "Error message if failed" },
  },
} as const;

const ExcelInfoOutputSchema = {
  type: "object",
  properties: {
    sheets: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          rows: { type: "number" },
          cols: { type: "number" },
        },
      },
      description: "Sheet information",
    },
    file_size: { type: "number", description: "File size in bytes" },
  },
} as const;

const WordInfoOutputSchema = {
  type: "object",
  properties: {
    paragraphs: { type: "number", description: "Paragraph count" },
    tables: { type: "number", description: "Table count" },
    file_size: { type: "number", description: "File size in bytes" },
  },
} as const;

const PDFInfoOutputSchema = {
  type: "object",
  properties: {
    pages: { type: "number", description: "Page count" },
    file_size: { type: "number", description: "File size in bytes" },
    total_words: { type: "number", description: "Total word count" },
  },
} as const;

const TextInfoOutputSchema = {
  type: "object",
  properties: {
    ...BaseOutputSchema.properties,
    file_size: { type: "number", description: "File size in bytes" },
    line_count: { type: "number", description: "Line count" },
    encoding: { type: "string", description: "File encoding" },
    file_type: { type: "string", description: "File extension" },
    // CSV specific
    headers: { type: "array", items: { type: "string" } },
    total_rows: { type: "number" },
    total_cols: { type: "number" },
    // JSON specific
    item_count: { type: "number" },
    key_count: { type: "number" },
  },
} as const;

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "read_document",
        description:
          "Read document content (Excel, Word, PDF, TXT, CSV, Markdown, JSON, YAML). Supports raw full read or paginated mode.",
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
        outputSchema: {
          type: "object",
          description: "Returns different structures based on file type: Excel (sheet data), Word (paragraphs/tables), PDF (page content), Text (plain text), CSV (structured rows), JSON (parsed object)",
          oneOf: [
            ExcelReadOutputSchema,
            WordReadOutputSchema,
            PDFReadOutputSchema,
            TextReadOutputSchema,
            CSVReadOutputSchema,
            JSONReadOutputSchema,
          ],
        },
      },
      {
        name: "write_document",
        description: "Write document content (Excel, Word, Text)",
        inputSchema: {
          type: "object",
          properties: {
            file_path: {
              type: "string",
              description: "Absolute path to save the document",
            },
            format: {
              type: "string",
              enum: ["excel", "word", "text"],
              description: "Document format",
            },
            data: {
              description:
                "Document data structure. Excel: array of rows [[cell1, cell2], ...]. Word: {paragraphs: string[], tables?: [[[cell]]]}. Text/CSV/JSON: string or object",
            },
          },
          required: ["file_path", "format", "data"],
        },
        outputSchema: WriteOutputSchema,
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
        outputSchema: {
          type: "object",
          description: "Returns metadata based on file type",
          oneOf: [
            ExcelInfoOutputSchema,
            WordInfoOutputSchema,
            PDFInfoOutputSchema,
            TextInfoOutputSchema,
          ],
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
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify(result, null, 2) 
        }],
        _meta: result,
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
          text: JSON.stringify(result, null, 2) 
        }],
        _meta: result,
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
          text: JSON.stringify(result, null, 2) 
        }],
        _meta: result,
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
