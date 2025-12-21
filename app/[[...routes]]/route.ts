import { NextRequest, NextResponse } from 'next/server';

async function handleProxy(req: NextRequest) {
  try {
    // 1. 获取控制参数
    let targetHost = req.headers.get('x-host');
    const targetCookie = req.headers.get('x-cookie');
    const method = req.headers.get('x-method') || req.method;

    // 检查必填项
    if (!targetHost) {
      return NextResponse.json(
        { error: 'Header [x-host] is missing.' },
        { status: 200, headers: { 'x-status': '400' } }
      );
    }

    // 2. 拼接完整的目标 URL
    // 处理 x-host 格式 (确保有协议，且末尾无斜杠)
    if (!targetHost.startsWith('http')) {
      targetHost = `https://${targetHost}`;
    }
    targetHost = targetHost.replace(/\/+$/, ''); // 移除末尾斜杠

    // 获取当前请求的路径和查询参数
    // 例如请求: https://my-proxy.vercel.app/v1/chat?q=hello
    // pathname: /v1/chat
    // search: ?q=hello
    const { pathname, search } = req.nextUrl;
    
    const targetUrl = `${targetHost}${pathname}${search}`;

    console.log(`[Proxy] ${method} -> ${targetUrl}`);

    // 3. 构建请求 Headers
    const requestHeaders = new Headers();
    req.headers.forEach((value, key) => {
      // 过滤掉不需要的头
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

    // 4. 处理 Body (GET/HEAD 无 Body)
    const hasBody = !['GET', 'HEAD'].includes(method.toUpperCase());
    const body = hasBody ? await req.blob() : undefined;

    // 5. 发起请求
    const response = await fetch(targetUrl, {
      method: method,
      headers: requestHeaders,
      body: body,
      redirect: 'manual', // 能够透传 3xx 状态码到 x-status
    });

    // 6. 处理响应 Headers
    const responseHeaders = new Headers(response.headers);
    
    // 设置实际状态码到 x-status
    responseHeaders.set('x-status', response.status.toString());
    
    // 清理可能导致 Vercel 报错的头
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('content-length');

    // 7. 返回结果 (始终 200)
    return new NextResponse(response.body, {
      status: 200,
      statusText: 'OK',
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('Proxy Error:', error);
    return NextResponse.json(
      { error: 'Internal Proxy Error', details: error.message },
      { status: 200, headers: { 'x-status': '500' } }
    );
  }
}

// 捕获所有 HTTP 方法
export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;