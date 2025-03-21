import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { User } from '../models/user';

const prisma = new PrismaClient();
const saltRounds = 10;

export const registerUser = async (user: User): Promise<User> => {
  const hashedPassword = await bcrypt.hash(user.password as string, saltRounds);
  const newUser = await prisma.user.create({
    data: {
      email: user.email,
      role: user.role,
      password: hashedPassword,
    },
  });
  return { id: newUser.id, email: newUser.email, role: newUser.role };
};

export const loginUser = async (email: string, password: string): Promise<User | null> => {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return null;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);

  if (!passwordMatch) {
    return null;
  }

  return { id: user.id, email: user.email, role: user.role };
};