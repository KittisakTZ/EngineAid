import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwtUtils';

interface CustomRequest extends Request {
  user?: any;
}

export const authenticate = (req: CustomRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Unauthorized - No token provided' });
    return; // เพิ่ม Return เพื่อจบ Function
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({ message: 'Unauthorized - Invalid token' });
    return; // เพิ่ม Return เพื่อจบ Function
  }

  req.user = decoded;
  next();
};

export const authorize = (roles: string[]) => {
  return (req: CustomRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user || !roles.includes(user.role)) {
      res.status(403).json({ message: 'Forbidden - Insufficient role' });
      return; // เพิ่ม Return เพื่อจบ Function
    }

    next();
  };
};