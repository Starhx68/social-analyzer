const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const axios = require('axios');
const config = require('../config');
const db = require('../config/database');
const sharp = require('sharp');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: config.image.maxSize
  }
});

// Helper function for SiliconFlow OCR
async function callSiliconFlowOCR(imageBase64, prompt) {
  if (!config.ocr.siliconFlow.apiKey) {
    throw new Error('未配置 SiliconFlow API Key');
  }

  const response = await axios.post(
    `${config.ocr.siliconFlow.baseUrl}/chat/completions`,
    {
      model: config.ocr.siliconFlow.model,
      messages: [
        {
          "role": "user",
          "content": [
            {
              "type": "image_url",
              "image_url": {
                "url": imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`
              }
            },
            {
              "type": "text",
              "text": prompt
            }
          ]
        }
      ],
      max_tokens: 4096
    },
    {
      headers: {
        'Authorization': `Bearer ${config.ocr.siliconFlow.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 60000 // Increased timeout for external API
    }
  );

  return response.data.choices[0].message.content;
}

// Helper function for SiliconFlow Text LLM
async function callSiliconFlowTextLLM(text, prompt) {
  if (!config.ocr.siliconFlow.apiKey) {
    throw new Error('未配置 SiliconFlow API Key');
  }

  const response = await axios.post(
    `${config.ocr.siliconFlow.baseUrl}/chat/completions`,
    {
      model: config.ocr.siliconFlow.textModel,
      messages: [
        {
          "role": "user",
          "content": `${prompt}\n\n待处理文本:\n${text}`
        }
      ],
      max_tokens: 1024
    },
    {
      headers: {
        'Authorization': `Bearer ${config.ocr.siliconFlow.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  return response.data.choices[0].message.content;
}

router.post('/sn', auth, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供图片' });
    }
    
    if (config.ocr.serviceProvider === 'siliconflow') {
      try {
        // Preprocess: Auto-rotate image based on EXIF data
        let processedBase64 = imageBase64;
        try {
          // Remove data URI prefix if present
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Rotate based on EXIF and convert to PNG
          const rotatedBuffer = await sharp(buffer)
            .rotate() 
            .png()
            .toBuffer();
            
          processedBase64 = rotatedBuffer.toString('base64');
          console.log('Image auto-rotation preprocessing completed');
        } catch (rotateError) {
          console.warn('Image rotation failed, proceeding with original image:', rotateError.message);
        }

        // Step 1: Use Vision Model to get raw text
        const rawOcrText = await callSiliconFlowOCR(processedBase64, '请识别图片中的所有文字，按阅读顺序输出。');
        console.log('============== OCR 原始识别结果 (Vision Model) ==============');
        console.log(rawOcrText);
        console.log('===========================================================');
        
        // Step 2: Use Text Model to extract SN
        const snText = await callSiliconFlowTextLLM(rawOcrText, '请从上述OCR识别结果中提取产品序列号（SN码/IMEI码/机器编码）。\n规则：\n1. 通常包含字母和数字的组合。\n2. 可能以SN、S/N、IMEI、No.等开头，也可能没有。\n3. 忽略无关的中文说明。\n4. 一般SN号码为图片中最长且连续的字符串。\n5. 必须为连续的字符，中间不能有任何空格和标点符号。\n6. 只返回提取到的序列号字符串，不要解释。如果找不到，返回空字符串。');
        
        const cleanText = snText.trim();
        console.log('============== SN 提取结果 (Text Model) ====================');
        console.log(cleanText);
        console.log('===========================================================');
        // Return result in a format compatible with frontend
        const results = cleanText ? [{
          text: cleanText,
          confidence: 1.0, 
          box: [[0, 0], [0, 0], [0, 0], [0, 0]]
        }] : [];

        res.json({
          success: true,
          results: results
        });
      } catch (error) {
        console.error('SiliconFlow OCR Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'OCR服务调用失败: ' + (error.response?.data?.error?.message || error.message) });
      }
    } else {
      // Default to PaddleOCR (Mock or Real)
      const response = await axios.post(
        `${config.ocr.paddleocrUrl}/ocr/sn`,
        { image: imageBase64 },
        { timeout: 30000 }
      );
      
      if (response.data.success) {
        const snResults = response.data.sn_results.map(result => ({
          text: result.text,
          confidence: result.confidence,
          box: result.box
        }));
        
        res.json({
          success: true,
          results: snResults
        });
      } else {
        res.status(500).json({ error: 'OCR识别失败' });
      }
    }
  } catch (error) {
    console.error('OCR识别错误:', error);
    res.status(500).json({ error: 'OCR服务不可用' });
  }
});

router.post('/general', auth, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供图片' });
    }
    
    if (config.ocr.serviceProvider === 'siliconflow') {
      try {
        const text = await callSiliconFlowOCR(imageBase64, 'OCR this image. Convert to markdown.');
        
        res.json({
          success: true,
          results: [{
             text: text,
             confidence: 1.0,
             box: [[0, 0], [0, 0], [0, 0], [0, 0]]
          }]
        });
      } catch (error) {
        console.error('SiliconFlow OCR Error:', error.response?.data || error.message);
        res.status(500).json({ error: 'OCR服务调用失败: ' + (error.response?.data?.error?.message || error.message) });
      }
    } else {
      const response = await axios.post(
        `${config.ocr.paddleocrUrl}/ocr/general`,
        { image: imageBase64 },
        { timeout: 30000 }
      );
      
      if (response.data.success) {
        res.json({
          success: true,
          results: response.data.results
        });
      } else {
        res.status(500).json({ error: 'OCR识别失败' });
      }
    }
  } catch (error) {
    console.error('OCR识别错误:', error);
    res.status(500).json({ error: 'OCR服务不可用' });
  }
});

router.post('/order-no', auth, upload.single('file'), async (req, res) => {
  try {
    let imageBase64;
    
    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
    } else if (req.body.imageBase64) {
      imageBase64 = req.body.imageBase64;
    }
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供图片' });
    }
    
    if (config.ocr.serviceProvider === 'siliconflow') {
      try {
        // Preprocess: Auto-rotate image based on EXIF data
        let processedBase64 = imageBase64;
        try {
          // Remove data URI prefix if present
          const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Rotate based on EXIF and convert to PNG
          const rotatedBuffer = await sharp(buffer)
            .rotate() 
            .png()
            .toBuffer();
            
          processedBase64 = rotatedBuffer.toString('base64');
          console.log('Image auto-rotation preprocessing completed for order-no');
        } catch (rotateError) {
          console.warn('Image rotation failed, proceeding with original image:', rotateError.message);
        }

        // Step 1: Vision Model OCR
        const rawOcrText = await callSiliconFlowOCR(processedBase64, '请识别图片中的所有文字，按阅读顺序输出。');
        
        // Step 2: Extract Order Number
        const prompt = '请从上述OCR识别结果中提取订单号或运单号。\n规则：\n1. 通常为较长的纯数字或字母数字组合。\n2. 可能以"订单号"、"运单号"、"No."等开头。\n3. 如果有多个数字串，优先提取最像订单号的那一个（通常10-30位）。\n4. 忽略手机号（11位，1开头）。\n5. 只返回提取到的号码字符串，不要解释。如果找不到，返回空字符串。';
        const orderNo = await callSiliconFlowTextLLM(rawOcrText, prompt);
        
        res.json({
          success: true,
          results: [{ text: orderNo.trim() }]
        });
      } catch (error) {
        console.error('SiliconFlow OCR Error:', error);
        res.status(500).json({ error: 'OCR服务调用失败' });
      }
    } else {
      // Fallback or other providers
      res.status(501).json({ error: '暂不支持该OCR模式' });
    }
  } catch (error) {
    console.error('OCR识别错误:', error);
    res.status(500).json({ error: 'OCR服务不可用' });
  }
});

router.post('/materials/:id/process', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { ocrType = 'sn' } = req.body;
    
    const materialResult = await db.query(
      'SELECT * FROM materials WHERE id = $1',
      [id]
    );
    
    if (materialResult.rows.length === 0) {
      return res.status(404).json({ error: '资料不存在' });
    }
    
    const material = materialResult.rows[0];

    const orderResult = await db.query(
      'SELECT organization_id, ven_code FROM orders WHERE id = $1',
      [material.order_id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ error: '订单不存在' });
    }

    const order = orderResult.rows[0];
    const isPrivilegedOrg = !!req.user.is_privileged_organization;
    if (!isPrivilegedOrg) {
      const sameOrgById = order.organization_id && order.organization_id === req.user.organization_id;
      const sameOrgByVenCode =
        order.ven_code &&
        req.user.organization_code &&
        order.ven_code.toLowerCase() === req.user.organization_code.toLowerCase();

      if (!sameOrgById && !sameOrgByVenCode) {
        return res.status(403).json({ error: '无权处理该订单资料' });
      }
    }
    
    const response = await axios.get(material.file_url, { responseType: 'arraybuffer' });
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    
    let ocrResult = '';
    let ocrConfidence = 0;
    let allResults = [];

    if (config.ocr.serviceProvider === 'siliconflow') {
        if (ocrType === 'sn') {
            const rawOcrText = await callSiliconFlowOCR(base64, '请识别图片中的所有文字，按阅读顺序输出。');
            const snText = await callSiliconFlowTextLLM(rawOcrText, '请从上述OCR识别结果中提取产品序列号（SN码/IMEI码/机器编码）。\n规则：\n1. 通常包含字母和数字的组合。\n2. 可能以SN、S/N、IMEI、No.等开头，也可能没有。\n3. 忽略无关的中文说明。\n4. 一般SN号码为图片中最长且连续的字符串。\n5. 必须为连续的字符，中间不能有任何空格和标点符号。\n6. 只返回提取到的序列号字符串，不要解释。如果找不到，返回空字符串。');
            
            ocrResult = snText.trim();
            ocrConfidence = 1.0;
            allResults = [{ text: ocrResult, confidence: 1.0 }];
        } else if (ocrType === 'imei') {
            const rawOcrText = await callSiliconFlowOCR(base64, '请识别图片中的所有文字，按阅读顺序输出。');
            const imeiJson = await callSiliconFlowTextLLM(rawOcrText, '请从上述OCR识别结果中提取IMEI1和IMEI2码。\n规则：\n1. IMEI1码通常在"IMEI1"字样之后。\n2. IMEI2码通常在"IMEI2"字样之后。\n3. 如果只有"IMEI"且只有一行，则视为IMEI1。\n4. 请返回JSON格式，包含imei1和imei2两个字段。\n5. 如果未找到对应的值，字段值设为空字符串。\n6. 只返回JSON字符串，不要包含Markdown格式（如```json）。');
            
            try {
                const cleanedJson = imeiJson.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanedJson);
                ocrResult = JSON.stringify(parsed); // Store as JSON string in ocrResult for DB consistency? Or just use the object structure? 
                // The frontend expects ocrResult to be the value to set.
                // For SN, it's a string. For IMEI, let's return the object in allResults or a specific field.
                // But wait, the DB column ocr_result stores JSON string of { text: ... }.
                // Here I will store the whole object.
                ocrResult = cleanedJson; 
                ocrConfidence = 1.0;
                allResults = [{ text: cleanedJson, confidence: 1.0, type: 'imei_json' }];
            } catch (e) {
                console.error('Failed to parse IMEI JSON:', imeiJson);
                ocrResult = "{}";
                ocrConfidence = 0;
            }
        } else {
            const text = await callSiliconFlowOCR(base64, 'OCR this image. Convert to markdown.');
            ocrResult = text.trim();
            ocrConfidence = 1.0;
            allResults = [{ text: ocrResult, confidence: 1.0 }];
        }
    } else {
        const ocrResponse = await axios.post(
            `${config.ocr.paddleocrUrl}/ocr/${ocrType}`,
            { image: base64 },
            { timeout: 30000 }
        );

        if (ocrResponse.data.success) {
            allResults = ocrType === 'sn' 
                ? ocrResponse.data.sn_results 
                : ocrResponse.data.results;
            
            if (allResults && allResults.length > 0) {
                const bestResult = allResults[0];
                ocrResult = bestResult.text;
                ocrConfidence = bestResult.confidence;
            }
        } else {
             throw new Error('OCR识别失败');
        }
    }
      
    await db.query(
    `UPDATE materials
        SET ocr_result = $1, ocr_confidence = $2, is_ocr_processed = true, ocr_processed_at = NOW()
        WHERE id = $3`,
    [JSON.stringify({ text: ocrResult }), ocrConfidence, id]
    );
    
    res.json({
    success: true,
    ocrResult,
    ocrConfidence,
    allResults: allResults
    });

  } catch (error) {
    console.error('OCR处理错误:', error);
    res.status(500).json({ error: 'OCR服务不可用: ' + error.message });
  }
});

router.post('/preprocess', auth, async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: '请提供图片' });
    }
    
    const buffer = Buffer.from(imageBase64, 'base64');
    
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    let processedImage = image;
    
    processedImage = processedImage.grayscale();
    
    processedImage = processedImage.normalize();
    
    processedImage = processedImage.sharpen();
    
    const processedBuffer = await processedImage
      .png({ quality: 90, compressionLevel: 6 })
      .toBuffer();
    
    const processedBase64 = processedBuffer.toString('base64');
    
    res.json({
      success: true,
      processedImage: processedBase64,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: 'png'
      }
    });
  } catch (error) {
    console.error('图像预处理错误:', error);
    res.status(500).json({ error: '图像预处理失败' });
  }
});

module.exports = router;
