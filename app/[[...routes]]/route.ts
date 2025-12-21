import { NextRequest, NextResponse } from 'next/server';

/**
 * 统一的 CORS Headers 配置
 * 注意：必须在这里允许 x-origin 和 x-referer，否则浏览器预检请求会失败
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-host, x-cookie, x-method, x-status, x-origin, x-referer',
};

/**
 * 处理 OPTIONS 预检请求
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
    
    // 获取伪造的 Origin 和 Referer
    const targetOrigin = req.headers.get('x-origin');
    const targetReferer = req.headers.get('x-referer');

    // 检查必填项
    if (!targetHost) {
      return NextResponse.json(
        { error: 'Header [x-host] is missing.' },
        { 
          status: 200, 
          headers: { 
            'x-status': '400',
            ...corsHeaders 
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
      const lowerKey = key.toLowerCase();
      // 过滤掉系统自动生成的头和自定义控制头
      // 同时也过滤掉原始的 origin 和 referer，防止与后面手动设置的冲突
      if (
        lowerKey === 'host' || 
        lowerKey === 'origin' || 
        lowerKey === 'referer' ||
        lowerKey.startsWith('x-') ||
        lowerKey.startsWith('content-length')
      ) {
        return;
      }
      requestHeaders.set(key, value);
    });

    // --- 设置自定义 Header ---
    if (targetCookie) {
      requestHeaders.set('Cookie', targetCookie);
    }
    if (targetOrigin) {
      requestHeaders.set('Origin', targetOrigin);
    }
    if (targetReferer) {
      requestHeaders.set('Referer', targetReferer);
    }
    // ----------------------

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
    
    responseHeaders.set('x-status', response.status.toString());
    
    // 添加 CORS
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    
    // 清理头
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
          ...corsHeaders
        } 
      }
    );
  }
}

// 导出处理方法
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;