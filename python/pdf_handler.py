"""
PDF document handler - read PDF files using PyPDF2
"""
import json
import sys
from pathlib import Path

def read_pdf(file_path: str, page: int = None, page_size: int = 100):
    """Read PDF with optional pagination by pages"""
    from PyPDF2 import PdfReader
    
    reader = PdfReader(file_path)
    total_pages = len(reader.pages)
    
    # Handle pagination
    if page is not None:
        start_page = (page - 1) * page_size
        end_page = min(start_page + page_size, total_pages)
        pages_to_read = range(start_page, end_page)
        current_page = page
        total_page_groups = (total_pages + page_size - 1) // page_size
    else:
        pages_to_read = range(total_pages)
        current_page = None
        total_page_groups = 1
    
    content = []
    for i in pages_to_read:
        page_obj = reader.pages[i]
        text = page_obj.extract_text()
        content.append({
            "page_number": i + 1,
            "text": text or "",
            "words": len(text.split()) if text else 0
        })
    
    return {
        "total_pages": total_pages,
        "current_page_group": current_page,
        "page_size": page_size if page else None,
        "total_page_groups": total_page_groups,
        "content": content
    }

def get_pdf_info(file_path: str):
    """Get PDF metadata"""
    from PyPDF2 import PdfReader
    
    reader = PdfReader(file_path)
    info = {
        "pages": len(reader.pages),
        "file_size": Path(file_path).stat().st_size
    }
    
    # Try to get PDF metadata
    if reader.metadata:
        info["metadata"] = {k: str(v) for k, v in reader.metadata.items()}
    
    # Count total words
    total_words = 0
    for page in reader.pages:
        text = page.extract_text() or ""
        total_words += len(text.split())
    info["total_words"] = total_words
    
    return info

if __name__ == "__main__":
    command = sys.argv[1]
    file_path = sys.argv[2]
    
    if command == "read":
        page = int(sys.argv[3]) if len(sys.argv) > 3 else None
        page_size = int(sys.argv[4]) if len(sys.argv) > 4 else 10
        result = read_pdf(file_path, page, page_size)
    elif command == "info":
        result = get_pdf_info(file_path)
    else:
        result = {"error": f"Unknown command: {command}"}
    
    print(json.dumps(result, default=str))
