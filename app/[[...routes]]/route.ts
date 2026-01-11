import { NextRequest, NextResponse } from 'next/server';

// 1. 定义 CORS 和需要忽略的 Header
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*'
};

// 2. 处理 OPTIONS 预检请求
export async function OPTIONS() {
  return NextResponse.json({}, { headers: CORS_HEADERS });
}

// 3. 核心代理逻辑
async function handleProxy(req: NextRequest) {
  try {
    // 提取控制参数
    const headers = req.headers;
    let targetHost = headers.get('x-host');
    const method = headers.get('x-method') || req.method;

    if (!targetHost) {
      return createResponse({ error: 'Missing x-host' }, 400);
    }

    // 构建目标 URL
    const protocol = targetHost.startsWith('http') ? '' : 'https://';
    const cleanHost = targetHost.replace(/\/+$/, '');
    const targetUrl = `${protocol}${cleanHost}${req.nextUrl.pathname}${req.nextUrl.search}`;

    // 构建请求 Header
    const requestHeaders = new Headers();
    headers.forEach((val, key) => {
      // 过滤系统头、原始跨域头和自定义 x- 头
      if (!/^(host|origin|referer|content-length|x-)/i.test(key)) {
        requestHeaders.set(key, val);
      }
    });

    // 映射自定义 Header 到标准 Header
    const map = { 'x-cookie': 'Cookie', 'x-origin': 'Origin', 'x-referer': 'Referer' };
    Object.entries(map).forEach(([xKey, targetKey]) => {
      const val = headers.get(xKey);
      if (val) requestHeaders.set(targetKey, val);
    });

    // 发起请求
    const res = await fetch(targetUrl, {
      method,
      headers: requestHeaders,
      body: !['GET', 'HEAD'].includes(method.toUpperCase()) ? await req.blob() : undefined,
      redirect: 'manual',
    });

    // 构建响应
    return createResponse(res.body, res.status, res.headers);

  } catch (e: any) {
    console.error('Proxy Error:', e);
    return createResponse({ error: e.message }, 500);
  }
}

/**
 * 辅助函数：统一构建 200 响应
 * @param body 响应体 (BodyInit 或 JSON对象)
 * @param realStatus 实际状态码 (放入 x-status)
 * @param upstreamHeaders 上游返回的 Header (可选)
 */
function createResponse(body: any, realStatus: number, upstreamHeaders?: Headers) {
  const headers = new Headers(upstreamHeaders);
  
  // 注入 CORS 和 状态码
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
  headers.set('x-status', realStatus.toString());
  
  // 清理 Vercel 敏感头
  headers.delete('content-encoding');
  headers.delete('content-length');

  // 如果 body 是对象且不是 Blob/Stream，转为 JSON
  const finalBody = (body && typeof body === 'object' && !(body instanceof Blob) && !(body instanceof ReadableStream)) 
    ? JSON.stringify(body) 
    : body;

  return new NextResponse(finalBody, { status: 200, headers });
}

// 导出所有方法
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
