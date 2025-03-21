import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/authService';
import { generateToken } from '../utils/jwtUtils';

export const register = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken(user);

    // Set Token in Cookie
    res.cookie('authToken', token, {
      httpOnly: true,  // Cookie เข้าถึงได้เฉพาะ Backend
      maxAge: 3600000, // 1 Hour (milliseconds)
      secure: process.env.NODE_ENV === 'production', // ใช้ HTTPS เฉพาะ Production
      sameSite: 'lax',  // ป้องกัน CSRF
    });

    res.status(201).json({ user });  // Send User without Token
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const user = await loginUser(req.body.email, req.body.password);
    if (user) {
      const token = generateToken(user);

      // Set Token in Cookie
      res.cookie('authToken', token, {
        httpOnly: true,
        maxAge: 3600000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      res.json({ user });  // Send User without Token
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};