import express, { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middlewares/authMiddleware';
import { getEnginePrompts, createEnginePrompt, deleteEnginePrompt, CustomRequest } from '../controllers/engineController';

const router: Router = express.Router();

// เอา authenticate ออก ถ้าไม่ต้องการตรวจสอบ Token
// router.use(authenticate);

// แก้ไขการเรียกใช้ Route Handler ให้ถูกต้อง
router.get('/prompts', async (req: Request, res: Response) => {
  try {
    await getEnginePrompts(req, res);
  } catch (error) {
    console.error('Error in /prompts route:', error);
    res.status(500).json({ message: 'Failed to get prompts' });
  }
});

router.post('/prompts', async (req: Request, res: Response) => {
  try {
    await createEnginePrompt(req, res);
  } catch (error) {
    console.error('Error in /prompts route:', error);
    res.status(500).json({ message: 'Failed to create prompt' });
  }
});

router.delete('/prompts/:id', async (req: Request, res: Response) => {
  try {
    await deleteEnginePrompt(req as CustomRequest, res);
  } catch (error) {
     if (!res.headersSent) {
         res.status(500).json({ message: 'Failed to delete prompt' });
     }
  }
});

export { router as engineRoutes };