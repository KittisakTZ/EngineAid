import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { AxiosError } from 'axios';

interface CustomRequest extends Request {
  user?: any;
  cookies: {
    authToken?: string;
  };
}

const prisma = new PrismaClient();

export const getEnginePrompts = async (req: CustomRequest, res: Response) => {
  try {
    let userId: string;

    // ตรวจสอบว่ามี req.user หรือไม่
    if (req.user) {
      userId = req.user.id;
    } else {
      // ถ้าไม่มี req.user ให้พยายามดึง userId จาก Cookie
      const token = req.cookies.authToken;
      if (!token) {
        return res.status(401).json({ message: 'Unauthorized - No token provided' });
      }

      try {
        // ถอดรหัส Token เพื่อดึง userId
        const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
        userId = decodedToken.id;  // ดึง userId จาก Token (อาจต้องเปลี่ยน property name)
      } catch (error) {
        return res.status(401).json({ message: 'Unauthorized - Invalid token' });
      }
    }

    const prompts = await prisma.enginePrompt.findMany({
      where: {
        userId: userId,
      },
    });
    res.json(prompts);
  } catch (error) {
    console.error('Failed to get prompts:', error);
    res.status(500).json({ message: 'Failed to get prompts' });
  }
};

export const createEnginePrompt = async (req: CustomRequest, res: Response) => {
  try {
      let userId: string;

      // ตรวจสอบว่ามี req.user หรือไม่
      if (req.user) {
          userId = req.user.id;
      } else {
          // ถ้าไม่มี req.user ให้พยายามดึง userId จาก Cookie
          const token = req.cookies.authToken;
          if (!token) {
              return res.status(401).json({ message: 'Unauthorized - No token provided' });
          }

          try {
              // ถอดรหัส Token เพื่อดึง userId
              const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
              userId = decodedToken.id;
          } catch (error) {
              return res.status(401).json({ message: 'Unauthorized - Invalid token' });
          }
      }

      const { prompt } = req.body;

      try {
        console.log("Calling Ollama API...");
        const response = await axios.post(
            'http://localhost:11434/api/generate',
            {
                model: "llama3.1:8b",
                prompt: prompt,
                stream: false,
                system: `คุณคือผู้ช่วยให้คำปรึกษาปัญหาเกี่ยวกับรถยนต์ที่ใจดีและอดทน ตอบคำถามเป็นภาษาไทย กระชับและตรงประเด็น เเละข้อมูลรถที่ถามส่วนใหญ่จะเป็น ยี่ห้อเเละรุ่นรถยนต์ ที่มีขายในเมืองไทยเป็นส่วนใหญ่ หากไม่สามารถให้คำตอบได้ ให้บอกว่า "ผมไม่แน่ใจในเรื่องนี้ ขอยังไม่ให้คำตอบนะครับ/ค่ะ" เท่านั้น`,
                // format: "json",  // ลบ format: "json" ถ้ายังไม่ได้ผล
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
    
        let aiResponse = "";
        try {
            console.log("Response Data:", response.data);
            aiResponse = response.data.response; // ดึงเฉพาะ response ที่เป็น String
        } catch (error) {
            console.error("Error parsing response:", error);
            aiResponse = response.data.toString(); // fallback (แต่ควรจะใช้กรณี JSON parsing error เท่านั้น)
        }
    
        const newPrompt = await prisma.enginePrompt.create({
            data: {
                prompt,
                response: aiResponse,
                userId,
            },
        });
        res.status(201).json(newPrompt);
    } catch (error: unknown) {
        if (error instanceof AxiosError) {
            console.error('Failed to call Ollama API:', error);
            console.error('Error detail:', error.response?.data);
        } else {
            console.error('An unexpected error occurred:', error);
        }
        res.status(500).json({ message: 'Failed to call Ollama API' });
    }
  } catch (error) {
      console.error('Failed to create prompt:', error);
      res.status(500).json({ message: 'Failed to create prompt' });
  }
};