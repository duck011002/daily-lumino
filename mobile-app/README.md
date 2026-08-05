# Lumino Mobile Android 客户端

这是独立于现有 Next.js 前端的 uni-app Vue 3 原型，可直接作为后续 HBuilderX Android 项目的起点。

项目根目录包含 HBuilderX Vue 3/Vite 所需的 `index.html` 入口文件。

## 当前范围

- 已完成前厅、AI、空间、我的四栏导航。
- 已接入登录、AI 对话、图片上传、Word/PDF/TXT/Markdown 解析、博客/空间文章草稿和发布。
- 博客、空间文章、用户权限与 Web 共用后端数据。
- HBuilderX 预览和 Android 打包配置已就绪；首次云打包需在 HBuilderX 中绑定你自己的 DCloud AppID 和签名证书。

## 在 HBuilderX 中预览

1. 使用 HBuilderX 打开 `mobile-app` 目录。
2. 打开 `manifest.json`，在基础配置中获取 DCloud AppID。
3. 优先连接 Android 手机，选择“运行到手机或模拟器”预览。浏览器预览访问线上接口时可能受后端 CORS 白名单限制。
4. 正式打包前配置 Android 包名、应用图标和自有签名证书。

接口基地址集中在 `services/api.js`，目前为 `https://lovestory1314.fun`。
