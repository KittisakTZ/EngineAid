import { Request, Response } from 'express';
import { PrismaClient, EnginePrompt } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';

// --- Interface (เพิ่ม headers.authorization) ---
interface CustomRequest extends Request {
    user?: any; // จาก Middleware ถ้ามี
    cookies: {
        authToken?: string;
    };
    query: {
        page?: string;
        limit?: string;
    }
    headers: Request['headers'] & { // ทำให้เข้าถึง authorization ได้ง่ายขึ้น
        authorization?: string;
    };
}

const prisma = new PrismaClient();

// --- Function getEnginePrompts (ไม่ต้องแก้) ---
export const getEnginePrompts = async (req: CustomRequest, res: Response) => {
    let userId: string | null = null;
    let authError: string | null = null;
    try {
        // 1. ตรวจสอบ Auth Header ก่อน
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (tokenFromHeader) {
            console.log("[Auth GET] Found token in Authorization header. Verifying...");
            try {
                const decodedToken: any = jwt.verify(tokenFromHeader, process.env.JWT_SECRET || 'your_jwt_secret');
                if (decodedToken && decodedToken.id) {
                    userId = decodedToken.id;
                    console.log("[Auth GET] User ID verified from header token:", userId);
                } else { authError = 'Unauthorized - Invalid token payload'; }
            } catch (error) {
                console.error("[Auth GET] Error verifying token from header:", error);
                authError = 'Unauthorized - Invalid or expired token';
            }
        } else {
            console.log("[Auth GET] No Bearer token in Authorization header.");
            // 2. (ทางเลือก) ตรวจสอบ Cookie
            const tokenFromCookie = req.cookies.authToken;
             if (tokenFromCookie) {
                 console.log("[Auth GET] Found token in cookie. Verifying...");
                 try {
                     const decodedToken: any = jwt.verify(tokenFromCookie, process.env.JWT_SECRET || 'your_jwt_secret');
                      if (decodedToken && decodedToken.id) {
                         userId = decodedToken.id;
                         console.log("[Auth GET] User ID verified from cookie token:", userId);
                      } else { authError = 'Unauthorized - Invalid token payload from cookie';}
                 } catch (error) {
                     console.error("[Auth GET] Error verifying token from cookie:", error);
                     authError = 'Unauthorized - Invalid or expired token from cookie';
                 }
             } else {
                console.log("[Auth GET] No token found in cookie either.");
                if (!authError) { authError = 'Unauthorized - No token provided'; }
             }
        }

        // 3. ตรวจสอบผลลัพธ์
        if (!userId) {
            const errorMessage = authError || 'Unauthorized';
            console.error("[Auth GET] Authentication failed:", errorMessage);
            return res.status(401).json({ message: errorMessage }); // ตอบ JSON ปกติ ไม่ใช่ SSE
        }

        // --- ดำเนินการต่อถ้า Auth สำเร็จ ---
        console.log(`[GET Prompts] User ${userId} authenticated.`);
        // --- Pagination Logic ---
        const page = parseInt(req.query.page || '1', 10);
        const allowedLimits = [15, 30, 45, 50];
        let limit = parseInt(req.query.limit || '15', 10);
        if (!allowedLimits.includes(limit)) { limit = 15; }
        const pageNumber = Math.max(1, page);
        const pageSize = Math.max(1, limit);
        const skip = (pageNumber - 1) * pageSize;

        const [prompts, totalPrompts] = await prisma.$transaction([
            prisma.enginePrompt.findMany({
                where: { userId: userId }, // ใช้ userId ที่ได้มา
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: pageSize,
            }),
            prisma.enginePrompt.count({ where: { userId: userId } }), // ใช้ userId ที่ได้มา
        ]);

        const totalPages = Math.ceil(totalPrompts / pageSize);

        res.json({
            data: prompts,
            pagination: { currentPage: pageNumber, pageSize, totalItems: totalPrompts, totalPages },
        });

    } catch (error) {
        console.error('[Error GET Prompts] Failed to get prompts:', error);
        res.status(500).json({ message: 'Failed to get prompts' });
    }
};


// --- Function createEnginePrompt (ฉบับเต็ม - *Simplify Payload*) ---
export const createEnginePrompt = async (req: CustomRequest, res: Response) => {
    let userId: string | null = null;
    let authError: string | null = null;

    // ----------------------------------------------------
    // ส่วนที่ 1: ตรวจสอบ Authentication และดึง userId
    // ----------------------------------------------------
    try {
        // 1.1 ตรวจสอบ Authorization Header (Bearer Token) เป็นอันดับแรก
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (tokenFromHeader) {
            console.log("[Auth POST] Found token in Authorization header. Verifying...");
            try {
                const decodedToken: any = jwt.verify(tokenFromHeader, process.env.JWT_SECRET || 'your_jwt_secret');
                if (decodedToken && decodedToken.id) {
                     userId = decodedToken.id;
                     console.log("[Auth POST] User ID verified from header token:", userId);
                } else {
                    console.error("[Auth POST] Decoded token from header is invalid or missing ID.");
                    authError = 'Unauthorized - Invalid token payload';
                }
            } catch (error) {
                console.error("[Auth POST] Error verifying token from header:", error);
                authError = 'Unauthorized - Invalid or expired token';
            }
        } else {
            console.log("[Auth POST] No Bearer token in Authorization header.");
            // ถ้าเน้น Mobile App อย่างเดียว และไม่ต้องการ Fallback ไป Cookie
            authError = 'Unauthorized - No token provided';
            // (เอาส่วนเช็ค Cookie ออก หรือ Comment ไว้ ถ้าไม่ใช้)
        }

        // 1.2 ตรวจสอบผลลัพธ์ Authentication
        if (!userId) {
            const errorMessage = authError || 'Unauthorized';
            console.error("[Auth POST] Authentication failed:", errorMessage);
            res.status(401).end(errorMessage); // ส่ง 401 และจบ SSE
            return;
        }

        // ----------------------------------------------------
        // ส่วนที่ 2: ถ้า Authentication สำเร็จ ดำเนินการต่อ
        // ----------------------------------------------------
        console.log(`[Prompt] User ${userId} authenticated. Processing prompt.`);
        const { prompt } = req.body;

        if (!prompt) {
            console.error(`[Prompt] User ${userId} did not provide a prompt.`);
            res.status(400).end('Bad Request - Prompt is required');
            return;
       }

        // ตั้งค่า Headers สำหรับ Server-Sent Events
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        let accumulatedResponse = "";

        // ----------------------------------------------------
        // ส่วนที่ 3: เรียก Ollama API และจัดการ Stream (ใช้ Payload แบบง่าย)
        // ----------------------------------------------------
        try {
            console.log(`[Ollama] User ${userId} calling Ollama API (Streaming - Simplified Payload)...`);

            // vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv
            // --- Payload แบบง่าย: ใช้ prompt ตรงๆ ---
            const ollamaPayload = {
                model: "llama3.1:8b",
                prompt: prompt, // <<< ยังใช้ prompt ตรงๆ
                stream: true,
                system: `คุณคือผู้ช่วยให้คำปรึกษาปัญหาเกี่ยวกับรถยนต์ที่ใจดีและอดทน ตอบคำถามเป็นภาษาไทย กระชับและตรงประเด็น เเละข้อมูลรถที่ถามส่วนใหญ่จะเป็น ยี่ห้อเเละรุ่นรถยนต์ ที่มีขายในเมืองไทยเป็นส่วนใหญ่ หากไม่สามารถให้คำตอบได้ ให้บอกว่า "ผมไม่แน่ใจในเรื่องนี้ ขอยังไม่ให้คำตอบนะครับ/ค่ะ" เท่านั้น` // <<< เพิ่ม system กลับมา
            };
            // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

            console.log("[Ollama Payload]:", JSON.stringify(ollamaPayload)); // Log Payload ที่จะส่ง

            const ollamaStreamResponse = await axios.post<Readable>(
                process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate',
                ollamaPayload,
                {
                    headers: { 'Content-Type': 'application/json' },
                    responseType: 'stream'
                }
            );

            const stream = ollamaStreamResponse.data;

            // จัดการเมื่อมีข้อมูลเข้ามาจาก Stream
            stream.on('data', (chunkBuffer) => {
                try {
                    const chunk = chunkBuffer.toString('utf-8');
                    console.log("[Ollama Raw Chunk]:", chunk); // Log ข้อมูลดิบ

                    const lines: string[] = chunk.split('\n').filter((line: string) => line.trim() !== '');

                    for (const line of lines) {
                        try {
                            const parsed = JSON.parse(line);
                            console.log("[Ollama Parsed Line]:", JSON.stringify(parsed)); // Log ข้อมูลที่ Parse แล้ว

                            // ตรวจสอบ format ที่ Ollama ส่งกลับ (คาดว่าจะเป็น response เมื่อส่ง prompt ตรงๆ)
                            let responseChunk = "";
                            if (parsed.response) { // <<< เน้นตรวจสอบ response key ก่อน
                                console.log("[Ollama Format Check] Found 'response' key");
                                responseChunk = parsed.response;
                            } else if (parsed.message && parsed.message.content) {
                                console.log("[Ollama Format Check] Found 'message.content' key");
                                responseChunk = parsed.message.content; // เผื่อไว้
                            } else {
                                console.log("[Ollama Format Check] Did not find expected keys ('response' or 'message.content')");
                            }

                            // **สำคัญ:** แม้ response key จะมี แต่ค่าอาจจะยังเป็น "" ถ้า Ollama ยัง load
                            if (typeof responseChunk === 'string') { // ตรวจสอบว่าเป็น string ก่อน (ป้องกัน error ถ้าได้ค่าอื่น)
                                accumulatedResponse += responseChunk;
                                // ส่ง *เฉพาะ* chunk ที่มีเนื้อหาจริงๆ (ไม่ส่ง chunk ที่ response เป็น "")
                                if (responseChunk.trim() !== "" && !res.writableEnded) {
                                     console.log(`[SSE Data] Writing chunk: ${responseChunk.substring(0, 50)}...`);
                                     res.write(`data: ${JSON.stringify({ response: responseChunk })}\n\n`);
                                }
                            }
                        } catch (parseError) {
                           console.warn('[Ollama Stream] Could not parse line JSON:', line, parseError);
                        }
                    }
                } catch (error) {
                    console.error('[Ollama Stream] Error processing chunk:', error);
                    if (!res.writableEnded) {
                         res.write(`event: error\ndata: ${JSON.stringify({ message: "Error processing stream" })}\n\n`);
                         if (!stream.destroyed) stream.destroy();
                         res.end();
                    }
                }
            });

            // จัดการเมื่อ Stream จบลง
            stream.on('end', async () => {
                console.log(`[Ollama Stream] Stream ended for user ${userId}.`);
                try {
                    // ตรวจสอบ userId และ accumulatedResponse ก่อนบันทึก
                    if (userId !== null && accumulatedResponse.trim() !== "") {
                        console.log(`[DB] Saving complete response to DB for user ${userId}...`);
                        const newPrompt = await prisma.enginePrompt.create({
                            data: {
                                prompt: prompt,
                                response: accumulatedResponse,
                                userId: userId, // userId ตรงนี้เป็น string แล้ว
                            },
                        });
                        console.log(`[DB] Saved prompt ID: ${newPrompt.id} for user ${userId}`);
                        if (!res.writableEnded) {
                            res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed", promptId: newPrompt.id })}\n\n`);
                        }
                    } else if (userId !== null) {
                        console.log(`[DB] Skipping save for user ${userId} because response was empty.`);
                        if (!res.writableEnded) {
                             // ส่ง done event แม้จะไม่ได้บันทึก แต่แจ้งว่า stream จบ
                             res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed (response was empty)" })}\n\n`);
                        }
                    } else {
                        console.error(`[DB] Cannot save prompt because userId is null unexpectedly.`);
                         if (!res.writableEnded) {
                            res.write(`event: error\ndata: ${JSON.stringify({ message: "Internal server error: User context lost" })}\n\n`);
                         }
                    }
                } catch (dbError) {
                    console.error(`[DB] Failed to save prompt for user ${userId}:`, dbError);
                    if (!res.writableEnded) {
                        res.write(`event: error\ndata: ${JSON.stringify({ message: "Failed to save conversation" })}\n\n`);
                    }
                } finally {
                    if (!res.writableEnded) {
                        res.end(); // ปิด SSE connection
                        console.log(`[SSE] Connection closed successfully after stream end for user ${userId}.`);
                    } else {
                         console.log(`[SSE] Connection already ended before stream 'end' processing finished for user ${userId}.`);
                    }
                }
            });

            // จัดการเมื่อเกิด Error ใน Stream
            stream.on('error', (error) => {
                console.error(`[Ollama Stream] Error from Ollama stream for user ${userId}:`, error);
                 if (!res.writableEnded) {
                    res.write(`event: error\ndata: ${JSON.stringify({ message: "Ollama stream error" })}\n\n`);
                    res.end();
                    console.log(`[SSE] Connection closed due to Ollama stream error for user ${userId}.`);
                 } else {
                    console.log(`[SSE] Connection already ended when Ollama stream error occurred for user ${userId}.`);
                 }
            });

        } catch (ollamaApiError: unknown) { // Error ตอนเรียก axios.post
            console.error(`[Ollama] Failed to call or connect to Ollama API for user ${userId}:`, ollamaApiError);
            if (!res.writableEnded) {
                 const errorMessage = (ollamaApiError instanceof Error) ? ollamaApiError.message : "Failed to connect to AI service";
                  // Check if it's an AxiosError to provide more details
                  if (ollamaApiError instanceof AxiosError) {
                       console.error('[Ollama] Axios Error details:', ollamaApiError.response?.data);
                       // Send specific error from Axios if available
                       res.write(`event: error\ndata: ${JSON.stringify({ message: `AI Service Error: ${ollamaApiError.response?.statusText || ollamaApiError.message}`})}\n\n`);
                  } else {
                       res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
                  }

                 res.end();
                 console.log(`[SSE] Connection closed due to Ollama API call failure for user ${userId}.`);
            }
        }

    } catch (generalError) { // Error ทั่วไปอื่นๆ
        console.error('[Error] General error in createEnginePrompt:', generalError);
        if (!res.writableEnded) {
             try {
                 res.status(500).end('Internal Server Error');
             } catch (writeError) {
                 console.error("[Error] Failed to write final error:", writeError);
                 if (!res.writableEnded) res.end();
             }
        } else {
             console.log("[Error] SSE connection already closed when general error occurred.");
        }
    }
};