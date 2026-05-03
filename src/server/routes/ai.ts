import { Router } from 'express';
import { authenticate } from '../middleware/auth.ts';
import { upload } from '../multer.ts';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const router = Router();

const genAI = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: process.env.GEMINI_API_BASEURL ? { baseUrl: process.env.GEMINI_API_BASEURL } : undefined
});

router.post('/ocr', authenticate, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: '请上传图片' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ message: 'AI 服务未配置' });

  const prompt = `
    请识别这张资产标签图片中的信息，并以 JSON 格式返回。
    要求的字段包括：
    - name: 资产名称
    - asset_code: 资产编码
    - card_code: 卡片编码
    - barcode: 条形码内容
    - org_name: 资产组织
    - dept_name: 管理部门
    - user: 使用人
    
    仅返回 JSON 字符串，不要包含任何 Markdown 说明或代码块。如果某字段未识别到，请返回空字符串。
  `;

  try {
    const response = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: fs.readFileSync(req.file.path).toString("base64"),
                mimeType: req.file.mimetype
              }
            }
          ]
        }
      ]
    });
    
    const text = response.text || '';
    
    // Clean up potential markdown formatting
    const cleanedJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(cleanedJson);

    fs.unlinkSync(req.file.path); // clean up temp upload
    res.json(data);
  } catch (err) {
    console.error('AI OCR error:', err);
    res.status(500).json({ message: 'AI 识别失败' });
  }
});

export default router;
