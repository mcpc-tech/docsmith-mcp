/**
 * Shared Zod schemas for MCP tools
 */
import { z } from "zod";

export const ReadDocumentSchema = z.object({
  file_path: z.string().describe("Absolute path to the document file"),
  file_type: z.enum(["excel", "word", "pptx", "pdf", "text"]).optional()
    .describe("Override file type detection"),
  mode: z.enum(["raw", "paginated"]).optional(),
  page: z.number().optional(),
  page_size: z.number().optional(),
  sheet_name: z.string().optional(),
});

export const WriteDocumentSchema = z.object({
  file_path: z.string(),
  format: z.enum(["excel", "word", "pptx", "text"]),
  data: z.any(),
});

export const GetDocumentInfoSchema = z.object({
  file_path: z.string(),
  file_type: z.enum(["excel", "word", "pptx", "pdf", "text"]).optional(),
});

export const RunPythonSchema = z.object({
  code: z.string().describe("Python code to execute"),
  packages: z.record(z.string()).optional().describe("Package mappings (import_name -> pypi_name)"),
  file_paths: z.array(z.string()).optional().describe("File paths that the code needs to access"),
});
