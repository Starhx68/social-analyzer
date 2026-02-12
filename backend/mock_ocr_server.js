const express = require('express');
const app = express();
const port = 8868;

app.use(express.json({ limit: '50mb' }));

app.post('/ocr/sn', (req, res) => {
  console.log('收到 SN OCR 请求');
  // 模拟返回一个 SN 码
  setTimeout(() => {
    res.json({
      success: true,
      sn_results: [
        {
          text: 'SN88888888',
          confidence: 0.99,
          box: [[0, 0], [100, 0], [100, 20], [0, 20]]
        }
      ]
    });
  }, 1000);
});

app.post('/ocr/general', (req, res) => {
  console.log('收到通用 OCR 请求');
  setTimeout(() => {
    res.json({
      success: true,
      results: [
        {
          text: '模拟通用文字识别结果',
          confidence: 0.95,
          box: [[0, 0], [100, 0], [100, 20], [0, 20]]
        }
      ]
    });
  }, 1000);
});

app.listen(port, () => {
  console.log(`Mock OCR Server running at http://localhost:${port}`);
});
