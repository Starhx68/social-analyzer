from flask import Flask, request, jsonify
from paddleocr import PaddleOCR
import base64
import io
from PIL import Image
import numpy as np
import logging

app = Flask(__name__)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

ocr = PaddleOCR(
    use_angle_cls=True,
    lang='ch',
    use_space_char=True,
    show_log=False,
    enable_mkldnn=True,
    cpu_threads=4,
    use_gpu=False
)

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'paddleocr'}), 200

@app.route('/ocr/general', methods=['POST'])
def general_ocr():
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        image_data = data['image']
        
        if isinstance(image_data, str):
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            img_array = np.array(image)
        else:
            return jsonify({'error': 'Invalid image format'}), 400
        
        result = ocr.ocr(img_array, cls=True)
        
        texts = []
        for line in result[0]:
            text_info = {
                'text': line[1][0],
                'confidence': float(line[1][1]),
                'box': [[int(p[0]), int(p[1])] for p in line[0]]
            }
            texts.append(text_info)
        
        return jsonify({
            'success': True,
            'results': texts
        }), 200
        
    except Exception as e:
        logger.error(f'OCR error: {str(e)}')
        return jsonify({'error': str(e)}), 500

@app.route('/ocr/sn', methods=['POST'])
def sn_ocr():
    try:
        data = request.get_json()
        
        if not data or 'image' not in data:
            return jsonify({'error': 'No image provided'}), 400
        
        image_data = data['image']
        
        if isinstance(image_data, str):
            image_bytes = base64.b64decode(image_data)
            image = Image.open(io.BytesIO(image_bytes))
            img_array = np.array(image)
        else:
            return jsonify({'error': 'Invalid image format'}), 400
        
        result = ocr.ocr(img_array, cls=True)
        
        sn_texts = []
        for line in result[0]:
            text = line[1][0]
            confidence = float(line[1][1])
            
            filtered_text = ''.join(c for c in text if c.isalnum() or c in '-_/')
            
            if filtered_text and confidence > 0.6:
                sn_texts.append({
                    'text': filtered_text,
                    'confidence': confidence,
                    'box': [[int(p[0]), int(p[1])] for p in line[0]]
                })
        
        sn_texts.sort(key=lambda x: x['confidence'], reverse=True)
        
        return jsonify({
            'success': True,
            'sn_results': sn_texts
        }), 200
        
    except Exception as e:
        logger.error(f'SN OCR error: {str(e)}')
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8868, debug=False)
