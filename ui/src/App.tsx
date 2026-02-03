import { useEffect, useState, useCallback } from 'react';
import { App as MCPApp } from '@modelcontextprotocol/ext-apps';
import { FileSpreadsheet, FileText, Presentation, File, Loader2, FolderOpen, AlertCircle, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

// Types
interface DocumentData {
  file_path?: string;
  file_type?: string;
  total_pages?: number;
  total_rows?: number;
  word_count?: number;
  sheets?: string[];
  sheet_name?: string;
  data?: { header?: string[]; rows?: any[][] };
  header?: string[];
  rows?: any[][];
  pages?: Array<{ page_number?: number; text?: string; content?: string }>;
  paragraphs?: string[];
  tables?: Array<{ header?: string[]; rows?: any[][] }>;
  slides?: Array<{ title?: string; content?: string; notes?: string }>;
}

type FileType = 'excel' | 'pdf' | 'word' | 'pptx';
type ViewState = 'loading' | 'empty' | 'error' | 'ready';

const FILE_CONFIG: Record<FileType, { icon: typeof FileSpreadsheet; label: string; color: string }> = {
  excel: { icon: FileSpreadsheet, label: 'Excel', color: 'bg-emerald-500' },
  pdf: { icon: FileText, label: 'PDF', color: 'bg-rose-500' },
  word: { icon: File, label: 'Word', color: 'bg-blue-500' },
  pptx: { icon: Presentation, label: 'PowerPoint', color: 'bg-amber-500' },
};

export default function App() {
  const [mcpApp] = useState(() => new MCPApp({ name: 'Document Viewer', version: '1.0.0' }));
  const [state, setState] = useState<ViewState>('loading');
  const [error, setError] = useState<string>('');
  const [data, setData] = useState<DocumentData | null>(null);
  const [fileType, setFileType] = useState<FileType>('excel');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSheet, setCurrentSheet] = useState<string | null>(null);

  const detectFileType = useCallback((path?: string): FileType => {
    if (!path) return 'excel';
    const ext = path.toLowerCase().split('.').pop() || '';
    if (ext === 'pdf') return 'pdf';
    if (['docx', 'doc'].includes(ext)) return 'word';
    if (['pptx', 'ppt'].includes(ext)) return 'pptx';
    return 'excel';
  }, []);

  const handleData = useCallback((newData: DocumentData) => {
    setData(newData);
    setFileType(newData.file_type as FileType || detectFileType(newData.file_path));
    setState('ready');
  }, [detectFileType]);

  const loadData = useCallback(async () => {
    if (!data?.file_path) return;
    try {
      const result = await mcpApp.callServerTool({
        name: 'read_document',
        arguments: {
          file_path: data.file_path,
          file_type: fileType,
          mode: 'paginated',
          page: currentPage,
          page_size: 100,
          sheet_name: currentSheet,
        },
      });
      const text = result.content?.find((c: any) => c.type === 'text')?.text;
      if (text) handleData(JSON.parse(text));
    } catch (err: any) {
      setError(err.message);
      setState('error');
    }
  }, [mcpApp, data?.file_path, fileType, currentPage, currentSheet, handleData]);

  useEffect(() => {
    const init = async () => {
      try {
        await mcpApp.connect();
        mcpApp.ontoolresult = (result: any) => {
          const text = result.content?.find((c: any) => c.type === 'text')?.text;
          if (text) {
            try { handleData(JSON.parse(text)); } 
            catch { setError('Failed to parse data'); setState('error'); }
          }
          if (result.structuredContent) handleData(result.structuredContent);
        };
        setTimeout(() => { if (!data) setState('empty'); }, 5000);
      } catch (err: any) {
        setError(err.message);
        setState('error');
      }
    };
    init();
  }, [mcpApp, handleData, data]);

  const fileName = data?.file_path?.split('/').pop() || data?.file_path?.split('\\').pop() || 'Untitled';
  const config = FILE_CONFIG[fileType];
  const Icon = config.icon;

  // Render states
  if (state === 'loading') return <LoadingState />;
  if (state === 'empty') return <EmptyState />;
  if (state === 'error') return <ErrorState message={error} />;

  return (
    <div className="h-screen flex flex-col p-4 gap-4">
      {/* Header */}
      <header className="bg-surface rounded-xl shadow-sm border border-border p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 ${config.color} rounded-lg flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-primary truncate max-w-xs">{fileName}</h1>
            <div className="text-xs text-muted flex gap-3">
              <span>{config.label}</span>
              {data?.total_pages && <span>• {data.total_pages} pages</span>}
              {data?.total_rows && <span>• {data.total_rows} rows</span>}
              {data?.word_count && <span>• {data.word_count} words</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 bg-surface rounded-xl shadow-sm border border-border flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-neutral-50">
          {/* Sheet Selector */}
          {fileType === 'excel' && data?.sheets && data.sheets.length > 1 && (
            <>
              <select
                value={currentSheet || data.sheet_name || ''}
                onChange={(e) => { setCurrentSheet(e.target.value); setCurrentPage(1); }}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-surface cursor-pointer hover:border-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
              >
                {data.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="w-px h-6 bg-border" />
            </>
          )}

          {/* Pagination */}
          {(data?.total_pages || 0) > 1 && (
            <>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted px-2">
                  {currentPage} / {data.total_pages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(data?.total_pages || 1, p + 1))}
                  disabled={currentPage >= (data?.total_pages || 1)}
                  className="p-1.5 rounded-lg hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="w-px h-6 bg-border" />
            </>
          )}

          {/* Refresh */}
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-neutral-100 cursor-pointer transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-4">
          {fileType === 'excel' && <ExcelViewer data={data} />}
          {fileType === 'pdf' && <PdfViewer data={data} />}
          {fileType === 'word' && <WordViewer data={data} />}
          {fileType === 'pptx' && <PptxViewer data={data} />}
        </div>
      </main>
    </div>
  );
}

// Sub-components
function LoadingState() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
      <p className="text-sm text-muted">Loading document...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center">
        <FolderOpen className="w-8 h-8 text-muted" />
      </div>
      <div>
        <h2 className="font-semibold text-primary mb-1">No Document Loaded</h2>
        <p className="text-sm text-muted max-w-sm">Use the read_document tool to view Excel, PDF, Word, or PowerPoint files</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
      </div>
      <div>
        <h2 className="font-semibold text-primary mb-1">Error</h2>
        <p className="text-sm text-muted max-w-sm">{message}</p>
      </div>
    </div>
  );
}

function ExcelViewer({ data }: { data: DocumentData | null }) {
  const tableData = data?.data || data;
  const header = tableData?.header || [];
  const rows = tableData?.rows || [];

  if (!rows.length) return <p className="text-sm text-muted text-center py-8">No data available</p>;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 sticky top-0">
          <tr>
            {header.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-medium text-primary border-b border-border whitespace-nowrap">{h || ''}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-neutral-50 transition-colors">
              {row.map((cell: any, j: number) => (
                <td key={j} className="px-4 py-2 border-b border-border text-secondary">{cell ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PdfViewer({ data }: { data: DocumentData | null }) {
  const pages = data?.pages || [];
  if (!pages.length) return <p className="text-sm text-muted text-center py-8">No pages available</p>;

  return (
    <div className="space-y-4">
      {pages.map((page, i) => (
        <article key={i} className="p-5 bg-neutral-50 rounded-lg border-l-4 border-accent">
          <h3 className="text-sm font-semibold text-accent mb-3">Page {page.page_number || i + 1}</h3>
          <p className="text-sm text-secondary whitespace-pre-wrap leading-relaxed">{page.text || page.content || ''}</p>
        </article>
      ))}
    </div>
  );
}

function WordViewer({ data }: { data: DocumentData | null }) {
  const paragraphs = data?.paragraphs || [];
  const tables = data?.tables || [];

  if (!paragraphs.length && !tables.length) {
    return <p className="text-sm text-muted text-center py-8">No content available</p>;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-primary leading-relaxed">{p}</p>
      ))}
      {tables.map((table, i) => (
        <div key={i} className="p-4 bg-neutral-50 rounded-lg">
          <h4 className="text-sm font-medium text-primary mb-3">Table {i + 1}</h4>
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white">
                <tr>
                  {(table.header || []).map((h, j) => (
                    <th key={j} className="px-3 py-2 text-left font-medium border-b border-border">{h || ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(table.rows || []).map((row, j) => (
                  <tr key={j} className="hover:bg-white transition-colors">
                    {row.map((cell: any, k: number) => (
                      <td key={k} className="px-3 py-2 border-b border-border text-secondary">{cell ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function PptxViewer({ data }: { data: DocumentData | null }) {
  const slides = data?.slides || [];
  if (!slides.length) return <p className="text-sm text-muted text-center py-8">No slides available</p>;

  return (
    <div className="space-y-4">
      {slides.map((slide, i) => (
        <article key={i} className="p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-200">
          <h3 className="font-semibold text-amber-600 mb-3 pb-2 border-b border-amber-200">
            Slide {i + 1}{slide.title && `: ${slide.title}`}
          </h3>
          <p className="text-sm text-secondary leading-relaxed">{slide.content || ''}</p>
          {slide.notes && (
            <div className="mt-4 p-3 bg-white/60 rounded-lg text-xs text-muted border-l-2 border-accent">
              <strong>Notes:</strong> {slide.notes}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
