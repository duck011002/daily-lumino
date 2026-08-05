# Lumino Mobile 首页原型

这是独立于现有 Next.js 前端的 uni-app Vue 3 原型，可直接作为后续 HBuilderX Android 项目的起点。

项目根目录包含 HBuilderX Vue 3/Vite 所需的 `index.html` 入口文件。

## 当前范围

- 已完成移动端首页视觉和基础交互骨架。
- 已接入线上公开接口：站点资料与精选博客。
- 已复用头像、封面、状态、精选文章和精选收藏数据结构。
- 书房、博客详情、内院、登录和个人中心暂时只保留入口，点击会提示下一阶段接入。

## 在 HBuilderX 中预览

1. 使用 HBuilderX 打开 `mobile-app` 目录。
2. 打开 `manifest.json`，在基础配置中获取 DCloud AppID。
3. 优先连接 Android 手机，选择“运行到手机或模拟器”预览。浏览器预览访问线上接口时可能受后端 CORS 白名单限制。
4. 正式打包前配置 Android 包名、应用图标和自有签名证书。

接口基地址集中在 `services/api.js`，目前为 `https://lovestory1314.fun`。
