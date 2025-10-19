// src/auth.js
import { jsonResponse } from './worker.js';
import { getCORSHeaders } from './cors.js';

export async function handleAuth(request, env, path) {
  const CORS_HEADERS = getCORSHeaders(env);
  
  if (path === '/api/auth/login' && request.method === 'POST') {
    return await login(request, env, CORS_HEADERS);
  }

  if (path === '/api/auth/verify' && request.method === 'GET') {
    return verify(request, env, CORS_HEADERS);
  }

  return jsonResponse({ error: '方法不允许' }, 405, CORS_HEADERS);
}

async function login(request, env, CORS_HEADERS) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return jsonResponse({ error: '用户名和密码必填' }, 400, CORS_HEADERS);
    }

    if (password.length < 6) {
      return jsonResponse({ error: '密码至少 6 个字符' }, 400, CORS_HEADERS);
    }

    let user = await getUser(env);

    if (!user) {
      console.log(`创建新管理员用户`);
      user = await createUser(env, password);
      
      if (!user) {
        return jsonResponse({ error: '创建用户失败' }, 500, CORS_HEADERS);
      }
    } else {
      const isPasswordValid = await verifyPassword(password, user.passwordHash, user.salt);
      console.log(`密码验证结果: ${isPasswordValid}`);
      
      if (!isPasswordValid) {
        return jsonResponse({ error: '用户名或密码错误' }, 401, CORS_HEADERS);
      }
    }

    const token = await generateToken(env);

    return jsonResponse({
      success: true,
      token,
      expiresIn: 86400,
    }, 200, CORS_HEADERS);
  } catch (error) {
    console.error('登录错误:', error);
    return jsonResponse({ error: '登录失败' }, 500, CORS_HEADERS);
  }
}

function verify(request, env, CORS_HEADERS) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return jsonResponse({ error: '未提供认证信息' }, 401, CORS_HEADERS);
  }

  const token = authHeader.split(' ')[1];
  
  if (!token) {
    return jsonResponse({ error: 'Token 格式错误' }, 401, CORS_HEADERS);
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return jsonResponse({ error: 'Token 格式无效' }, 401, CORS_HEADERS);
    }

    const payload = JSON.parse(atob(parts[1]));

    if (payload.exp < Date.now() / 1000) {
      return jsonResponse({ error: 'Token 已过期' }, 401, CORS_HEADERS);
    }

    if (!payload.username) {
      return jsonResponse({ error: 'Token 无效' }, 401, CORS_HEADERS);
    }

    return jsonResponse({
      valid: true,
      user: payload.username
    }, 200, CORS_HEADERS);
  } catch (error) {
    console.error('Token 验证错误:', error);
    return jsonResponse({ error: 'Token 无效' }, 401, CORS_HEADERS);
  }
}

// 从 KV 获取用户（固定 Key 为 'admin'）
async function getUser(env) {
  try {
    const userData = await env.RECORDS_STORE.get('admin');
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error('获取用户错误:', error);
    return null;
  }
}

// 创建新用户（固定 Key 为 'admin'）
async function createUser(env, password) {
  try {
    const salt = generateSalt();
    const passwordHash = await hashPasswordWithSHA256(password, salt);

    const newUser = {
      passwordHash: passwordHash,
      salt: salt,
      createdAt: new Date().toISOString(),
      role: 'admin'
    };

    await env.RECORDS_STORE.put(
      'admin',
      JSON.stringify(newUser)
    );

    console.log(`管理员用户已创建, salt: ${salt}, hash: ${passwordHash}`);
    return newUser;
  } catch (error) {
    console.error('创建用户错误:', error);
    return null;
  }
}

// 生成随机 salt（16 个随机字符）
function generateSalt() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let salt = '';
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  for (let i = 0; i < 16; i++) {
    salt += chars[array[i] % chars.length];
  }
  return salt;
}

// 使用 SHA-256 对密码进行哈希（password + salt）
async function hashPasswordWithSHA256(password, salt) {
  const message = password + salt;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

// 验证密码
async function verifyPassword(password, storedHash, salt) {
  const hash = await hashPasswordWithSHA256(password, salt);
  const isValid = hash === storedHash;
  console.log(`验证密码: 输入的hash=${hash}, 存储的hash=${storedHash}, 匹配=${isValid}`);
  return isValid;
}

// 使用 HMAC-SHA256 生成 JWT
export async function generateToken(env) {
  try {
    const secret = env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET 未定义');
    }

    const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' });
    const now = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      username: 'admin',
      iat: now,
      exp: now + 86400,
    });

    const headerEncoded = btoa(header);
    const payloadEncoded = btoa(payload);
    const message = `${headerEncoded}.${payloadEncoded}`;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, messageData);
    const signatureEncoded = btoa(String.fromCharCode(...new Uint8Array(signature)));

    return `${message}.${signatureEncoded}`;
  } catch (error) {
    console.error('生成 Token 错误:', error);
    throw error;
  }
}

// 验证 JWT 签名
export async function verifyTokenSignature(token, env) {
  try {
    const secret = env.JWT_SECRET;
    if (!secret) {
      console.error('JWT_SECRET 未定义');
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('Token 格式无效');
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const message = `${headerEncoded}.${payloadEncoded}`;

    const signatureBinary = atob(signatureEncoded);
    const signatureArray = new Uint8Array(signatureBinary.length);
    for (let i = 0; i < signatureBinary.length; i++) {
      signatureArray[i] = signatureBinary.charCodeAt(i);
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureArray,
      messageData
    );

    if (!isValid) {
      console.error('Token 签名验证失败');
      return null;
    }

    const payload = JSON.parse(atob(payloadEncoded));

    if (payload.exp < Date.now() / 1000) {
      console.error('Token 已过期');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('验证 Token 签名错误:', error);
    return null;
  }
}