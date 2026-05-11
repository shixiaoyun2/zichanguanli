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
    - name: 资产名称 (如：笔记本电脑、办公椅)
    - asset_code: 资产编码 (通常是条码下的数字，如：固定资产-2023-0001)
    - card_code: 卡片编码 (如果有)
    - barcode: 条形码内容 (如果不确定，与 asset_code 保持一致)
    - org_name: 资产组织 (如：某某有限公司)
    - dept_name: 管理部门 (如：技术部、财务部)
    - location_name: 存放地点/位置 (如：北京总部 A座 302)
    - model: 规格型号 (如：MacBook Pro 14", 2023款)
    - user: 使用人/领用人 (姓名)
    
    仅返回 JSON 字符串，不要包含任何 Markdown 说明或代码块。如果某字段未识别到，请返回空字符串。
  `;

  try {
    const response = await genAI.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
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
  } catch (err: any) {
    console.error('AI OCR error:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    // Provide more detailed error info
    const status = err.status || 500;
    const errorMessage = err.message || 'AI 识别失败';
    const detail = err.response?.data || null;

    res.status(status).json({ 
      message: 'AI 识别失败', 
      error: errorMessage,
      detail: detail
    });
  }
});

export default router;
