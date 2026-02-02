import { describe, expect, it } from "vitest";
import { runPythonFile } from "../src/code-runner.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Pagination functionality tests for all document types
 * Tests edge cases, boundary conditions, and parameter handling
 */

describe("Excel Pagination", () => {
  const excelFile = join(__dirname, "..", "examples", "sample_sales_data.xlsx");

  it("should handle pagination without sheet_name (empty string)", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile, "", "1", "5"],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.current_page).toBe(1);
    expect(result.page_size).toBe(5);
    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.total_pages).toBeGreaterThan(0);
  });

  it("should handle pagination with numeric sheet index", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile, "1", "1", "3"],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.sheet_name).toBe("Sales Report");
    expect(result.current_page).toBe(1);
    expect(result.data.length).toBeLessThanOrEqual(3);
  });

  it("should calculate correct total_pages", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile, "", "1", "5"],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    const totalRows = result.total_rows;
    const pageSize = 5;
    const expectedPages = Math.ceil(totalRows / pageSize);

    expect(result.total_pages).toBe(expectedPages);
  });

  it("should handle out-of-range page gracefully", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile, "", "999", "10"],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.current_page).toBe(999);
    expect(result.data).toEqual([]);
    expect(result.total_pages).toBeGreaterThan(0);
  });
});

describe("Word Pagination", () => {
  const wordFile = join(__dirname, "..", "examples", "sample_report.docx");

  it("should handle last page with remaining items", async () => {
    const fullResult = await runPythonFile("word_handler.py", {
      args: ["read", wordFile],
      packages: { docx: "python-docx" },
      filePaths: [wordFile],
    });

    const totalParagraphs = fullResult.total_paragraphs;
    const pageSize = 5;
    const lastPage = Math.ceil(totalParagraphs / pageSize);

    const result = await runPythonFile("word_handler.py", {
      args: ["read", wordFile, String(lastPage), String(pageSize)],
      packages: { docx: "python-docx" },
      filePaths: [wordFile],
    });

    expect(result.current_page).toBe(lastPage);
    expect(result.paragraphs.length).toBeLessThanOrEqual(pageSize);
    expect(result.paragraphs.length).toBeGreaterThan(0);
  });
});

describe("PowerPoint Pagination", () => {
  const pptxFile = join(
    __dirname,
    "..",
    "examples",
    "sample_presentation.pptx",
  );

  it("should handle second page correctly", async () => {
    const result = await runPythonFile("pptx_handler.py", {
      args: ["read", pptxFile, "2", "1"],
      packages: { pptx: "python-pptx" },
      filePaths: [pptxFile],
    });

    expect(result.current_page).toBe(2);
    expect(result.slides.length).toBe(1);
    expect(result.slides[0].slide_number).toBe(2);
    expect(result.total_pages).toBe(3);
  });
});
