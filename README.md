# Lumino v1.0 细节优化与全流程测试指南

本仓库已完成 Lumino v1.0 核心功能的全部细节优化与功能补全。为确保系统稳定并便于测试，我们进行了全流程的联调测试与功能截图。

以下是完整的系统测试演示与说明：

---

## 1. 全流程测试演示

### 1.1 游客模式与登录引导
登录页面底端新增了 **“游客模式：以游客身份浏览公开博客 →”** 的快捷入口，且拦截器已将博客（`/blog` 和 `/blog/*`）设置为公共免签路由，免除未登录强制跳转。

![1.1 登录页游客入口](screenshots/login_page.png)

---

### 1.2 超级管理员工作台
使用超级管理员账户安全登录后，进入系统仪表盘，可快捷跳转“进入后台管理”和各类空间。

![1.2 管理员工作台](screenshots/dashboard.png)

---

### 1.3 博客随笔一键分享
进入后台管理，超管可在公开随笔列表的行操作栏点击 **“复制分享链接”**，系统将自动组合并复制域名下真实的独立单页路径（例如 `http://localhost:3000/blog/[slug]`），并伴有成功的 Toast 提醒。

![1.3 复制随笔分享链接](screenshots/admin_blog_toast.png)

---

### 1.4 自定义生成并复制邀请码
超管可在“配额与邀请码”分区，生成系统注册所需的单次邀请码。点击复制后，将生成个性化的邀请信模版，包含管理员称呼、注册页面完整地址和该激活码。

![1.4 复制激活邀请短信](screenshots/admin_copy_invite.png)

---

### 1.5 模拟新用户注册
获取邀请码后，模拟另一位用户访问 `/register` 注册。邀请码被成功填入表单，且校验通过。

![1.5 填写注册邀请码](screenshots/register_filled.png)

---

### 1.6 新用户注册并登录
注册成功后，新用户被自动执行登录，引导至专属的工作台面板。

![1.6 新用户登录工作台](screenshots/user_dashboard.png)

---

### 1.7 管理员创建私密空间
回到超级管理员账户，在“我的私密空间”页面点击 **“创建空间”**，填入空间名称与介绍，并选择空间类型（如情侣空间）确认创建。

![1.7 管理员创建空间](screenshots/space_create_filled.png)

---

### 1.8 生成空间邀请码
管理员进入新建的空间面板，切换到 **“空间设置”** 选项卡，在邀请码管理中输入时长与次数，成功生成针对本空间的加入邀请码。

![1.8 生成空间专用加入邀请码](screenshots/space_settings_invite.png)

---

### 1.9 新用户输入邀请码加入空间
退出管理员账号并重新以新用户身份登录。进入“我的私密空间”页面，点击 **“使用邀请码加入”** 并在弹窗中粘贴刚才管理员生成的空间邀请码。

![1.9 输入邀请码加入空间](screenshots/space_join_filled.png)

---

### 1.10 成功加入并实时同步成员
新用户成功被添加进空间，此时成员管理信息更新为 **2位成员**，共同列表已包含了超级管理员（所有者）及测试用户（新成员）。

![1.10 空间成员管理同步](screenshots/space_members_joined.png)

---

## 2. 本地测试运行方法

如果需要再次手动测试，请确保以下环境配置并运行：

### 2.1 后端启动
进入 `backend` 文件夹，激活虚拟环境并启动 Uvicorn：
```bash
cd backend
.\venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2.2 前端启动
进入 `frontend` 文件夹，开启开发服务：
```bash
cd frontend
npm run dev
```
然后即可通过本地浏览器 `http://localhost:3000` 尽情测试。

---

## 3. 云服务器部署与运维指引 (CentOS 7.6 / 2G 内存)

本项目已成功部署在 CentOS 7.6 阿里云服务器上，其公网 IP 地址为 `114.55.55.110`，绑定公网域名为 `lovestory1314.fun`。为了让系统在此低物理配置与旧系统环境下长效稳定运行，做了以下关键实施与技术处理，请在未来维护时作为参考：

### 3.1 内存优化与虚拟内存 (Swap)
- **挑战**：云服务器仅有 2GB 物理内存，而在执行前端 `npm run build` 打包构建以及数据库并发请求时，极易因内存耗尽引发 OOM 导致服务器崩溃。
- **解决**：在系统中配置并启用了 **4GB Swap 虚拟内存**。
- **路径**：`/var/swapfile`。

### 3.2 操作系统 Glibc 2.17 与 Node.js 20+ 的兼容解决
- **挑战**：CentOS 7.6 系统的 `glibc` 版本过低（仅为 `2.17`），无法直接运行官方编译的 Node.js 18+ 运行时包。
- **解决**：安装了基于 `glibc-2.17` 重新编译生成的 Node.js v20.15.1 补丁包，通过 NVM 进行全局环境变量管理。

### 3.3 数据库升级与低内存配置 (MariaDB 10.6)
- **挑战**：CentOS 7 自带的 MariaDB 5.5 太旧，无法支持表结构的 `DATETIME DEFAULT CURRENT_TIMESTAMP` 语法；若使用国外官方归档源升级，下载极其缓慢经常卡死。
- **解决**：
  1. 移除了旧版数据库，配置了 **阿里云国内 MariaDB 10.6.19 软件源** 进行免 GPG 校验安装。
  2. 针对 2G 低内存环境，向 `/etc/my.cnf.d/server.cnf` 中写入了优化配置，限制内存开销：
     ```ini
     [mysqld]
     innodb_buffer_pool_size = 128M
     max_connections = 50
     key_buffer_size = 16M
     ```
  3. 创建了数据库 `lumino` 并为后端配置了授权用户 `username`，密码：`134679werLQ@`。

### 3.4 初始管理员用户与 Bcrypt 降级
- **数据库迁移**：后端在虚拟环境下使用 `alembic upgrade head` 执行了全部迁移规则。
- **Bcrypt 降级**：因为 Python 安全库 `passlib` 的 bcrypt 后端与新版的 `bcrypt 5.0.0+` 存在严重不兼容（引发 `ValueError: password cannot be longer than 72 bytes`），我们强制将服务器后端虚拟环境中的依赖降级锁死为了 **`bcrypt==4.0.1`**。
- **管理员账号**：通过 `python scripts/init_db.py` 完成了初始化：
  - 用户名：`admin`
  - 密码：`AdminLumino@2026!Secret` （生产环境建议及时修改）

### 3.5 Nginx 反向代理与多域名自适应
- **配置文件**：`/etc/nginx/conf.d/lumino.conf`。
- **域名匹配**：`server_name` 开启了强大的正则表达式模糊匹配：
  ```nginx
  server_name 114.55.55.110 ~^(www\\.)?lovestory1314\\..*$;
  ```
  该配置让服务器能够自动适配并解析所有以 `lovestory1314` 开头的任何后缀（如当前生效的 `.fun` 以及未来可能扩充的 `.com`、`.cn` 等），绑定 IP 即可直接使用。

### 3.6 服务进程守护 (PM2)
前端与后端服务均使用 PM2 在服务器后台守护：
- **查看服务状态**：`pm2 status`
- **重启所有服务**：`pm2 restart all`
- **服务应用名**：`lumino-frontend`（监听 3000），`lumino-backend`（监听 8000）

