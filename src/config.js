// src/config.js
import { jsonResponse } from './worker.js';
import { getCORSHeaders } from './cors.js';

export async function handleConfig(request, env, path) {
  const CORS_HEADERS = getCORSHeaders(env);
  
  if (request.method === 'GET') {
    return await getConfig(env, CORS_HEADERS);
  }

  if (request.method === 'POST') {
    return await updateConfig(request, env, CORS_HEADERS);
  }

  return jsonResponse({ error: '方法不允许' }, 405, CORS_HEADERS);
}

async function getConfig(env, CORS_HEADERS) {
  try {
    if (!env.RECORDS_STORE) {
      console.error('错误: RECORDS_STORE 未绑定');
      return jsonResponse({ 
        error: 'KV 存储未绑定',
        hint: '检查 wrangler.toml 中的 binding 名称'
      }, 500, CORS_HEADERS);
    }

    const config = await env.RECORDS_STORE.get('app:config');
    
    if (!config) {
      const defaultConfig = {
        pages: [
          { id: '1', title: '默认页面', columns: 3 }
        ]
      };
      console.log('返回默认配置');
      return jsonResponse(defaultConfig, 200, CORS_HEADERS);
    }

    console.log('返回已保存的配置');
    return jsonResponse(JSON.parse(config), 200, CORS_HEADERS);
  } catch (error) {
    console.error('getConfig 错误:', error.message);
    return jsonResponse({ 
      error: '获取配置失败',
      details: error.message
    }, 500, CORS_HEADERS);
  }
}

async function updateConfig(request, env, CORS_HEADERS) {
  try {
    if (!env.RECORDS_STORE) {
      return jsonResponse({ error: 'KV 存储未绑定' }, 500, CORS_HEADERS);
    }

    const config = await request.json();

    if (!config.pages || !Array.isArray(config.pages)) {
      return jsonResponse({ error: '配置格式无效' }, 400, CORS_HEADERS);
    }

    for (const page of config.pages) {
      if (!page.id || !page.title || !page.columns) {
        return jsonResponse({ error: '页面信息不完整' }, 400, CORS_HEADERS);
      }
      if (typeof page.columns !== 'number' || page.columns < 1 || page.columns > 20) {
        return jsonResponse({ error: '列数必须在 1-20 之间' }, 400, CORS_HEADERS);
      }
    }

    await env.RECORDS_STORE.put('app:config', JSON.stringify(config));

    return jsonResponse({
      success: true,
      message: '配置已更新'
    }, 200, CORS_HEADERS);
  } catch (error) {
    console.error('updateConfig 错误:', error.message);
    return jsonResponse({ error: '更新配置失败' }, 500, CORS_HEADERS);
  }
}

export async function handleRecords(request, env, path, user) {
  const CORS_HEADERS = getCORSHeaders(env);
  const pageId = path.split('/').pop();

  if (request.method === 'GET') {
    return await getRecords(env, pageId, user, CORS_HEADERS);
  }

  if (request.method === 'POST') {
    return await saveRecords(request, env, pageId, user, CORS_HEADERS);
  }

  return jsonResponse({ error: '方法不允许' }, 405, CORS_HEADERS);
}

async function getRecords(env, pageId, user, CORS_HEADERS) {
  try {
    if (!env.RECORDS_STORE) {
      return jsonResponse({ error: 'KV 存储未绑定' }, 500, CORS_HEADERS);
    }

    const key = `records:${user.username}:${pageId}`;
    const data = await env.RECORDS_STORE.get(key);

    return jsonResponse({
      success: true,
      rows: data ? JSON.parse(data) : []
    }, 200, CORS_HEADERS);
  } catch (error) {
    console.error('getRecords 错误:', error.message);
    return jsonResponse({ error: '获取数据失败' }, 500, CORS_HEADERS);
  }
}

async function saveRecords(request, env, pageId, user, CORS_HEADERS) {
  try {
    if (!env.RECORDS_STORE) {
      return jsonResponse({ error: 'KV 存储未绑定' }, 500, CORS_HEADERS);
    }

    const { rows } = await request.json();

    if (!Array.isArray(rows)) {
      return jsonResponse({ error: '数据格式无效' }, 400, CORS_HEADERS);
    }

    const key = `records:${user.username}:${pageId}`;
    await env.RECORDS_STORE.put(key, JSON.stringify(rows));

    return jsonResponse({
      success: true,
      message: '数据已保存'
    }, 200, CORS_HEADERS);
  } catch (error) {
    console.error('saveRecords 错误:', error.message);
    return jsonResponse({ 
      error: '保存失败',
      details: error.message
    }, 500, CORS_HEADERS);
  }
}