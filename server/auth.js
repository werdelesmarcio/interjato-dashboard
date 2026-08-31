import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import qrcode from 'qrcode';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Utilitários de MFA / TOTP Customizados e Auditáveis (Sem dependência de otplib)
function base32Decode(base32) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bytes = [];
    let val = 0;
    let count = 0;
    for (let i = 0; i < base32.length; i++) {
        const char = base32[i].toUpperCase();
        if (char === '=') break;
        const idx = alphabet.indexOf(char);
        if (idx === -1) throw new Error('Invalid base32 character');
        val = (val << 5) | idx;
        count += 5;
        if (count >= 8) {
            bytes.push((val >> (count - 8)) & 255);
            count -= 8;
        }
    }
    return Buffer.from(bytes);
}

function verifyTOTP(token, secret, window = 1, timeStep = 30) {
    try {
        const key = base32Decode(secret);
        const epoch = Math.floor(Date.now() / 1000);
        const currentCounter = Math.floor(epoch / timeStep);
        
        for (let i = -window; i <= window; i++) {
            const counter = currentCounter + i;
            const buffer = Buffer.alloc(8);
            buffer.writeBigInt64BE(BigInt(counter));
            
            const hmac = crypto.createHmac('sha1', key).update(buffer).digest();
            const offset = hmac[hmac.length - 1] & 0xf;
            const code = ((hmac[offset] & 0x7f) << 24) |
                         ((hmac[offset + 1] & 0xff) << 16) |
                         ((hmac[offset + 2] & 0xff) << 8) |
                         (hmac[offset + 3] & 0xff);
                         
            const generatedToken = String(code % 1000000).padStart(6, '0');
            if (generatedToken === token) {
                return true;
            }
        }
    } catch (e) {
        console.error("Erro na verificação de TOTP:", e);
    }
    return false;
}

function generateRandomBase32Secret(length = 16) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
        secret += alphabet[bytes[i] % alphabet.length];
    }
    return secret;
}

const JWT_SECRET = globalThis.process?.env?.JWT_SECRET || crypto.randomBytes(32).toString('hex');

export function validatePasswordStrength(password) {
    if (!password || password.length < 8) {
        return "A senha deve ter no mínimo 8 caracteres.";
    }
    if (!/[A-Z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra maiúscula.";
    }
    if (!/[a-z]/.test(password)) {
        return "A senha deve conter pelo menos uma letra minúscula.";
    }
    if (!/[0-9]/.test(password)) {
        return "A senha deve conter pelo menos um número.";
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) {
        return "A senha deve conter pelo menos um caractere especial (ex: !, @, #, $, etc.).";
    }
    return null;
}

function createToken(user) {
    return jwt.sign(
        { userId: user.id, username: user.username, name: user.name, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );
}

export async function getUsers() {
    return await prisma.user.findMany({
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            mfaEnabled: true,
        }
    });
}

export async function getUserById(id) {
    return await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            username: true,
            name: true,
            role: true,
            mfaEnabled: true,
        }
    });
}

export async function updateOwnProfile(id, { name, username, currentPassword, newPassword }) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return { error: 'Dados de perfil inválidos.', status: 400 };

    if (username && username !== user.username) {
        const existing = await prisma.user.findUnique({ where: { username } });
        if (existing) {
            return { error: 'Dados de perfil inválidos.', status: 400 };
        }
    }

    let updatedHash = user.passwordHash;
    if (newPassword) {
        const passwordError = validatePasswordStrength(newPassword);
        if (passwordError) {
            return { error: passwordError, status: 400 };
        }
        if (!currentPassword || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
            return { error: 'Dados de perfil inválidos.', status: 400 };
        }
        updatedHash = await bcrypt.hash(newPassword, 10);
    }

    const updatedUser = await prisma.user.update({
        where: { id },
        data: {
            name: name?.trim() || user.name,
            username: username?.trim() || user.username,
            passwordHash: updatedHash,
        }
    });

    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _, mfaSecret: __, ...safeUser } = updatedUser;

    return { user: safeUser, token: createToken(updatedUser) };
}

export async function addUser({ username, password, name, role }) {
    if (!username || username.trim().length < 3) {
        throw new Error('O nome de usuário deve ter no mínimo 3 caracteres.');
    }
    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
        throw new Error(passwordError);
    }
    
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
        throw new Error('Este nome de usuário já está cadastrado.');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
        data: {
            username,
            passwordHash,
            name,
            role: role || 'user',
        }
    });

    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _passwordHash, mfaSecret: __, ...user } = newUser;
    return user;
}

export async function updateUser(id, { name, username, role }) {
    try {
        const updatedUser = await prisma.user.update({
            where: { id },
            data: {
                name: name || undefined,
                username: username || undefined,
                role: role || undefined,
            }
        });

        // eslint-disable-next-line no-unused-vars
        const { passwordHash: _, mfaSecret: __, ...safeUser } = updatedUser;
        return safeUser;
    } catch {
        return null;
    }
}

export async function deleteUser(id) {
    try {
        await prisma.user.delete({ where: { id } });
        return true;
    } catch {
        return false;
    }
}

export async function mfaSetup(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'Usuário não encontrado.', status: 404 };

    const secret = generateRandomBase32Secret();
    const otpauth = `otpauth://totp/SGI-Interjato:${user.username}?secret=${secret}&issuer=SGI-Interjato`;
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    return { secret, qrCodeDataUrl };
}

export async function mfaVerifyAndEnable(userId, { secret, code }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'Usuário não encontrado.', status: 404 };

    const verified = verifyTOTP(code, secret);

    if (!verified) {
        return { error: 'Código de verificação inválido. Tente novamente.', status: 400 };
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            mfaSecret: secret,
            mfaEnabled: true,
        }
    });

    return { success: true, user: await getUserById(userId) };
}

export async function mfaDisable(userId, { password }) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { error: 'Usuário não encontrado.', status: 404 };

    if (!password || !(await bcrypt.compare(password, user.passwordHash))) {
        return { error: 'Senha incorreta.', status: 400 };
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            mfaEnabled: false,
            mfaSecret: null,
        }
    });

    return { success: true, user: await getUserById(userId) };
}

export async function login(req, res) {
    const { username, password, code } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Usuário e senha são obrigatórios.' });
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    const result = await bcrypt.compare(password, user.passwordHash);
    if (!result) {
        return res.status(401).json({ message: 'Credenciais inválidas.' });
    }

    // Se MFA estiver habilitado para este usuário
    if (user.mfaEnabled) {
        if (!code) {
            return res.status(200).json({ mfaRequired: true });
        }

        const verified = verifyTOTP(code, user.mfaSecret);

        if (!verified) {
            return res.status(401).json({ message: 'Código MFA de 6 dígitos inválido ou expirado.' });
        }
    }

    const token = createToken(user);
    
    res.cookie('authToken', token, {
        httpOnly: true, // Impede acesso via JavaScript no cliente
        secure: process.env.NODE_ENV === 'production', // Envia apenas em HTTPS
        sameSite: 'strict', // Proteção contra CSRF
        expires: new Date(Date.now() + 60 * 60 * 1000), // Expira em 1 hora
    });

    // eslint-disable-next-line no-unused-vars
    const { passwordHash: _, mfaSecret: __, ...safeUser } = user;
    res.json({ user: safeUser });
}

export function logout(req, res) {
    res.clearCookie('authToken');
    res.status(200).json({ message: 'Logout realizado com sucesso.' });
}

export function verifyToken(req, res, next) {
    const token = req.cookies.authToken;

    if (token == null) {
        return res.sendStatus(401); // Unauthorized
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403); // Forbidden
        }
        req.user = user;
        next();
    });
}

export async function ensureDefaultUsers() {
    // Migração de possíveis roles 'operator' remanescentes para 'operador'
    await prisma.user.updateMany({
        where: { role: 'operator' },
        data: { role: 'operador' }
    });

    const auditorExists = await prisma.user.findUnique({ where: { username: 'auditor' } });
    if (!auditorExists) {
        const passwordHash = await bcrypt.hash('auditor', 10);
        await prisma.user.create({
            data: {
                username: 'auditor',
                passwordHash,
                name: 'Auditor do SGI',
                role: 'auditor',
            }
        });
        console.log('Usuário auditor padrão criado com sucesso.');
    }

    const marcioExists = await prisma.user.findUnique({ where: { username: 'marcio.soares' } });
    if (!marcioExists) {
        const passwordHash = await bcrypt.hash('operador', 10);
        await prisma.user.create({
            data: {
                username: 'marcio.soares',
                passwordHash,
                name: 'Márcio Soares',
                role: 'operador',
            }
        });
        console.log('Usuário Márcio Soares padrão criado com sucesso.');
    }

    const wallysonExists = await prisma.user.findUnique({ where: { username: 'wallyson.silva' } });
    if (!wallysonExists) {
        const passwordHash = await bcrypt.hash('operador', 10);
        await prisma.user.create({
            data: {
                username: 'wallyson.silva',
                passwordHash,
                name: 'Wallyson Silva',
                role: 'operador',
            }
        });
        console.log('Usuário Wallyson Silva padrão criado com sucesso.');
    }
}
