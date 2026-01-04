# my-nextjs-proxy | Next.js API Reverse Proxy

一个基于 [Next.js](https://nextjs.org/) 的轻量级 API 反向代理项目，专为 Vercel 部署设计。

## ✨ 核心特性

- 🛠 **完全可控**：通过 `x-host`, `x-cookie`, `x-origin` 等 Header 动态控制请求目标和参数
- 🛡 **解决跨域**：默认允许所有 CORS 请求，自动处理 OPTIONS 预检
- ✅ **始终 200**：无论上游返回什么，接口始终返回 HTTP 200 (真实状态码见响应头 `x-status`)
- ⚡ **Vercel 部署**：原生支持 Serverless，无需维护服务器
- 🛤 **路径透传**：自动拼接请求路径和查询参数

## 🚀 部署

### 一键部署

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/xiaofeiTM233/my-nextjs-proxy)

## 🛠️ 使用方法

`https://your-proxy.vercel.app/<path>`

所有的控制参数都通过 **HTTP Headers** 传递。

### 核心 Headers

| Header | 必填 | 说明 |
| :--- | :---: | :--- |
| `x-host` | ✅ | 目标域名 (如 `api.openai.com`) |
| `x-cookie` | ❌ | 转发给目标的 Cookie |
| `x-method` | ❌ | 强制指定请求方法 (如 `PUT`, `DELETE`) |
| `x-origin` | ❌ | 伪造 Origin |
| `x-referer`| ❌ | 伪造 Referer |

### 示例

**目标**：请求 `https://api.bilibili.com/x/web-interface/nav`，并伪造 Referer 和 Cookie。

**请求你的代理：**

```bash
curl -X GET "https://your-proxy.vercel.app/x/web-interface/nav" \
  -H "x-host: api.bilibili.com" \
  -H "x-referer: https://www.bilibili.com" \
  -H "x-cookie: SESSDATA=xxxxxx"
```

**响应结果：**

- HTTP Status: `200` (固定)
- Response Header `x-status`: `200` (真实状态)
- Body: 目标接口返回的 JSON

## 🛠️ 技术栈

- **框架**: [Next.js](https://nextjs.org/)
- **语言**: TypeScript
- **部署**: [Vercel](https://vercel.com/)

## 📚 说明

本 README 文档由 AI 辅助生成。如有问题，请提交 Issue 或[与我联系](https://github.com/xiaofeiTM233)！
