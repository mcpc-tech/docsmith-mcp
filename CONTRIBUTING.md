# Contributing to docsmith-mcp

Thank you for your interest in contributing to docsmith-mcp!

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/docsmith-mcp.git
cd docsmith-mcp

# Install dependencies
pnpm install

# Build the project
pnpm build
```

### Development Scripts

```bash
# Build for production
pnpm build

# Build only UI
pnpm build:ui

# Run HTTP server in development mode
pnpm run dev:server http 3000

# Run tests
pnpm test
```

## MCP Client Configuration

For local development, add to your MCP client:

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

## Project Structure

```
docsmith-mcp/
├── python/                # Python handler scripts
│   ├── excel_handler.py
│   ├── word_handler.py
│   ├── pdf_handler.py
│   └── pptx_handler.py
├── src/
│   ├── index.ts          # MCP stdio server
│   ├── server-http.ts    # MCP HTTP/SSE server
│   └── code-runner.ts    # code-runner-mcp client
├── ui/                   # React + Tailwind MCP App
│   ├── src/
│   │   ├── App.tsx       # Main document viewer component
│   │   ├── main.tsx      # React entry
│   │   └── index.css     # Tailwind styles
│   └── index.html
└── dist/                 # Built output
    ├── index.js          # Stdio server
    ├── server-http.js    # HTTP server
    └── ui/index.html     # Bundled MCP App (single file)
```

## Architecture

Python scripts are executed via [code-runner-mcp](https://github.com/mcpc-tech/code-runner-mcp) in a Pyodide WebAssembly environment.

## MCP App Development

The MCP App is built with:
- **React 19** + TypeScript
- **Tailwind CSS v4** - Modern utility-first styling
- **Lucide React** - Professional SVG icons
- **UI Pro Max design system** - Minimal, data-dense dashboard aesthetic

### UI Development

```bash
# Start Vite dev server for UI development
cd ui && pnpm dev
```

### Building UI

```bash
pnpm build:ui
```

This creates a single-file bundle at `dist/ui/index.html` using `vite-plugin-singlefile`.

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Code Style

- TypeScript strict mode enabled
- Follow existing code patterns
- Add types for all new functions and interfaces

## Testing

```bash
pnpm test
```

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
