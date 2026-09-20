import jwt from 'jsonwebtoken';
import { prisma } from './db.js';
import { env } from './env.js';
import { setRlsContext } from './lib/rls.js';
const SECRET = env.JWT_SECRET;
const EXPIRES_IN = env.JWT_EXPIRES_IN;
export function signToken(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN });
}
export function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET);
    }
    catch (err) {
        try {
            const e = err;
            console.warn('[auth] verifyToken failed:', e.name, e.message);
        }
        catch {
            // ignore
        }
        return null;
    }
}
export async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    let token;
    if (header?.startsWith('Bearer '))
        token = header.slice(7);
    if (!token) {
        try {
            const cookies = req.cookies;
            if (cookies && typeof cookies.vdx_token === 'string')
                token = String(cookies.vdx_token);
        }
        catch {
            // ignore
        }
    }
    if (!token) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const payload = verifyToken(token);
    if (!payload || !payload.sub) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }
    if (payload.otpPending) {
        res.status(401).json({ error: 'OTP verification required to complete login' });
        return;
    }
    const authStart = Date.now();
    const findUserPromise = prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, suspended: true, deletedAt: true, tokenVersion: true },
    });
    const DB_TIMEOUT_MS = 10000;
    let user = null;
    try {
        user = await Promise.race([
            findUserPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT')), DB_TIMEOUT_MS)),
        ]);
    }
    catch (err) {
        const e = err;
        console.warn('[auth] requireAuth: DB lookup failed or timed out:', e.message);
        res.status(503).json({ error: 'Service temporarily unavailable (db timeout)' });
        return;
    }
    finally {
        console.log(`[auth] requireAuth: user lookup took ${Date.now() - authStart}ms for sub=${payload.sub}`);
    }
    if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
    }
    if (typeof payload.v === 'number' && user.tokenVersion !== null && payload.v !== user.tokenVersion) {
        res.status(401).json({ error: 'Session revoked. Please log in again.' });
        return;
    }
    if (user.suspended) {
        res.status(403).json({ error: 'Account suspended' });
        return;
    }
    if (user.deletedAt) {
        res.status(403).json({ error: 'Account deleted. Please contact support to restore access.' });
        return;
    }
    req.userId = user.id;
    req.userEmail = user.email;
    req.userRole = user.role === 'admin' ? 'admin' : user.role === 'subadmin' ? 'subadmin' : 'user';
    try {
        await Promise.race([
            setRlsContext({ id: user.id, role: user.role }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RLS_TIMEOUT')), DB_TIMEOUT_MS)),
        ]);
    }
    catch (err) {
        console.warn('[auth] RLS context setup failed for user', user.id, err instanceof Error ? err.message : String(err));
    }
    next();
}
const SELF_FUND_RE = /(wallet|deposit|deduct|transactions|holdings|fee|bonus|seed-treasury)/i;
const FULL_ADMIN_ONLY_RE = /(impersonate|seed-treasury|settings|hierarchy)/i;
export function isStaffRole(role) {
    return role === 'admin' || role === 'subadmin';
}
export function requireAdmin(req, res, next) {
    if (!isStaffRole(req.userRole)) {
        res.status(403).json({ error: 'Admin only' });
        return;
    }
    const path = `${req.baseUrl || ''}${req.path || ''}`;
    const idMatch = path.match(/\/users\/([^/]+)/);
    const targetId = idMatch?.[1];
    const body = (req.body ?? {});
    if (req.userRole === 'admin' &&
        targetId &&
        targetId !== req.userId &&
        typeof body.role === 'string' &&
        body.role.toLowerCase() === 'admin') {
        body.role = 'subadmin';
    }
    if (req.userRole === 'subadmin' && req.method !== 'GET' && targetId && targetId === req.userId && SELF_FUND_RE.test(path)) {
        res.status(403).json({ error: 'Sub-admins cannot fund or adjust their own account' });
        return;
    }
    if (req.userRole === 'subadmin' && req.method !== 'GET' && FULL_ADMIN_ONLY_RE.test(path)) {
        res.status(403).json({ error: 'Full admin only' });
        return;
    }
    if (req.userRole === 'subadmin' && req.method !== 'GET') {
        const dest = String(body.toUserId || body.userId || body.recipientId || '');
        if (dest && dest === req.userId) {
            res.status(403).json({ error: 'Sub-admins cannot fund their own account' });
            return;
        }
    }
    next();
}
export function requireFullAdmin(req, res, next) {
    if (req.userRole !== 'admin') {
        res.status(403).json({ error: 'Full admin only' });
        return;
    }
    next();
}
