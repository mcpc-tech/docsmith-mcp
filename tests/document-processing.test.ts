import { describe, expect, it } from "vitest";
import { runPythonFile } from "../src/code-runner.js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Document processing tests using real files from examples/ directory
 * These tests demonstrate reading, getting info, and processing actual documents
 */

describe("Excel Document Processing", () => {
  const excelFile = join(__dirname, "..", "examples", "sample_sales_data.xlsx");

  it("should read Excel file content", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.sheet_name).toBe("Sales Report");
    expect(result.sheets).toContain("Sales Report");
    expect(result.total_rows).toBeGreaterThan(0);
    expect(result.total_cols).toBeGreaterThan(0);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("should read Excel file with pagination", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["read", excelFile, "Sales Report", "1", "3"],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.current_page).toBe(1);
    expect(result.page_size).toBe(3);
    expect(result.data.length).toBeLessThanOrEqual(3);
  });

  it("should get Excel file info", async () => {
    const result = await runPythonFile("excel_handler.py", {
      args: ["info", excelFile],
      packages: { openpyxl: "openpyxl" },
      filePaths: [excelFile],
    });

    expect(result.sheets).toBeDefined();
    expect(Array.isArray(result.sheets)).toBe(true);
    expect(result.file_size).toBeGreaterThan(0);
    expect(result.sheets[0].name).toBe("Sales Report");
    expect(result.sheets[0].rows).toBeGreaterThan(0);
    expect(result.sheets[0].cols).toBeGreaterThan(0);
  });
});

describe("Word Document Processing", () => {
  const wordFile = join(__dirname, "..", "examples", "sample_report.docx");

  it("should read Word document content", async () => {
    const result = await runPythonFile("word_handler.py", {
      args: ["read", wordFile],
      packages: { docx: "python-docx" },
      filePaths: [wordFile],
    });

    expect(result.paragraphs).toBeDefined();
    expect(Array.isArray(result.paragraphs)).toBe(true);
    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.total_paragraphs).toBeGreaterThan(0);
    expect(result.total_tables).toBeGreaterThan(0);
    expect(result.tables).toBeDefined();
    expect(Array.isArray(result.tables)).toBe(true);
  });

  it("should read Word document with pagination", async () => {
    const result = await runPythonFile("word_handler.py", {
      args: ["read", wordFile, "1", "5"],
      packages: { docx: "python-docx" },
      filePaths: [wordFile],
    });

    expect(result.current_page).toBe(1);
    expect(result.page_size).toBe(5);
    expect(result.paragraphs.length).toBeLessThanOrEqual(5);
  });

  it("should get Word document info", async () => {
    const result = await runPythonFile("word_handler.py", {
      args: ["info", wordFile],
      packages: { docx: "python-docx" },
      filePaths: [wordFile],
    });

    expect(result.paragraphs).toBeGreaterThan(0);
    expect(result.tables).toBeGreaterThan(0);
    expect(result.file_size).toBeGreaterThan(0);
  });
});

describe("PDF Document Processing", () => {
  const pdfFile = join(__dirname, "..", "examples", "sample_document.pdf");

  it("should read PDF content", async () => {
    const result = await runPythonFile("pdf_handler.py", {
      args: ["read", pdfFile],
      packages: { PyPDF2: "PyPDF2" },
      filePaths: [pdfFile],
    });

    expect(result.total_pages).toBeGreaterThan(0);
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].page_number).toBe(1);
    expect(result.content[0].text).toBeDefined();
  });

  it("should read PDF with pagination", async () => {
    const result = await runPythonFile("pdf_handler.py", {
      args: ["read", pdfFile, "1", "1"],
      packages: { PyPDF2: "PyPDF2" },
      filePaths: [pdfFile],
    });

    expect(result.current_page_group).toBe(1);
    expect(result.page_size).toBe(1);
    expect(result.content.length).toBe(1);
  });

  it("should get PDF info", async () => {
    const result = await runPythonFile("pdf_handler.py", {
      args: ["info", pdfFile],
      packages: { PyPDF2: "PyPDF2" },
      filePaths: [pdfFile],
    });

    expect(result.pages).toBeGreaterThan(0);
    expect(result.file_size).toBeGreaterThan(0);
    expect(result.total_words).toBeGreaterThan(0);
  });
});

describe("PowerPoint Document Processing", () => {
  const pptxFile = join(
    __dirname,
    "..",
    "examples",
    "sample_presentation.pptx",
  );

  it("should read PowerPoint presentation content", async () => {
    const result = await runPythonFile("pptx_handler.py", {
      args: ["read", pptxFile],
      packages: { pptx: "python-pptx" },
      filePaths: [pptxFile],
    });

    expect(result.total_slides).toBe(3);
    expect(result.slides).toBeDefined();
    expect(Array.isArray(result.slides)).toBe(true);
    expect(result.slides.length).toBe(3);

    // Check first slide structure
    expect(result.slides[0].slide_number).toBe(1);
    expect(result.slides[0].title).toBeDefined();
    expect(result.slides[0].content).toBeDefined();
    expect(Array.isArray(result.slides[0].content)).toBe(true);

    // Check that slides contain expected content
    const allContent = result.slides.flatMap((s) =>
      [s.title, ...s.content].filter(Boolean)
    );
    expect(
      allContent.some((c) =>
        typeof c === "string" && c.includes("Sample Presentation")
      ),
    ).toBe(true);
  });

  it("should read PowerPoint with pagination", async () => {
    const result = await runPythonFile("pptx_handler.py", {
      args: ["read", pptxFile, "1", "2"],
      packages: { pptx: "python-pptx" },
      filePaths: [pptxFile],
    });

    expect(result.current_page).toBe(1);
    expect(result.page_size).toBe(2);
    expect(result.slides.length).toBe(2);
    expect(result.total_slides).toBe(3);
  });

  it("should get PowerPoint presentation info", async () => {
    const result = await runPythonFile("pptx_handler.py", {
      args: ["info", pptxFile],
      packages: { pptx: "python-pptx" },
      filePaths: [pptxFile],
    });

    expect(result.slides).toBe(3);
    expect(result.file_size).toBeGreaterThan(0);
  });
});

describe("Text File Processing", () => {
  const txtFile = join(__dirname, "..", "examples", "sample_text.txt");
  const csvFile = join(__dirname, "..", "examples", "sample_data.csv");

  it("should read text file content", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["read", txtFile],
      filePaths: [txtFile],
    });

    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
    expect(result.total_lines).toBeGreaterThan(0);
    expect(result.encoding).toBe("utf-8");
  });

  it("should read text file with pagination", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["read", txtFile, "1", "3"],
      filePaths: [txtFile],
    });

    expect(result.success).toBe(true);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(3);
    expect(result.has_more).toBe(true);
  });

  it("should read CSV as structured data", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["read", csvFile],
      filePaths: [csvFile],
    });

    expect(result.success).toBe(true);
    expect(result.headers).toBeDefined();
    expect(result.headers).toEqual(["Name", "Age", "City"]);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBe(5);
    expect(result.data[0]).toHaveProperty("Name");
    expect(result.data[0]).toHaveProperty("Age");
    expect(result.data[0]).toHaveProperty("City");
  });

  it("should read CSV with pagination", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["read", csvFile, "1", "2"],
      filePaths: [csvFile],
    });

    expect(result.success).toBe(true);
    expect(result.page).toBe(1);
    expect(result.page_size).toBe(2);
    expect(result.data.length).toBe(2);
    expect(result.has_more).toBe(true);
  });

  it("should get text file info", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["info", txtFile],
      filePaths: [txtFile],
    });

    expect(result.success).toBe(true);
    expect(result.file_size).toBeGreaterThan(0);
    expect(result.line_count).toBeGreaterThan(0);
    expect(result.file_type).toBe("txt");
  });

  it("should get CSV file info with headers", async () => {
    const result = await runPythonFile("text_handler.py", {
      args: ["info", csvFile],
      filePaths: [csvFile],
    });

    expect(result.success).toBe(true);
    expect(result.file_type).toBe("csv");
    expect(result.headers).toBeDefined();
    expect(result.headers).toEqual(["Name", "Age", "City"]);
    expect(result.total_rows).toBe(5);
    expect(result.total_cols).toBe(3);
  });
});
