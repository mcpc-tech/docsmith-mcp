/**
 * Shared tool definitions for MCP servers
 * Contains JSON schemas for tool input/output
 */

export const ReadDocumentTool = {
  name: "read_document",
  description: "Read document content (Excel, Word, PowerPoint, PDF, TXT, CSV, Markdown, JSON, YAML). Supports raw full read or paginated mode. Includes interactive UI for Excel and PDF.",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the document file",
      },
      file_type: {
        type: "string",
        enum: ["excel", "word", "pptx", "pdf", "text"],
        description: "Override file type detection (optional). Specify format explicitly instead of relying on extension",
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
    description: "Document content with format-specific structure. Common fields: success (boolean), error (string, on failure).",
    properties: {
      // Common fields
      success: { type: "boolean" },
      error: { type: "string" },
      encoding: { type: "string" },

      // Excel-specific
      sheet_name: { type: "string" },
      sheets: { type: "array", items: { type: "string" } },
      total_rows: { type: "number" },
      total_cols: { type: "number" },
      current_page: { type: ["number", "null"] },
      total_pages: { type: "number" },

      // Word-specific
      paragraphs: { type: "array" },
      tables: { type: "array" },
      total_paragraphs: { type: "number" },
      total_tables: { type: "number" },

      // PowerPoint-specific
      total_slides: { type: "number" },
      slides: {
        type: "array",
        items: {
          type: "object",
          properties: {
            slide_number: { type: "number" },
            title: { type: "string" },
            content: { type: "array" },
            notes: { type: "string" },
          },
        },
      },

      // PDF-specific
      current_page_group: { type: ["number", "null"] },
      total_page_groups: { type: "number" },
      content: {},

      // Text/CSV-specific
      total_lines: { type: "number" },
      headers: { type: "array", items: { type: "string" } },

      // Data field (varies by format)
      data: {},

      // Pagination
      page: { type: "number" },
      page_size: { type: ["number", "null"] },
      has_more: { type: "boolean" },
    },
    additionalProperties: false,
  },
} as const;

export const WriteDocumentTool = {
  name: "write_document",
  description: "Write document content (Excel, Word, PowerPoint, Text)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to save the document",
      },
      format: {
        type: "string",
        enum: ["excel", "word", "pptx", "text"],
        description: "Document format",
      },
      data: {
        description: "Document data structure. Excel: array of rows [[cell1, cell2], ...]. Word: {paragraphs: string[], tables?: [[[cell]]]}. Text/CSV/JSON: string or object",
      },
    },
    required: ["file_path", "format", "data"],
  },
} as const;

export const GetDocumentInfoTool = {
  name: "get_document_info",
  description: "Get document metadata (page count, sheet count, slide count, file size, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      file_path: {
        type: "string",
        description: "Absolute path to the document file",
      },
      file_type: {
        type: "string",
        enum: ["excel", "word", "pptx", "pdf", "text"],
        description: "Override file type detection (optional). Specify format explicitly instead of relying on extension",
      },
    },
    required: ["file_path"],
  },
  outputSchema: {
    type: "object",
    description: "Document metadata with format-specific fields",
    properties: {
      success: { type: "boolean" },
      error: { type: "string" },
      file_size: { type: "number" },

      // Excel-specific
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
      },

      // Word-specific
      paragraphs: { type: "number" },
      tables: { type: "number" },

      // PowerPoint-specific
      slides: { type: "number" },

      // PDF-specific
      pages: { type: "number" },
      total_words: { type: "number" },
      metadata: { type: "object" },

      // Text/CSV/JSON-specific
      line_count: { type: "number" },
      encoding: { type: "string" },
      file_type: { type: "string" },
      headers: { type: "array", items: { type: "string" } },
      total_rows: { type: "number" },
      total_cols: { type: "number" },
      item_count: { type: "number" },
      key_count: { type: "number" },
    },
    additionalProperties: false,
  },
} as const;

// UI Resource URI - Universal viewer for all document types
export const UNIVERSAL_VIEWER_URI = "ui://read-document/viewer.html";

export const RunPythonTool = {
  name: "run_python",
  description: "Execute Python code for flexible file operations, data processing, and custom tasks. Supports any file format and Python libraries.",
  inputSchema: {
    type: "object",
    properties: {
      code: { type: "string", description: "Python code to execute. Access files using their absolute paths." },
      packages: { type: "object", description: "Package mappings (import_name -> pypi_name) for required dependencies" },
      file_paths: { type: "array", items: { type: "string" }, description: "File paths that the code needs to access" },
    },
    required: ["code"],
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      result: {},
      stdout: { type: "string" },
      stderr: { type: "string" },
      error: { type: "string" },
    },
  },
} as const;

// Tool list for HTTP server (with UI metadata)
export const HTTP_TOOLS = [
  {
    ...ReadDocumentTool,
    outputSchema: ReadDocumentTool.outputSchema,
    // MCP Apps UI metadata - universal viewer for all file types
    _meta: {
      ui: {
        resourceUri: "ui://read-document/viewer.html",
      },
    },
  },
  WriteDocumentTool,
  GetDocumentInfoTool,
  RunPythonTool,
];

// Tool list for stdio server (without UI metadata)
export const STDIO_TOOLS = [
  ReadDocumentTool,
  WriteDocumentTool,
  GetDocumentInfoTool,
  RunPythonTool,
];
