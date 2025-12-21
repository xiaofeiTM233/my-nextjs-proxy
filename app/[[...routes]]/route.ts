import { NextRequest, NextResponse } from 'next/server';

/**
 * 统一的 CORS Headers 配置
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-host, x-cookie, x-method, x-status',
};

/**
 * 处理 OPTIONS 预检请求
 * 直接返回 200 和 CORS 头，不转发给目标服务器
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * 核心代理处理函数
 */
async function handleProxy(req: NextRequest) {
  try {
    // 1. 获取控制参数
    let targetHost = req.headers.get('x-host');
    const targetCookie = req.headers.get('x-cookie');
    const method = req.headers.get('x-method') || req.method;

    // 检查必填项 (如果缺失，依然要返回 CORS 头，否则前端拿不到报错信息)
    if (!targetHost) {
      return NextResponse.json(
        { error: 'Header [x-host] is missing.' },
        { 
          status: 200, 
          headers: { 
            'x-status': '400',
            ...corsHeaders // 必须带上 CORS
          } 
        }
      );
    }

    // 2. 拼接完整的目标 URL
    if (!targetHost.startsWith('http')) {
      targetHost = `https://${targetHost}`;
    }
    targetHost = targetHost.replace(/\/+$/, '');

    const { pathname, search } = req.nextUrl;
    const targetUrl = `${targetHost}${pathname}${search}`;

    console.log(`[Proxy] ${method} -> ${targetUrl}`);

    // 3. 构建请求 Headers
    const requestHeaders = new Headers();
    req.headers.forEach((value, key) => {
      if (
        key.toLowerCase() === 'host' || 
        key.toLowerCase().startsWith('x-') ||
        key.toLowerCase().startsWith('content-length')
      ) {
        return;
      }
      requestHeaders.set(key, value);
    });

    if (targetCookie) {
      requestHeaders.set('Cookie', targetCookie);
    }

    // 4. 处理 Body
    const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
    const body = hasBody ? await req.blob() : undefined;

    // 5. 发起请求
    const response = await fetch(targetUrl, {
      method: method,
      headers: requestHeaders,
      body: body,
      redirect: 'manual', 
    });

    // 6. 处理响应 Headers
    const responseHeaders = new Headers(response.headers);
    
    // 设置实际状态码到 x-status
    responseHeaders.set('x-status', response.status.toString());
    
    // !!! 添加 CORS 允许头 !!!
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // 清理可能导致 Vercel 报错的头
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    // 7. 返回结果
    return new NextResponse(response.body, {
      status: 200,
      statusText: 'OK',
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Proxy Error', details: error.message },
      { 
        status: 200, 
        headers: { 
          'x-status': '500',
          ...corsHeaders // 错误响应也要带 CORS
        } 
      }
    );
  }
}

// 导出处理方法 (OPTIONS 单独处理了)
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;