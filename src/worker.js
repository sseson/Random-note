// src/worker.js
import { getCORSHeaders } from './cors.js';
import { handleAuth } from './auth.js';
import { handleConfig, handleRecords } from './config.js';

export default {
  async fetch(request, env, ctx) {
    const CORS_HEADERS = getCORSHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path.startsWith('/api/auth/')) {
        return await handleAuth(request, env, path);
      }

      if (!path.startsWith('/api/')) {
        return jsonResponse({ error: '路由未找到' }, 404, CORS_HEADERS);
      }

      const token = request.headers.get('Authorization')?.split(' ')[1];
      if (!token) {
        return jsonResponse({ error: '未授权' }, 401, CORS_HEADERS);
      }

      const user = await verifyToken(token, env);
      if (!user) {
        return jsonResponse({ error: 'Token 无效' }, 401, CORS_HEADERS);
      }

      if (path === '/api/config' || path === '/api/config/') {
        return await handleConfig(request, env, path);
      }

      if (path.startsWith('/api/records/')) {
        return await handleRecords(request, env, path, user);
      }

      return jsonResponse({ error: '路由未找到' }, 404, CORS_HEADERS);
    } catch (error) {
      console.error('Worker 错误:', error);
      return jsonResponse({ 
        error: '服务器错误',
        message: error.message 
      }, 500, CORS_HEADERS);
    }
  }
};

async function verifyToken(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(atob(parts[1]));
    
    if (payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (e) {
    console.error('Token 验证错误:', e.message);
    return null;
  }
}

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

export { jsonResponse, verifyToken };