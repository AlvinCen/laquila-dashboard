import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { nanoid } from 'nanoid';
import { User } from '../../src/types';

const UserSchema = z.object({
  username: z.string().min(3),
  password: z.string().optional(),
  role: z.enum(['admin', 'staff']),
  permissions: z.record(z.array(z.string())),
  allowedWalletIds: z.union([z.literal('all'), z.array(z.string())]),
});


export default async function userRoutes(server: FastifyInstance) {
  
  server.get('/', async (request, reply) => {
    const users = db.prepare('SELECT id, username, role, permissions, allowedWalletIds FROM users').all();
    return users.map((u: any) => ({
      ...u,
      permissions: JSON.parse(u.permissions),
      allowedWalletIds: u.allowedWalletIds === 'all' ? 'all' : JSON.parse(u.allowedWalletIds),
    }));
  });

  server.post('/', async (request, reply) => {
    const result = UserSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send(result.error);
    }
    const { password, ...data } = result.data;
    if (!password) {
      return reply.status(400).send({ message: 'Password is required for new user' });
    }
    
    const newUser = {
      id: `user_${nanoid()}`,
      password, // In a real app, hash this
      ...data,
      permissions: JSON.stringify(data.permissions),
      allowedWalletIds: Array.isArray(data.allowedWalletIds) ? JSON.stringify(data.allowedWalletIds) : 'all'
    };
    
    try {
        db.prepare('INSERT INTO users (id, username, password, role, permissions, allowedWalletIds) VALUES (?, ?, ?, ?, ?, ?)')
          .run(newUser.id, newUser.username, newUser.password, newUser.role, newUser.permissions, newUser.allowedWalletIds);
        
        const { password: _, ...userToReturn } = newUser;
        return reply.status(201).send({
            ...userToReturn,
            permissions: data.permissions,
            allowedWalletIds: data.allowedWalletIds
        });
    } catch(e: any) {
        if (e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return reply.status(409).send({ message: 'Username already exists' });
        }
        throw e;
    }
  });
  
  server.delete('/:id', async (request, reply) => {
      const { id } = request.params as { id: string };
      const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
      if (info.changes === 0) {
          return reply.status(404).send({ message: 'User not found' });
      }
      return { success: true };
  });
}
