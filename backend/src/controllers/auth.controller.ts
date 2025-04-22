import { Request, Response } from 'express';
import { registerUser, loginUser } from '../services/authService';
import { generateToken } from '../utils/jwtUtils';

export const register = async (req: Request, res: Response) => {
  try {
    const user = await registerUser(req.body);
    const token = generateToken(user);

    // Set Token in Cookie
    res.cookie('authToken', token, {
      httpOnly: true,
      maxAge: 3600000, // 1 Hour (milliseconds)
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.status(201).json({ user, token });  // Include token in response for mobile app
  } catch (error) {
    console.error('Registration failed:', error);
    res.status(500).json({ message: 'Registration failed' });
  }
};

export const login = async (req: Request, res: Response) => {
  console.log("Login controller started for:", req.body.email);
  try {
    const user = await loginUser(req.body.email, req.body.password);
    console.log("User found by loginUser:", user ? user.email : 'null');

    if (user) {
      console.log("User role:", user.role); // Log role for debugging
      console.log("Generating token...");
      const token = generateToken(user);
      console.log("Token generated:", token ? 'Yes' : 'No');

      // Set Token in Cookie (for web clients)
      res.cookie('authToken', token, {
        httpOnly: true,
        maxAge: 3600000, // 1 Hour
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });

      console.log("Sending JSON response with user and token...");
      res.json({ 
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }, 
        token 
      });
      console.log("JSON response sent.");

    } else {
      console.log("Invalid credentials.");
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('!!! Login controller CATCH block:', error);
    res.status(500).json({ message: 'Login failed' });
  }
};