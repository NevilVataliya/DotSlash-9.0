import multer from "multer";
import { resolve } from "path";

// Set up storage, we can use memory storage or disk.
// For sending directly to Gemini, it's easier to use MemoryStorage to get a buffer
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
});
