#!/usr/bin/env python3
"""
Text file handler - supports .txt, .csv, .md, .json, .yaml, .yml
Provides structured parsing for CSV and JSON files
"""

import sys
import json
import os
import csv
from io import StringIO


def detect_file_type(file_path):
    """Detect file type from extension."""
    ext = file_path.lower().split('.')[-1] if '.' in file_path else ''
    return ext


def read_text(file_path, page=None, page_size=None):
    """Read text file with optional pagination."""
    try:
        # Detect encoding
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
        content = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise Exception("Could not decode file with any supported encoding")
        
        lines = content.split('\n')
        total_lines = len(lines)
        
        # Pagination
        if page is not None and page_size is not None:
            start = (page - 1) * page_size
            end = start + page_size
            paginated_lines = lines[start:end]
            has_more = end < total_lines
            
            return {
                "success": True,
                "content": '\n'.join(paginated_lines),
                "total_lines": total_lines,
                "page": page,
                "page_size": page_size,
                "has_more": has_more,
                "encoding": used_encoding
            }
        else:
            return {
                "success": True,
                "content": content,
                "total_lines": total_lines,
                "encoding": used_encoding
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


def read_csv(file_path, page=None, page_size=None):
    """Read CSV file and return structured data."""
    try:
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
        content = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise Exception("Could not decode file with any supported encoding")
        
        # Parse CSV
        reader = csv.reader(StringIO(content))
        rows = list(reader)
        
        if not rows:
            return {
                "success": True,
                "headers": [],
                "data": [],
                "total_rows": 0,
                "encoding": used_encoding
            }
        
        headers = rows[0]
        data_rows = rows[1:]
        total_rows = len(data_rows)
        
        # Convert to list of dicts
        structured_data = []
        for row in data_rows:
            row_dict = {}
            for i, header in enumerate(headers):
                row_dict[header] = row[i] if i < len(row) else ""
            structured_data.append(row_dict)
        
        # Pagination
        if page is not None and page_size is not None:
            start = (page - 1) * page_size
            end = start + page_size
            paginated_data = structured_data[start:end]
            has_more = end < total_rows
            
            return {
                "success": True,
                "headers": headers,
                "data": paginated_data,
                "total_rows": total_rows,
                "page": page,
                "page_size": page_size,
                "has_more": has_more,
                "encoding": used_encoding
            }
        else:
            return {
                "success": True,
                "headers": headers,
                "data": structured_data,
                "total_rows": total_rows,
                "encoding": used_encoding
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


def read_json(file_path):
    """Read JSON file and return parsed object."""
    try:
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
        content = None
        used_encoding = None
        
        for encoding in encodings:
            try:
                with open(file_path, 'r', encoding=encoding) as f:
                    content = f.read()
                used_encoding = encoding
                break
            except UnicodeDecodeError:
                continue
        
        if content is None:
            raise Exception("Could not decode file with any supported encoding")
        
        parsed = json.loads(content)
        
        return {
            "success": True,
            "data": parsed,
            "encoding": used_encoding
        }
    except json.JSONDecodeError as e:
        return {"success": False, "error": f"Invalid JSON: {str(e)}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_text(file_path, content):
    """Write content to text file."""
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return {"success": True, "message": "File written successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_csv(file_path, data):
    """Write data to CSV file."""
    try:
        if isinstance(data, str):
            data = json.loads(data)
        
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            if data and len(data) > 0:
                writer = csv.DictWriter(f, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
        return {"success": True, "message": "CSV file written successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def write_json(file_path, data):
    """Write data to JSON file."""
    try:
        if isinstance(data, str):
            data = json.loads(data)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"success": True, "message": "JSON file written successfully"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def get_info(file_path):
    """Get text file metadata."""
    try:
        stat = os.stat(file_path)
        file_type = detect_file_type(file_path)
        
        # Try to detect encoding and count lines
        encodings = ['utf-8', 'utf-8-sig', 'gbk', 'gb2312', 'latin-1']
        line_count = 0
        encoding = None
        
        for enc in encodings:
            try:
                with open(file_path, 'r', encoding=enc) as f:
                    content = f.read()
                    line_count = len(content.split('\n'))
                encoding = enc
                break
            except UnicodeDecodeError:
                continue
        
        result = {
            "success": True,
            "file_size": stat.st_size,
            "line_count": line_count,
            "encoding": encoding or "unknown",
            "file_type": file_type
        }
        
        # Add type-specific info
        if file_type == 'csv':
            try:
                with open(file_path, 'r', encoding=encoding or 'utf-8') as f:
                    reader = csv.reader(f)
                    rows = list(reader)
                    if rows:
                        result['headers'] = rows[0]
                        result['total_rows'] = len(rows) - 1
                        result['total_cols'] = len(rows[0])
            except:
                pass
        elif file_type == 'json':
            try:
                with open(file_path, 'r', encoding=encoding or 'utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        result['item_count'] = len(data)
                    elif isinstance(data, dict):
                        result['key_count'] = len(data.keys())
            except:
                pass
        
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No command specified"}))
        return
    
    command = sys.argv[1]
    
    if command == "read":
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "No file path specified"}))
            return
        
        file_path = sys.argv[2]
        page = int(sys.argv[3]) if len(sys.argv) > 3 else None
        page_size = int(sys.argv[4]) if len(sys.argv) > 4 else None
        
        file_type = detect_file_type(file_path)
        
        if file_type == 'csv':
            result = read_csv(file_path, page, page_size)
        elif file_type == 'json':
            result = read_json(file_path)
        else:
            result = read_text(file_path, page, page_size)
        
        print(json.dumps(result))
    
    elif command == "write":
        if len(sys.argv) < 4:
            print(json.dumps({"success": False, "error": "Insufficient arguments"}))
            return
        
        file_path = sys.argv[2]
        content = sys.argv[3]
        
        file_type = detect_file_type(file_path)
        
        if file_type == 'csv':
            result = write_csv(file_path, content)
        elif file_type == 'json':
            result = write_json(file_path, content)
        else:
            result = write_text(file_path, content)
        
        print(json.dumps(result))
    
    elif command == "info":
        if len(sys.argv) < 3:
            print(json.dumps({"success": False, "error": "No file path specified"}))
            return
        
        file_path = sys.argv[2]
        result = get_info(file_path)
        print(json.dumps(result))
    
    else:
        print(json.dumps({"success": False, "error": f"Unknown command: {command}"}))


if __name__ == "__main__":
    main()
