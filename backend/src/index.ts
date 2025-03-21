import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { authRoutes } from './routes/authRoutes';
import { engineRoutes } from './routes/engineRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
  origin: 'http://localhost:5000', 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());  // Use cookie-parser

app.use('/api/auth', authRoutes);
app.use('/api/engine', engineRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});