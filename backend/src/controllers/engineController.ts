import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';

interface CustomRequest extends Request {
    user?: any;
    cookies: {
        authToken?: string;
    };
    query: {
        page?: string;
        limit?: string;
    }
}

const prisma = new PrismaClient();

// --- Function getEnginePrompts (เหมือนเดิม) ---
export const getEnginePrompts = async (req: CustomRequest, res: Response) => {
    // ... (โค้ดเดิม ไม่เปลี่ยนแปลง)
    try {
        let userId: string;

        // ตรวจสอบว่ามี req.user หรือไม่ (จาก Middleware ถ้าใช้)
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

        // --- Pagination Logic ---
        const page = parseInt(req.query.page || '1', 10);
        const allowedLimits = [15, 30, 45, 50];
        let limit = parseInt(req.query.limit || '15', 10); // Default limit = 15
        if (!allowedLimits.includes(limit)) {
            limit = 15; // ถ้า limit ที่ส่งมาไม่ถูกต้อง ใช้ default 15
        }

        const pageNumber = Math.max(1, page);
        const pageSize = Math.max(1, limit);

        const skip = (pageNumber - 1) * pageSize;

        const [prompts, totalPrompts] = await prisma.$transaction([
            prisma.enginePrompt.findMany({
                where: {
                    userId: userId,
                },
                orderBy: {
                    createdAt: 'desc',
                },
                skip: skip,
                take: pageSize,
            }),
            prisma.enginePrompt.count({
                where: {
                    userId: userId,
                },
            }),
        ]);

        const totalPages = Math.ceil(totalPrompts / pageSize);

        res.json({
            data: prompts,
            pagination: {
                currentPage: pageNumber,
                pageSize: pageSize,
                totalItems: totalPrompts,
                totalPages: totalPages,
            },
        });

    } catch (error) {
        console.error('Failed to get prompts:', error);
        res.status(500).json({ message: 'Failed to get prompts' });
    }
};

// --- Function createEnginePrompt (ปรับปรุงสำหรับ Streaming) ---
export const createEnginePrompt = async (req: CustomRequest, res: Response) => {
    let userId: string;
    try {
        // --- ดึง userId (เหมือนเดิม) ---
        if (req.user) {
            userId = req.user.id;
        } else {
            const token = req.cookies.authToken;
            if (!token) {
                // ไม่สามารถส่ง JSON error ได้ทันทีถ้า headers ถูกตั้งค่าสำหรับ SSE แล้ว
                // อาจจะต้อง log หรือหาวิธีส่ง error ผ่าน stream
                console.error('Unauthorized - No token provided');
                res.status(401).end('Unauthorized - No token provided'); // ปิด connection พร้อมสถานะ
                return;
            }
            try {
                const decodedToken: any = jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret');
                userId = decodedToken.id;
            } catch (error) {
                console.error('Unauthorized - Invalid token:', error);
                res.status(401).end('Unauthorized - Invalid token'); // ปิด connection พร้อมสถานะ
                return;
            }
        }

        const { prompt } = req.body;
        if (!prompt) {
             res.status(400).end('Bad Request - Prompt is required');
             return;
        }

        // --- ตั้งค่า Headers สำหรับ SSE ---
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // ส่ง Headers ไปทันที

        let accumulatedResponse = ""; // ตัวแปรสำหรับสะสมข้อความตอบกลับทั้งหมด

        try {
            console.log("Calling Ollama API (Streaming)...");
            const ollamaStreamResponse = await axios.post<Readable>( // คาดหวัง Readable Stream
                'http://localhost:11434/api/generate',
                {
                    model: "llama3.1:8b",
                    prompt: prompt,
                    stream: true, // <<< เปิดใช้งาน Stream
                    system: `คุณคือผู้ช่วยให้คำปรึกษาปัญหาเกี่ยวกับรถยนต์ที่ใจดีและอดทน ตอบคำถามเป็นภาษาไทย กระชับและตรงประเด็น เเละข้อมูลรถที่ถามส่วนใหญ่จะเป็น ยี่ห้อเเละรุ่นรถยนต์ ที่มีขายในเมืองไทยเป็นส่วนใหญ่ หากไม่สามารถให้คำตอบได้ ให้บอกว่า "ผมไม่แน่ใจในเรื่องนี้ ขอยังไม่ให้คำตอบนะครับ/ค่ะ" เท่านั้น`,
                },
                {
                    headers: { 'Content-Type': 'application/json' },
                    responseType: 'stream' // <<< บอก Axios ให้รับเป็น Stream
                }
            );

            // --- จัดการ Stream จาก Ollama ---
            const stream = ollamaStreamResponse.data;

            stream.on('data', (chunkBuffer) => {
              try {
                  const chunk = chunkBuffer.toString('utf-8');

                  // ระบุ Type ของ parameter 'line' ใน filter callback ให้เป็น string
                  const lines: string[] = chunk.split('\n').filter((line: string) => line.trim() !== '');
                                                                  // ^^^^^^^^^^^ แก้ไขตรงนี้

                  // Loop นี้ถูกต้องแล้ว เพราะ lines เป็น string[]
                  for (const line of lines) {
                      try {
                          const parsed = JSON.parse(line);
                          if (parsed.response) {
                              const responseChunk = parsed.response;
                              accumulatedResponse += responseChunk;
                              res.write(`data: ${JSON.stringify({ response: responseChunk })}\n\n`);
                          }
                      } catch (parseError) {
                          // console.warn('Could not parse stream line:', line, parseError);
                      }
                  }
              } catch (error) {
                  console.error('Error processing stream chunk:', error);
                  // ตรวจสอบก่อน write/end เพื่อป้องกัน error 'write after end'
                  if (!res.writableEnded) {
                       res.write(`event: error\ndata: ${JSON.stringify({ message: "Error processing stream" })}\n\n`);
                       stream.destroy(); // หยุด stream ต้นทาง
                       res.end(); // ปิด connection ฝั่ง client
                  } else {
                       console.log("Stream already ended when chunk processing error occurred.");
                       if (!stream.destroyed) stream.destroy(); // Ensure upstream is closed
                  }
              }
          });

          stream.on('end', async () => {
              console.log("Ollama stream ended.");
              try {
                   console.log("Saving complete response to DB...");
                   const newPrompt = await prisma.enginePrompt.create({
                       data: {
                           prompt,
                           response: accumulatedResponse,
                           userId,
                       },
                   });
                   console.log("Saved prompt ID:", newPrompt.id);
                   // ตรวจสอบก่อน write/end
                   if (!res.writableEnded) {
                       res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed", promptId: newPrompt.id })}\n\n`); // อาจจะส่ง ID กลับไปด้วย
                   }
              } catch (dbError) {
                   console.error("Failed to save prompt after stream:", dbError);
                   // ตรวจสอบก่อน write/end
                   if (!res.writableEnded) {
                       res.write(`event: error\ndata: ${JSON.stringify({ message: "Failed to save conversation" })}\n\n`);
                   }
              } finally {
                   // ตรวจสอบก่อน end
                   if (!res.writableEnded) {
                       res.end();
                       console.log("SSE connection closed successfully after stream end.");
                   } else {
                        console.log("SSE connection already ended before stream 'end' processing finished.");
                   }
              }
          });

          stream.on('error', (error) => {
              console.error('Error from Ollama stream:', error);
               // ตรวจสอบก่อน write/end
               if (!res.writableEnded) {
                  res.write(`event: error\ndata: ${JSON.stringify({ message: "Ollama stream error" })}\n\n`);
                  res.end();
                  console.log("SSE connection closed due to Ollama stream error.");
               } else {
                  console.log("SSE connection already ended when Ollama stream error occurred.");
               }
          });

            stream.on('end', async () => {
                console.log("Ollama stream ended.");
                try {
                     // --- บันทึกข้อมูลลง DB เมื่อ Stream จบ ---
                     console.log("Saving complete response to DB...");
                     const newPrompt = await prisma.enginePrompt.create({
                         data: {
                             prompt,
                             response: accumulatedResponse, // ใช้ข้อความที่สะสมไว้
                             userId,
                         },
                     });
                     console.log("Saved prompt ID:", newPrompt.id);
                     // ส่ง event แจ้ง client ว่าจบแล้ว (อาจจะไม่จำเป็น Client เช็คจากการปิด connection ได้)
                     res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed" })}\n\n`);
                } catch (dbError) {
                     console.error("Failed to save prompt after stream:", dbError);
                     // ส่ง event error ถ้าการบันทึก DB ล้มเหลว
                     res.write(`event: error\ndata: ${JSON.stringify({ message: "Failed to save conversation" })}\n\n`);
                } finally {
                     res.end(); // --- ปิด SSE connection ---
                     console.log("SSE connection closed.");
                }
            });

            stream.on('error', (error) => {
                console.error('Error from Ollama stream:', error);
                // ส่ง event error ไปยัง client
                res.write(`event: error\ndata: ${JSON.stringify({ message: "Ollama stream error" })}\n\n`);
                res.end(); // ปิด connection
            });

        } catch (error: unknown) {
            // จัดการ Error จาก axios.post (เช่น Ollama ไม่ทำงาน)
             console.error('Failed to call or connect to Ollama API:', error);
             // ส่ง event error ไปยัง client ก่อนปิด
             res.write(`event: error\ndata: ${JSON.stringify({ message: "Failed to connect to AI service" })}\n\n`);
             res.end(); // ปิด connection

            // ส่วนนี้จะทำงานหาก axios.post fail ตั้งแต่แรก (ก่อน stream เริ่ม)
            // ถ้า Error เกิดระหว่าง stream จะถูก handle ใน stream.on('error')
            // if (error instanceof AxiosError) {
            //     console.error('Axios Error details:', error.response?.data);
            // }
            // ไม่ควรส่ง res.status(500).json() ที่นี่ เพราะ headers ถูกตั้งเป็น event-stream แล้ว
        }

    } catch (error) {
        // Error อื่นๆ ที่ไม่ได้เกิดจาก Ollama call (เช่น การดึง userId)
        console.error('General error in createEnginePrompt:', error);
         // พยายามส่ง error event ถ้า connection ยังเปิดอยู่
        if (!res.writableEnded) {
             try {
                 res.write(`event: error\ndata: ${JSON.stringify({ message: "An internal server error occurred." })}\n\n`);
                 res.end();
             } catch (writeError) {
                 console.error("Failed to write final error to SSE stream:", writeError);
                 if (!res.writableEnded) res.end(); // Ensure connection closes
             }
        } else {
             // ถ้า connection ปิดไปแล้ว ก็แค่ log
             console.log("SSE connection already closed when general error occurred.");
        }
    }
};