import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Filename: [Org]-[AssetCode]-[Date].jpg
    // We get metadata from req.body but multer runs before req.body is fully parsed if not handled carefully
    // Usually we use the asset code if available in the field
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const ext = path.extname(file.originalname) || '.jpg';
    
    // We might not have the code yet in some cases, so we'll use a temp name and rename later if needed
    // or rely on a specific field in the form
    cb(null, `upload_${Date.now()}${ext}`);
  }
});

export const upload = multer({ storage });
