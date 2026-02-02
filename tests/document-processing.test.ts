import { describe, it, expect } from 'vitest'
import { runPythonFile } from '../src/code-runner.js'

/**
 * Document processing tests using real files from examples/ directory
 * These tests demonstrate reading, getting info, and processing actual documents
 */

describe('Excel Document Processing', () => {
    const excelFile = '/data/examples/sample_sales_data.xlsx'

    it('should read Excel file content', async () => {
        const result = await runPythonFile(
            'excel_handler.py',
            ['read', excelFile],
            { openpyxl: 'openpyxl' }
        )

        expect(result.sheet_name).toBe('Sales Report')
        expect(result.sheets).toContain('Sales Report')
        expect(result.total_rows).toBeGreaterThan(0)
        expect(result.total_cols).toBeGreaterThan(0)
        expect(result.data).toBeDefined()
        expect(Array.isArray(result.data)).toBe(true)
    })

    it('should read Excel file with pagination', async () => {
        const result = await runPythonFile(
            'excel_handler.py',
            ['read', excelFile, 'Sales Report', '1', '3'],
            { openpyxl: 'openpyxl' }
        )

        expect(result.current_page).toBe(1)
        expect(result.page_size).toBe(3)
        expect(result.data.length).toBeLessThanOrEqual(3)
    })

    it('should get Excel file info', async () => {
        const result = await runPythonFile(
            'excel_handler.py',
            ['info', excelFile],
            { openpyxl: 'openpyxl' }
        )

        expect(result.sheets).toBeDefined()
        expect(Array.isArray(result.sheets)).toBe(true)
        expect(result.file_size).toBeGreaterThan(0)
        expect(result.sheets[0].name).toBe('Sales Report')
        expect(result.sheets[0].rows).toBeGreaterThan(0)
        expect(result.sheets[0].cols).toBeGreaterThan(0)
    })
})

describe('Word Document Processing', () => {
    const wordFile = '/data/examples/sample_report.docx'

    it('should read Word document content', async () => {
        const result = await runPythonFile(
            'word_handler.py',
            ['read', wordFile],
            { docx: 'python-docx' }  // Map 'docx' import to 'python-docx' package
        )

        expect(result.paragraphs).toBeDefined()
        expect(Array.isArray(result.paragraphs)).toBe(true)
        expect(result.paragraphs.length).toBeGreaterThan(0)
        expect(result.total_paragraphs).toBeGreaterThan(0)
        expect(result.total_tables).toBeGreaterThan(0)
        expect(result.tables).toBeDefined()
        expect(Array.isArray(result.tables)).toBe(true)
    })

    it('should read Word document with pagination', async () => {
        const result = await runPythonFile(
            'word_handler.py',
            ['read', wordFile, '1', '5'],
            { docx: 'python-docx' }
        )

        expect(result.current_page).toBe(1)
        expect(result.page_size).toBe(5)
        expect(result.paragraphs.length).toBeLessThanOrEqual(5)
    })

    it('should get Word document info', async () => {
        const result = await runPythonFile(
            'word_handler.py',
            ['info', wordFile],
            { docx: 'python-docx' }
        )

        expect(result.paragraphs).toBeGreaterThan(0)
        expect(result.tables).toBeGreaterThan(0)
        expect(result.file_size).toBeGreaterThan(0)
    })
})

describe('PDF Document Processing', () => {
    const pdfFile = '/data/examples/sample_document.pdf'

    it('should read PDF content', async () => {
        const result = await runPythonFile(
            'pdf_handler.py',
            ['read', pdfFile],
            { PyPDF2: 'PyPDF2' }
        )

        expect(result.total_pages).toBeGreaterThan(0)
        expect(result.content).toBeDefined()
        expect(Array.isArray(result.content)).toBe(true)
        expect(result.content.length).toBeGreaterThan(0)
        expect(result.content[0].page_number).toBe(1)
        expect(result.content[0].text).toBeDefined()
    })

    it('should read PDF with pagination', async () => {
        const result = await runPythonFile(
            'pdf_handler.py',
            ['read', pdfFile, '1', '1'],
            { PyPDF2: 'PyPDF2' }
        )

        expect(result.current_page_group).toBe(1)
        expect(result.page_size).toBe(1)
        expect(result.content.length).toBe(1)
    })

    it('should get PDF info', async () => {
        const result = await runPythonFile(
            'pdf_handler.py',
            ['info', pdfFile],
            { PyPDF2: 'PyPDF2' }
        )

        expect(result.pages).toBeGreaterThan(0)
        expect(result.file_size).toBeGreaterThan(0)
        expect(result.total_words).toBeGreaterThan(0)
    })
})
