import { Request, Response } from 'express';
import { PrismaClient, EnginePrompt, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';
import axios, { AxiosError } from 'axios';
import { Readable } from 'stream';
import { Prisma } from '@prisma/client';

export interface CustomRequest extends Request {
    user?: {
        id: string;
        role: Role;
    };
    cookies: {
        authToken?: string;
    };
    query: {
        page?: string;
        limit?: string;
    }
    params: {
        id?: string;
    }
    headers: Request['headers'] & {
        authorization?: string;
    };
}

interface DecodedTokenPayload {
    id: string;
    email: string;
    role: Role;
    iat: number;
    exp: number;
}

const prisma = new PrismaClient();

export const getEnginePrompts = async (req: CustomRequest, res: Response) => {
    let userId: string | null = null;
    let userRole: Role | null = null;
    let authError: string | null = null;
    try {
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (tokenFromHeader) {
            try {
                const decodedToken = jwt.verify(tokenFromHeader, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                if (decodedToken && decodedToken.id && decodedToken.role) {
                    userId = decodedToken.id;
                    userRole = decodedToken.role; 
                } else { authError = 'Unauthorized - Invalid token payload'; }
            } catch (error) {
                authError = 'Unauthorized - Invalid or expired token';
            }
        } else {
            const tokenFromCookie = req.cookies.authToken;
             if (tokenFromCookie) {
                 try {
                     const decodedToken = jwt.verify(tokenFromCookie, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                      if (decodedToken && decodedToken.id && decodedToken.role) {
                         userId = decodedToken.id;
                         userRole = decodedToken.role; 
                      } else { authError = 'Unauthorized - Invalid token payload from cookie';}
                 } catch (error) {
                     authError = 'Unauthorized - Invalid or expired token from cookie';
                 }
             } else {
                if (!authError) { authError = 'Unauthorized - No token provided'; }
             }
        }

        if (!userId || !userRole) {
            const errorMessage = authError || 'Unauthorized';
            return res.status(401).json({ message: errorMessage });
        }
        const page = parseInt(req.query.page || '1', 10);
        const allowedLimits = [15, 30, 45, 50];

        let limit = parseInt(req.query.limit || '15', 10);
        if (!allowedLimits.includes(limit)) { limit = 15; }
        const pageNumber = Math.max(1, page);
        const pageSize = Math.max(1, limit);
        const skip = (pageNumber - 1) * pageSize;

        const [prompts, totalPrompts] = await prisma.$transaction([
            prisma.enginePrompt.findMany({
                orderBy: { createdAt: 'desc' },
                skip: skip,
                take: pageSize,
            }),
            prisma.enginePrompt.count({
            }),
        ]);

        const totalPages = Math.ceil(totalPrompts / pageSize);

        console.log(`[GET Prompts] User ${userId} (Role: ${userRole}) fetched page ${pageNumber} (all prompts).`);

        res.json({
            data: prompts,
            pagination: { currentPage: pageNumber, pageSize, totalItems: totalPrompts, totalPages },
        });

    } catch (error) {
        console.error('[Error GET Prompts]', error);
        res.status(500).json({ message: 'Failed to get prompts' });
    }
};

export const createEnginePrompt = async (req: CustomRequest, res: Response) => {
     let userId: string | null = null;
     let authError: string | null = null;

     try {
         const authHeader = req.headers.authorization;
         const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

         if (tokenFromHeader) {
             try {
                  const decodedToken = jwt.verify(tokenFromHeader, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                  if (decodedToken && decodedToken.id) {
                      userId = decodedToken.id;
                  } else {
                      authError = 'Unauthorized - Invalid token payload';
                  }
             } catch (error) {
                 authError = 'Unauthorized - Invalid or expired token';
             }
         } else {
             const tokenFromCookie = req.cookies.authToken;
             if (tokenFromCookie) {
                 try {
                     const decodedToken = jwt.verify(tokenFromCookie, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                     if (decodedToken && decodedToken.id) {
                         userId = decodedToken.id;
                         authError = null;
                     } else { authError = 'Unauthorized - Invalid token payload from cookie';}
                 } catch (error) {
                     authError = 'Unauthorized - Invalid or expired token from cookie';
                 }
             } else {
                if (!authError) { authError = 'Unauthorized - No token provided'; }
             }
         }

         if (!userId) {
             const errorMessage = authError || 'Unauthorized';
             res.status(401).end(errorMessage);
             return;
         }

         const { prompt } = req.body;

         if (!prompt) {
             res.status(400).end('Bad Request - Prompt is required');
             return;
        }

         res.setHeader('Content-Type', 'text/event-stream');
         res.setHeader('Cache-Control', 'no-cache');
         res.setHeader('Connection', 'keep-alive');
         res.flushHeaders();

         let accumulatedResponse = "";

         try {

             const ollamaPayload = {
                 model: "llama3.1:8b",
                 prompt: prompt,
                 stream: true,
                 system: `คุณคือผู้ช่วยให้คำปรึกษาปัญหาเกี่ยวกับรถยนต์ที่ใจดีและอดทน ตอบคำถามเป็นภาษาไทย กระชับและตรงประเด็น เเละข้อมูลรถที่ถามส่วนใหญ่จะเป็น ยี่ห้อเเละรุ่นรถยนต์ ที่มีขายในเมืองไทยเป็นส่วนใหญ่ หากไม่สามารถให้คำตอบได้ ให้บอกว่า "ผมไม่แน่ใจในเรื่องนี้ ขอยังไม่ให้คำตอบนะครับ/ค่ะ" เท่านั้น`
             };

             const ollamaStreamResponse = await axios.post<Readable>(
                 process.env.OLLAMA_API_URL || 'http://localhost:11434/api/generate',
                 ollamaPayload,
                 {
                     headers: { 'Content-Type': 'application/json' },
                     responseType: 'stream'
                 }
             );

             const stream = ollamaStreamResponse.data;

             stream.on('data', (chunkBuffer) => {
                 try {
                     const chunk = chunkBuffer.toString('utf-8');
                     const lines: string[] = chunk.split('\n').filter((line: string) => line.trim() !== '');

                     for (const line of lines) {
                         try {
                             const parsed = JSON.parse(line);
                             let responseChunk = "";
                             if (parsed.response) {
                                 responseChunk = parsed.response;
                             } else if (parsed.message && parsed.message.content) {
                                 responseChunk = parsed.message.content;
                             }

                             if (typeof responseChunk === 'string') {
                                 accumulatedResponse += responseChunk;
                                 if (responseChunk.trim() !== "" && !res.writableEnded) {
                                      res.write(`data: ${JSON.stringify({ response: responseChunk })}\n\n`);
                                 }
                             }
                         } catch (parseError) {
                            // Ignore parse errors
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

             stream.on('end', async () => {
                 try {
                     if (userId !== null && accumulatedResponse.trim() !== "") {
                         const newPrompt = await prisma.enginePrompt.create({
                             data: {
                                 prompt: prompt,
                                 response: accumulatedResponse,
                                 userId: userId,
                             },
                         });
                         if (!res.writableEnded) {
                             res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed", promptId: newPrompt.id })}\n\n`);
                         }
                     } else if (userId !== null) {
                         if (!res.writableEnded) {
                              res.write(`event: done\ndata: ${JSON.stringify({ message: "Stream completed (response was empty)" })}\n\n`);
                         }
                     } else {
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
                         res.end();
                     }
                 }
             });

             stream.on('error', (error) => {
                 console.error(`[Ollama Stream] Error from Ollama stream for user ${userId}:`, error);
                  if (!res.writableEnded) {
                     res.write(`event: error\ndata: ${JSON.stringify({ message: "Ollama stream error" })}\n\n`);
                     res.end();
                  }
             });

         } catch (ollamaApiError: unknown) {
             console.error(`[Ollama] Failed to call or connect to Ollama API for user ${userId}:`, ollamaApiError);
             if (!res.writableEnded) {
                  const errorMessage = (ollamaApiError instanceof Error) ? ollamaApiError.message : "Failed to connect to AI service";
                   if (ollamaApiError instanceof AxiosError) {
                       console.error('[Ollama] Axios Error details:', ollamaApiError.response?.data);
                        res.write(`event: error\ndata: ${JSON.stringify({ message: `AI Service Error: ${ollamaApiError.response?.statusText || ollamaApiError.message}`})}\n\n`);
                   } else {
                        res.write(`event: error\ndata: ${JSON.stringify({ message: errorMessage })}\n\n`);
                   }
                  res.end();
             }
         }

     } catch (generalError) {
         console.error('[Error] General error in createEnginePrompt:', generalError);
         if (!res.writableEnded) {
              try {
                  res.status(500).end('Internal Server Error');
              } catch (writeError) {
                  console.error("[Error] Failed to write final error:", writeError);
                  if (!res.writableEnded) res.end();
              }
         }
     }
};

export const deleteEnginePrompt = async (req: CustomRequest, res: Response) => {
    let userId: string | null = null;
    let userRole: Role | null = null;
    let authError: string | null = null;
    const { id: promptId } = req.params;

    if (!promptId) {
        return res.status(400).json({ message: 'Bad Request: Prompt ID is required' });
    }

    try {
        const authHeader = req.headers.authorization;
        const tokenFromHeader = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

        if (tokenFromHeader) {
            try {
                const decodedToken = jwt.verify(tokenFromHeader, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                if (decodedToken && decodedToken.id && decodedToken.role) {
                    userId = decodedToken.id;
                    userRole = decodedToken.role;
                } else {
                    authError = 'Unauthorized - Invalid token payload';
                }
            } catch (error) {
                authError = 'Unauthorized - Invalid or expired token';
            }
        } else {
            const tokenFromCookie = req.cookies.authToken;
            if (tokenFromCookie) {
                try {
                    const decodedToken = jwt.verify(tokenFromCookie, process.env.JWT_SECRET || 'your_jwt_secret') as DecodedTokenPayload;
                    if (decodedToken && decodedToken.id && decodedToken.role) {
                        userId = decodedToken.id;
                        userRole = decodedToken.role;
                        authError = null;
                    } else {
                        authError = 'Unauthorized - Invalid token payload from cookie';
                    }
                } catch (error) {
                    authError = 'Unauthorized - Invalid or expired token from cookie';
                }
            } else {
                if (!authError) {
                    authError = 'Unauthorized - No token provided';
                }
            }
        }

        if (!userId || !userRole) {
            const errorMessage = authError || 'Unauthorized';
            return res.status(401).json({ message: errorMessage });
        }

        const promptToDelete = await prisma.enginePrompt.findUnique({
            where: { id: promptId },
        });

        if (!promptToDelete) {
            return res.status(404).json({ message: 'Prompt not found' });
        }

        if (promptToDelete.userId !== userId && userRole !== Role.ADMIN) {
             console.warn(`[DELETE Prompt] Forbidden: User ${userId} (Role: ${userRole}) attempted to delete prompt ${promptId} owned by ${promptToDelete.userId}`);
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this prompt' });
        }

        console.log(`[DELETE Prompt] Authorized: User ${userId} (Role: ${userRole}) deleting prompt ${promptId}`);
        await prisma.enginePrompt.delete({
            where: { id: promptId },
        });

        return res.status(200).json({ message: 'Prompt deleted successfully' });

    } catch (error: any) {
        console.error(`[Error DELETE Prompt] Failed for user ${userId || 'unknown'} (Role: ${userRole || 'unknown'}) on prompt ${promptId}:`, error);
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            if (error.code === 'P2025') {
                return res.status(404).json({ message: 'Prompt not found (deletion failed)' });
            }
        }
        return res.status(500).json({ message: 'Failed to delete prompt' });
    }
};