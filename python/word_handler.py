"""
Word document handler - read/write DOCX files
"""
import json
import sys
from pathlib import Path

def read_word(file_path: str, page: int = None, page_size: int = 100):
    """Read Word document with optional pagination by paragraphs"""
    from docx import Document
    
    doc = Document(file_path)
    
    # Extract paragraphs
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    
    # Extract tables
    tables = []
    for table in doc.tables:
        table_data = []
        for row in table.rows:
            row_data = [cell.text for cell in row.cells]
            table_data.append(row_data)
        tables.append(table_data)
    
    # Handle pagination for paragraphs
    if page is not None:
        start = (page - 1) * page_size
        end = start + page_size
        paragraphs = paragraphs[start:end]
        total_pages = (len(doc.paragraphs) + page_size - 1) // page_size
    else:
        total_pages = 1
    
    return {
        "paragraphs": paragraphs,
        "tables": tables,
        "total_paragraphs": len(doc.paragraphs),
        "total_tables": len(doc.tables),
        "current_page": page,
        "page_size": page_size if page else None,
        "total_pages": total_pages
    }

def get_word_info(file_path: str):
    """Get Word document metadata"""
    from docx import Document
    
    doc = Document(file_path)
    
    # Count non-empty paragraphs
    para_count = sum(1 for p in doc.paragraphs if p.text.strip())
    
    return {
        "paragraphs": para_count,
        "tables": len(doc.tables),
        "file_size": Path(file_path).stat().st_size
    }

def write_word(file_path: str, paragraphs: list, tables: list = None):
    """Write data to Word document"""
    from docx import Document
    
    doc = Document()
    
    # Add paragraphs
    for text in paragraphs:
        doc.add_paragraph(text)
    
    # Add tables if provided
    if tables:
        for table_data in tables:
            table = doc.add_table(rows=len(table_data), cols=len(table_data[0]) if table_data else 1)
            for i, row_data in enumerate(table_data):
                for j, cell_text in enumerate(row_data):
                    table.rows[i].cells[j].text = str(cell_text)
    
    doc.save(file_path)
    return {"success": True, "file_path": file_path}

if __name__ == "__main__":
    command = sys.argv[1]
    file_path = sys.argv[2]
    
    if command == "read":
        page = int(sys.argv[3]) if len(sys.argv) > 3 else None
        page_size = int(sys.argv[4]) if len(sys.argv) > 4 else 100
        result = read_word(file_path, page, page_size)
    elif command == "info":
        result = get_word_info(file_path)
    elif command == "write":
        paragraphs = json.loads(sys.argv[3])
        tables = json.loads(sys.argv[4]) if len(sys.argv) > 4 else None
        result = write_word(file_path, paragraphs, tables)
    else:
        result = {"error": f"Unknown command: {command}"}
    
    print(json.dumps(result, default=str))
