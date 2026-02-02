/**
 * Utility functions for document processing
 */

/**
 * Detect file type from file extension
 */
export function detectFileType(
  filePath: string,
): "excel" | "word" | "pdf" | null {
  const ext = filePath.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") return "excel";
  if (ext === "docx") return "word";
  if (ext === "pdf") return "pdf";
  return null;
}

/**
 * Get required packages for each file type
 */
export function getPackages(fileType: string): Record<string, string> {
  const packages: Record<string, Record<string, string>> = {
    excel: { openpyxl: "openpyxl" },
    word: { docx: "python-docx" }, // Map docx import to python-docx package
    pdf: { PyPDF2: "PyPDF2" },
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
