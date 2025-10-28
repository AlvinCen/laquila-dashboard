import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { User } from '../../types';

const LoginSchema = z.object({
  username: z.string(),
  password: z.string(),
  remember: z.boolean().optional(),
});

export default async function authRoutes(server: FastifyInstance) {
    const cookieName = process.env.JWT_COOKIE_NAME || 'laquila_token';
    const ttlDays = Number(process.env.JWT_TTL_DAYS || 30);

    server.post('/login', async (request, reply) => {
        const result = LoginSchema.safeParse(request.body);
        if (!result.success) {
            return reply.status(400).send(result.error);
        }
        const { username, password, remember } = result.data;

        const user: any = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user || user.password !== password) {
            return reply.status(401).send({ message: 'Username atau password salah.' });
        }
        
        // FIX: Cast `server` to `any` to access the `jwt` property provided by the `@fastify/jwt` plugin, resolving a type error.
        const token = await (server as any).jwt.sign({
            sub: user.id,
            username: user.username,
            role: user.role,
        }, {
            expiresIn: remember ? `${ttlDays}d` : '1d'
        });
        
        // FIX: Cast `reply` to `any` to access the `setCookie` method from the `@fastify/cookie` plugin, resolving a type error.
        (reply as any).setCookie(cookieName, token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false, // Set to true in production with HTTPS
            path: '/',
            maxAge: (remember ? ttlDays : 1) * 24 * 60 * 60,
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password: _, ...userToReturn } = user;
        userToReturn.permissions = JSON.parse(userToReturn.permissions);
        userToReturn.allowedWalletIds = userToReturn.allowedWalletIds === 'all' ? 'all' : JSON.parse(userToReturn.allowedWalletIds);

        return { ok: true, user: userToReturn };
    });

    server.get('/me', { preHandler: [(server as any).auth] }, async (request, reply) => {
        // FIX: Cast `request` to `any` to access the `user` property decorated by `@fastify/jwt`, resolving a type error.
        const decodedToken = (request as any).user;
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decodedToken.sub) as User;

        if (!user) {
            return reply.status(404).send({ message: 'User not found' });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { password, ...userToReturn }: any = user;
        userToReturn.permissions = JSON.parse(userToReturn.permissions as any);
        userToReturn.allowedWalletIds = userToReturn.allowedWalletIds === 'all' ? 'all' : JSON.parse(userToReturn.allowedWalletIds as any);
        
        return { user: userToReturn };
    });

    server.post('/logout', async (request, reply) => {
        // FIX: Cast `reply` to `any` to access the `clearCookie` method from the `@fastify/cookie` plugin, resolving a type error.
        (reply as any).clearCookie(cookieName, { path: '/' });
        return { ok: true };
    });
}