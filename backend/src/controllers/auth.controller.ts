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
  console.log("Login controller started for:", req.body.email); // Log เริ่มต้น
  try {
    const user = await loginUser(req.body.email, req.body.password);
    console.log("User found by loginUser:", user ? user.email : 'null'); // Log ผลลัพธ์ loginUser

    if (user) {
      console.log("Generating token..."); // Log ก่อนสร้าง token
      const token = generateToken(user);
      console.log("Token generated:", token ? 'Yes' : 'No'); // Log หลังสร้าง token (อาจจะ Log บางส่วนของ token ถ้าต้องการ)

      console.log("Sending JSON response with user and token..."); // Log ก่อนส่ง response
      res.json({ user, token });
      console.log("JSON response sent."); // Log หลังส่ง (อาจจะไม่ขึ้นถ้าการส่งค้าง)

    } else {
      console.log("Invalid credentials."); // Log กรณีไม่เจอ user
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('!!! Login controller CATCH block:', error); // Log ใน catch
    res.status(500).json({ message: 'Login failed' });
  }
};