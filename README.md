# Docsmith MCP

Python-powered document processing MCP — Process Excel, Word, PDF documents with
ease using Python.

## Features

- **Excel**: Read/write `.xlsx` files with sheet support and pagination
- **Word**: Read/write `.docx` files with paragraph and table support
- **PDF**: Read `.pdf` files with text extraction and pagination
- **Text Files**: Read/write `.txt`, `.csv`, `.md`, `.json`, `.yaml`, `.yml`
  with pagination support
- **Flexible Reading Modes**: Raw full read or paginated for large files
- **Powered by Pyodide**: Runs in secure WebAssembly sandbox via code-runner-mcp

## Installation

```bash
pnpm install
pnpm build
```

## Configuration

Add to your MCP client configuration:

```json
{
  "mcpServers": {
    "docsmith": {
      "command": "node",
      "args": ["/path/to/docsmith-mcp/dist/index.js"],
      "env": {
        "DOC_RAW_FULL_READ": "false",
        "DOC_PAGE_SIZE": "100",
        "DOC_MAX_FILE_SIZE": "50"
      }
    }
  }
}
```

### Environment Variables

| Variable            | Description               | Default |
| ------------------- | ------------------------- | ------- |
| `DOC_RAW_FULL_READ` | Enable full raw read mode | `false` |
| `DOC_PAGE_SIZE`     | Default items per page    | `100`   |
| `DOC_MAX_FILE_SIZE` | Max file size in MB       | `50`    |

## Tools

### read_document

Read document content with automatic format detection.

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

```json
{
  "file_path": "/path/to/output.xlsx",
  "format": "excel",
  "data": [["Header1", "Header2"], ["Value1", "Value2"]]
}
```

### get_document_info

Get document metadata.

```json
{
  "file_path": "/path/to/document.pdf"
}
```

## Architecture

```
docsmith-mcp/
├── python/              # Python handler scripts
│   ├── excel_handler.py
│   ├── word_handler.py
│   └── pdf_handler.py
├── src/
│   ├── index.ts        # MCP server
│   └── code-runner.ts  # code-runner-mcp client
└── dist/               # Built output
```

Python scripts are executed via
[code-runner-mcp](https://github.com/mcpc-tech/code-runner-mcp) in a Pyodide
WebAssembly environment.

## License

MIT
