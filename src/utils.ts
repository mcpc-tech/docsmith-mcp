/**
 * Utility functions for document processing
 */

/**
 * Detect file type from file extension
 */
export function detectFileType(
  filePath: string,
): "excel" | "word" | "pdf" | "pptx" | "text" | null {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "docx") return "word";
  if (ext === "pptx" || ext === "ppt") return "pptx";
  if (ext === "pdf") return "pdf";
  if (
    ext === "txt" || ext === "csv" || ext === "md" || ext === "json" ||
    ext === "yaml" || ext === "yml"
  ) return "text";
  return null;
}

/**
 * Get required packages for each file type
 */
export function getPackages(fileType: string): Record<string, string> {
  const packages: Record<string, Record<string, string>> = {
    excel: { openpyxl: "openpyxl" },
    word: { docx: "python-docx" }, // Map docx import to python-docx package
    pptx: { pptx: "python-pptx" }, // Map pptx import to python-pptx package
    pdf: { PyPDF2: "PyPDF2" },
    text: {}, // No external packages needed for text files
  };
  return packages[fileType] || {};
}

/**
 * Get environment configuration
 */
export function getConfig() {
  return {
    rawFullRead: process.env.DOC_RAW_FULL_READ === "true",
    pageSize: parseInt(process.env.DOC_PAGE_SIZE || "100", 10),
    maxFileSize: parseInt(process.env.DOC_MAX_FILE_SIZE || "50", 10) * 1024 *
      1024,
  };
}
