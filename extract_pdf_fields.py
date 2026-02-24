
import fitz  # PyMuPDF
import sys
import re

def extract_sections(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = ""
        for page in doc:
            text += page.get_text()
        
        # Normalize text (remove excessive newlines but keep structure)
        # text = re.sub(r'\n+', '\n', text)
        
        # Find start and end indices for 4.4 and 4.5
        # We look for "4.4." and "4.6." (or whatever follows 4.5)
        
        output_buffer = []
        
        # Simple string search might be risky if "4.4" appears in text. 
        # But section headers usually are at start of line or distinct.
        
        # Let's try to capture everything from "4.4" to "5."
        
        lines = text.split('\n')
        capturing = False
        
        for line in lines:
            stripped = line.strip()
            # Start capturing at 4.4
            if re.match(r'^4\.4[.\s]', stripped): 
                capturing = True
            
            # Stop capturing at 4.6 or 5.
            if re.match(r'^4\.6[.\s]', stripped) or re.match(r'^5\.[.\s]', stripped):
                capturing = False
            
            if capturing:
                output_buffer.append(line)
        
        with open(r'd:\Temp\guobu\docs\extracted_interface_spec.txt', 'w', encoding='utf-8') as f:
            f.write("\n".join(output_buffer))
            
        print("Extraction complete. Saved to d:\\Temp\\guobu\\docs\\extracted_interface_spec.txt")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    pdf_path = r"d:\Temp\guobu\政策文件\以旧换新2026部平台通用接口-接入技术规范v20251227(1).pdf"
    extract_sections(pdf_path)
