# docsmith-mcp

[![npm version](https://img.shields.io/npm/v/docsmith-mcp.svg)](https://www.npmjs.com/package/docsmith-mcp)

Python-powered document processing MCP with MCP Apps — Process Excel, Word, PDF, PowerPoint documents with ease using Python, and view them beautifully through an interactive MCP App.

## Features

- **Excel**: Read/write `.xlsx` files with sheet support and pagination
- **Word**: Read/write `.docx` files with paragraph and table support
- **PDF**: Read `.pdf` files with text extraction and pagination
- **PowerPoint**: Read `.pptx` files with slide content extraction
- **Text Files**: Read/write `.txt`, `.csv`, `.md`, `.json`, `.yaml`, `.yml` with pagination support
- **MCP App**: Beautiful React + Tailwind CSS app for viewing all document types
- **HTTP Server**: Serve documents via HTTP/SSE with MCP integration
- **Flexible Reading Modes**: Raw full read or paginated for large files
- **Powered by Pyodide**: Runs in secure WebAssembly sandbox via code-runner-mcp

## Quick Start

### MCP Configuration

Add to your MCP client configuration (e.g., Claude Desktop, Cline, etc.):

**Via npx (recommended):**
```json
{
  "mcpServers": {
    "docsmith": {
      "command": "npx",
      "args": ["-y", "docsmith-mcp"],
      "env": {
        "DOC_PAGE_SIZE": "100"
      }
    }
  }
}
```

**Via global installation:**
```bash
npm install -g docsmith-mcp
```

```json
{
  "mcpServers": {
    "docsmith": {
      "command": "docsmith-mcp",
      "env": {
        "DOC_PAGE_SIZE": "100"
      }
    }
  }
}
```

**Via local path:**
```json
{
  "mcpServers": {
    "docsmith": {
      "command": "node",
      "args": ["/path/to/docsmith-mcp/dist/index.js"]
    }
  }
}
```

Then use the `read_document` tool:

```json
{
  "file_path": "/path/to/document.xlsx",
  "mode": "paginated",
  "page": 1,
  "page_size": 50
}
```

The MCP App will automatically open to display the document content beautifully.

## Supported Formats

| Format | Extensions | Read | Write | Notes |
|--------|-----------|------|-------|-------|
| Excel | `.xlsx` | ✅ | ✅ | Multi-sheet support, pagination |
| Word | `.docx` | ✅ | ✅ | Paragraphs and tables |
| PDF | `.pdf` | ✅ | ❌ | Text extraction with pagination |
| PowerPoint | `.pptx` | ✅ | ❌ | Slide content extraction |
| CSV | `.csv` | ✅ | ✅ | - |
| Text | `.txt`, `.md` | ✅ | ✅ | Pagination support |
| JSON | `.json` | ✅ | ✅ | - |
| YAML | `.yaml`, `.yml` | ✅ | ✅ | - |

## Tools

### read_document

Read document content with automatic format detection.

**Parameters:**
- `file_path` (string, required): Path to the document
- `mode` (string, optional): `"paginated"` or `"raw"` (default: `"paginated"`)
- `page` (number, optional): Page number for paginated mode (default: 1)
- `page_size` (number, optional): Items per page (default: 100)
- `sheet_name` (string, optional): Sheet name for Excel files

**Example:**
```json
{
  "file_path": "/path/to/document.xlsx",
  "mode": "paginated",
  "page": 1,
  "page_size": 50,
  "sheet_name": "Sheet1"
}
```

### write_document

Write document content.

**Parameters:**
- `file_path` (string, required): Output path
- `format` (string, required): `"excel"`, `"word"`, `"csv"`, `"txt"`, `"json"`, `"yaml"`
- `data` (array/object, required): Document content

**Example:**
```json
{
  "file_path": "/path/to/output.xlsx",
  "format": "excel",
  "data": [
    ["Product", "Q1", "Q2"],
    ["Laptop", 100, 150],
    ["Mouse", 500, 600]
  ]
}
```

### get_document_info

Get document metadata without reading full content.

**Parameters:**
- `file_path` (string, required): Path to the document

**Example:**
```json
{
  "file_path": "/path/to/document.pdf"
}
```

## MCP App

The built-in MCP App provides a beautiful, interactive interface for viewing documents:

- **Excel**: Interactive tables with sticky headers
- **PDF**: Page-by-page text viewing
- **Word**: Paragraph and table rendering
- **PowerPoint**: Slide navigation

Built with React 19, Tailwind CSS v4, and Lucide icons.

## Configuration

Environment variables for customizing behavior:

| Variable | Description | Default |
|----------|-------------|---------|
| `DOC_RAW_FULL_READ` | Enable full raw read mode | `false` |
| `DOC_PAGE_SIZE` | Default items per page | `100` |
| `DOC_MAX_FILE_SIZE` | Max file size in MB | `50` |

## HTTP Mode

For HTTP/SSE transport, start the server:

```bash
npx docsmith-mcp http 3000
```

Endpoints:
- `http://localhost:3000/mcp` - MCP over HTTP/SSE
- `http://localhost:3000/health` - Health check

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup and contribution guidelines.

## License

MIT
