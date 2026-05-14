# Qdrant 向量数据库集成指南

## 概述

项目已集成 Qdrant 向量数据库，用于替代本地 JSON 文件存储风格参考图的向量数据。

## 快速启动

### 1. 启动 Qdrant 服务

使用 Docker 启动 Qdrant（推荐）：

```bash
docker run -p 6333:6333 qdrant/qdrant
```

或者本地安装：

```bash
# macOS
brew install qdrant

# 启动服务
qdrant
```

### 2. 配置环境变量

在 `.env` 文件中配置 Qdrant 地址：

```env
QDRANT_URL=http://localhost:6333
```

默认值已设置为 `http://localhost:6333`，如果使用默认配置可以不设置。

### 3. 启动后端服务

```bash
pnpm start:dev
```

服务启动时会自动：
- 连接到 Qdrant
- 创建 `style_references` collection（如果不存在）
- 初始化向量存储

## 架构变化

### 之前（本地 JSON）
- 风格参考图存储在 `local-data/style-rag/styles.json`
- 相似度计算在内存中进行
- 不支持多进程/多服务器部署

### 现在（Qdrant）
- 风格参考图向量存储在 Qdrant
- 相似度搜索由 Qdrant 处理
- 支持分布式部署
- 性能更好，可扩展性更强

## API 变化

公开 API 保持不变，内部实现改为使用 Qdrant：

- `POST /style-rag/upload` - 上传风格参考图
- `GET /style-rag/list` - 列出所有风格参考
- `GET /style-rag/search?query=...` - 搜索相关风格

## 数据迁移

如果需要从旧的本地 JSON 迁移数据到 Qdrant，可以：

1. 保留旧的 `styles.json` 文件
2. 重新上传所有风格参考图
3. 新数据会自动存储到 Qdrant

## 故障排查

### 连接失败

```
Error: connect ECONNREFUSED 127.0.0.1:6333
```

**解决方案：**
- 确保 Qdrant 服务已启动
- 检查 `QDRANT_URL` 环境变量配置
- 确保防火墙允许访问 6333 端口

### Collection 创建失败

**解决方案：**
- 检查 Qdrant 服务日志
- 确保有足够的磁盘空间
- 尝试手动删除 collection 后重启服务

## 性能优化

- 向量搜索由 Qdrant 优化处理，性能远优于内存计算
- 支持批量操作和并发请求
- 自动缓存最近访问的数据

## 生产部署

对于生产环境，建议：

1. 使用 Qdrant 集群部署
2. 配置持久化存储
3. 设置备份策略
4. 监控 Qdrant 服务状态

详见 [Qdrant 官方文档](https://qdrant.tech/documentation/)
