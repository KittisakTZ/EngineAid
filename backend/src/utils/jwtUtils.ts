import jwt from 'jsonwebtoken';
import { User } from '../models/user';

const jwtSecret = process.env.JWT_SECRET || 'secret'; // ควรเก็บใน environment variables

export const generateToken = (user: User): string => {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '1h' });
};

export const verifyToken = (token: string): any => {
  try {
    return jwt.verify(token, jwtSecret);
  } catch (error) {
    return null;
  }
};