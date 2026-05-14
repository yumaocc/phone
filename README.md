# 中国风漫画生成 Agent 项目阅读文档

## 1. 项目定位

这是一个前后端分离的中国风漫画生成 Agent 项目，专注于通过 AI 创意指导生成高质量的中国风格漫画。

- 前端目录：`front`
- 后端目录：`background`
- 核心能力：
  - 用户通过自然语言对话描述漫画故事和角色设定
  - 可上传参考图（角色设定、场景参考、美术风格等）参与生成
  - Agent 作为漫画创意导演，在信息不足时先追问，在信息足够时自动创建漫画生成任务
  - 通过 `taskId` 查询漫画生成结果
  - 支持上传"漫画参考"进入本地风格库，后续对话自动做 RAG 检索增强，确保角色一致性和风格统一
  - 重点关注：故事连贯性、角色一致性、中国风美学融合

从当前代码看，这个项目的核心不是"直接调用模型生成一张漫画"，而是把流程拆成了两段：

1. `llm` 模块负责对话理解、上下文记忆、故事逻辑补全、提示词优化、决定是否调用生漫画工具
2. `generate-agent` 模块负责真正请求上游漫画生成接口，并返回任务信息

## 2. 技术栈

### 前端

- `Umi Max`
- `React`
- `Ant Design`
- `TypeScript`

### 后端

- `NestJS`
- `LangChain`
- `LangGraph MemorySaver`
- `OpenAI 兼容 SDK 接口`
- `Zod`

### 模型与外部依赖

- 对话模型：通过 `QWEN_*` 环境变量配置
- 视觉分析模型：通过 `QWEN_VISION_MODEL` 或 `QWEN_CHAT_MODEL` 配置
- 向量模型：通过 `QWEN_EMBEDDING_MODEL` 或 `EMBEDDING_MODEL` 配置
- 生图接口：通过 `GEMINI_*` 环境变量配置

注意：代码里虽然依赖中出现了 `mongodb` 相关包，但当前主流程没有真正接入 MongoDB。对话记忆现在是进程内 `MemorySaver`，风格库索引是本地 JSON 文件。

## 3. 目录结构

```text
photo
├── README.md                 # 当前阅读文档
├── front                     # Umi Max 前端
│   ├── src/pages/Home        # 当前主业务页面
│   ├── src/services          # 前端接口封装
│   └── mock                  # 模板残留 mock
└── background                # NestJS 后端
    ├── src/llm               # 对话 Agent 与工具调用入口
    ├── src/generate-agent    # 生图任务创建、查询、参考图上传
    ├── src/style-rag         # 风格图分析、本地索引、向量检索
    └── local-data/style-rag  # 风格库本地存储
```

## 4. 项目主流程

### 4.1 用户侧流程

1. 用户在前端 `Home` 页面输入漫画故事需求和角色设定
2. 可选上传参考图（角色设定、场景参考、美术风格等）、设置分镜比例、分辨率、生成格数、Google 搜索增强
3. 前端先把参考图上传到后端，拿到可用的图片 URL
4. 前端调用 `POST /llm/msg`
5. 后端 `llm` 模块根据对话内容和历史上下文决定：
   - 信息不足：直接回复追问（故事背景、角色设定、美术风格等）
   - 信息足够：调用工具 `generate_image`
6. 工具实际调用 `generate-agent` 服务创建上游漫画生成任务
7. 前端拿到 `taskId` 后，用户可在右侧面板查询任务结果
8. 若任务完成，前端从返回 JSON 中提取漫画地址并展示

### 4.2 漫画参考库 RAG 流程

1. 用户在右侧"漫画参考库"上传漫画参考图（可以是之前生成的漫画、角色设定、场景参考等）
2. 后端调用视觉模型分析漫画内容，产出结构化信息（美术风格、角色特征、场景、氛围等）
3. 后端将分析结果拼成检索文本并做 embedding
4. 数据写入本地文件 `background/local-data/style-rag/styles.json`
5. 后续每次 `/llm/msg` 对话时，先根据用户输入检索相关漫画参考
6. 检索结果会被拼进系统提示词，辅助模型优化 prompt，确保新生成的漫画与之前的作品保持一致的角色形象和美术风格

## 5. 前端阅读

### 5.1 入口和整体状态

前端入口比较轻，项目真实业务几乎全部集中在 `front/src/pages/Home/index.tsx`。

- `front/src/app.ts`
  - 配置标题为 `中国风漫画生成 Agent`
- `front/src/access.ts`
  - Umi 权限示例，和核心业务无关
- `front/src/pages/Home/index.tsx`
  - 当前主页面
  - 承担漫画故事输入、参考图上传、漫画参考库管理、任务查询、结果展示全部职责

### 5.2 Home 页面的功能分区

`Home` 页面可以看成 3 个区域：

1. 顶部概览区
   - 展示当前会话 ID
   - 展示这个页面的工作模式：`漫画创作 + 查询`

2. 左侧对话区
   - 展示用户和 AI 的对话流
   - 输入漫画故事需求后发送
   - 支持上传最多 12 张参考图（角色设定、场景参考、美术风格等）
   - 支持设置：
     - 漫画分镜比例 `size`
     - 分辨率 `metadata.resolution`
     - 生成格数 `n`
     - `google_search`
     - `google_image_search`

3. 右侧侧边区
   - 漫画任务查询
   - 漫画参考库 RAG 管理

### 5.3 前端接口封装

核心接口都在 `front/src/services/imageAgent.ts`：

- `chat`
  - `POST /llm/msg`
  - 发起对话请求
- `getImageTask`
  - `GET /generate-agent/get?id=...`
  - 查询生图任务
- `listStyleReferences`
  - `GET /style-rag/list`
  - 拉取风格库列表
- `uploadStyleReference`
  - `POST /style-rag/upload`
  - 上传风格参考图
- `uploadGenerateReferenceImage`
  - `POST /generate-agent/upload`
  - 上传用于生成的参考图

默认后端地址来自：

- `UMI_APP_API_BASE_URL`
- 未配置时回退到 `http://localhost:3000`

### 5.4 结果展示策略

前端没有假定后端返回固定图片字段，而是通过 `extractImageUrls` 递归扫描结果 JSON：

- 支持识别 http 图片地址
- 支持识别 base64 图片字段
- 支持从嵌套对象中抽取图片 URL

这说明当前前端对上游生图结果格式做了兼容处理，容错比固定字段绑定更高。

### 5.5 前端中的非核心/残留内容

以下内容目前不属于主业务链：

- `front/src/pages/Table/index.tsx`
  - 空页面
- `front/src/pages/Access/index.tsx`
  - Umi 权限示例页
- `front/src/services/demoAgent.ts`
  - 一套单独的 demo session / revise 接口定义
  - 当前页面未接入
- `front/mock/userAPI.ts`
  - 模板 mock 数据

可以把这些视为模板遗留或预研接口，不是当前交付主路径。

## 6. 后端阅读

### 6.1 启动入口

- `background/src/main.ts`
  - 启动 Nest 应用
  - 开启 CORS
  - 默认监听 `3000`

- `background/src/app.module.ts`
  - 注册 3 个核心模块：
    - `LlmModule`
    - `GenerateAgentModule`
    - `StyleRagModule`

### 6.2 llm 模块

`background/src/llm` 是整个系统的"创意大脑"。

#### 对外接口

- `POST /llm/msg`

请求参数大致包括：

- `message`
- `conversationId`
- `imageUrls`
- `size`
- `n`
- `metadata`

返回值：

- `conversationId`
- `message`
- 可选 `taskId`

#### 核心职责

`LlmService` 负责：

- 构建 LangChain Agent
- 给 Agent 注入 `generate_image` 工具（用于生成漫画）
- 用 `MemorySaver` 保存会话历史
- 用 `summarizationMiddleware` 压缩长对话
- 先检索漫画风格库，把风格和角色设定上下文注入系统提示词
- 解析 Agent 最终回复和工具调用结果

#### 关键设计

1. 会话记忆
   - 通过 `conversationId` 作为 `thread_id`
   - 同一会话可连续修改故事和角色设定

2. 工具调用
   - Agent 只暴露一个工具：`generate_image`
   - 工具本质上调用 `GenerateAgentService.generateImage`

3. 系统提示词约束（漫画特定）
   - 必须用中文回答
   - 不直接照抄用户原话，而是优化为漫画提示词
   - 信息不足先追问（故事背景、角色设定、美术风格等）
   - 信息足够必须调用生漫画工具
   - 若页面已指定比例、分辨率、张数，则不要重复追问
   - 风格检索结果会作为长期风格记忆参与 prompt 优化
   - 重点强调：角色一致性、故事连贯性、中国风美学

这部分是项目最关键的工程设计点：把"漫画创意指导和提示词优化决策"和"漫画 API 调用"拆开，便于后续更换模型或扩展工具。

### 6.3 generate-agent 模块

`background/src/generate-agent` 负责和上游漫画生成服务直接通信。

#### 对外接口

- `GET /generate-agent/get?id=...`
  - 查询漫画任务状态与结果
- `POST /generate-agent/upload`
  - 上传漫画参考图（角色设定、场景参考等）

#### 核心职责

`GenerateAgentService` 负责：

- 调用上游 `/images/generations` 创建漫画生成任务
- 调用上游 `/images/generations/{taskId}` 查询任务状态
- 调用上游 `/uploads/images` 上传参考图并换取 URL
- 对返回结果做 JSON 解析与结构校验

#### 参数映射

发送到上游的字段主要包括：

- `model`
- `prompt`（优化后的漫画提示词）
- `size`
- `n`
- `metadata`
- `image_urls`（参考图）

其中 `model` 默认值是：

- `gemini-2.5-flash-image-official`

但实际应以环境变量 `GEMINI_MODEL` 为准。

### 6.4 style-rag 模块

`background/src/style-rag` 负责"漫画参考入库 + 本地检索"，确保角色一致性和风格统一。

#### 对外接口

- `POST /style-rag/upload`
- `GET /style-rag/list`
- `GET /style-rag/search?query=...`

#### 上传时发生了什么

`uploadStyleReference` 的步骤：

1. 校验上传文件必须是图片
2. 把原图保存到本地目录
3. 调用视觉模型分析漫画参考图
4. 得到结构化漫画信息：
   - `title`（漫画标题或场景名称）
   - `summary`（漫画内容摘要）
   - `styleTags`（美术风格标签：水墨、工笔、民间艺术等）
   - `colorTags`（色彩基调）
   - `compositionTags`（分镜构图）
   - `moodTags`（故事氛围）
   - `negativeTags`（应避免的问题）
   - `retrievableText`（向量检索文本）
5. 拼接为适合检索的文本
6. 调用 embedding 模型生成向量
7. 写入本地索引文件

#### 检索逻辑

检索不是基于数据库，而是：

- 读取本地 `styles.json`
- 对查询文本做 embedding
- 与所有已存条目算余弦相似度
- 按分数排序后返回 top N

这确保了新生成的漫画能够参考之前的角色设定和美术风格，保持一致性。

#### 本地存储位置

- 图片目录：`background/local-data/style-rag/uploads`
- 索引文件：`background/local-data/style-rag/styles.json`

当前项目已经存在该索引文件，说明漫画参考库机制至少被运行过一次。

## 7. 前后端接口关系

当前真实打通的接口关系如下：

### 对话与生图

- 前端 `Home.handleSend`
  - 先调用 `/generate-agent/upload` 上传参考图
  - 再调用 `/llm/msg`
- 后端 `LlmService`
  - 组装系统提示词
  - 调用 `generate_image` 工具
- 后端 `GenerateAgentService`
  - 调用上游图片生成服务

### 结果查询

- 前端 `handleQueryTask`
  - 调用 `/generate-agent/get`
- 后端 `GenerateAgentService.getImage`
  - 向上游查询任务详情

### 风格库

- 前端 `handleUploadStyle`
  - 调用 `/style-rag/upload`
- 前端页面初始化
  - 调用 `/style-rag/list`
- 后端 `LlmService.message`
  - 内部调用 `styleRagService.buildStyleContext`

## 8. 当前项目的特点

### 8.1 已经完成的部分

- 前后端基本打通
- 聊天式漫画生成流程完整
- 支持多轮会话 ID
- 支持漫画参考图上传
- 支持任务查询
- 支持漫画参考分析与本地 RAG
- 前端有较完整的演示工作台界面
- 系统提示词专注于漫画创意指导（角色一致性、故事连贯性、中国风美学）

### 8.2 当前更像 Demo 的部分

- 测试文件大多只是 `should be defined`
- 没有看到严格的 DTO 校验链路覆盖所有控制器入参
- 对话记忆是进程内内存，不是持久化存储
- 漫画参考库索引是本地 JSON 文件，不适合多人协作或大规模数据
- 前端页面职责集中在单文件 `Home`，后续维护成本会逐渐上升
- 项目里存在部分模板残留代码

### 8.3 漫画生成的核心优势

- **角色一致性**：通过 RAG 检索之前的角色设定，确保同一角色在多格漫画中保持一致
- **故事连贯性**：Agent 理解故事弧线，每一格漫画都推进情节
- **中国风美学**：系统提示词强调中国传统绘画元素和现代漫画叙事的融合
- **创意指导**：Agent 作为漫画导演，优化用户的故事描述为高质量漫画提示词

## 9. 运行依赖与启动方式

### 9.1 前端

目录：`front`

可用脚本：

- `pnpm dev`
- `pnpm build`

### 9.2 后端

目录：`background`

可用脚本：

- `pnpm start:dev`
- `pnpm build`
- `pnpm test`

### 9.3 后端至少需要的环境变量

从代码推断，最少需要：

- `QWEN_API_KEY`
- `QWEN_BASE_URL`
- `QWEN_CHAT_MODEL`
- `GEMINI_BASE_URL`
- `GEMINI_API_KEY`

如果要启用完整风格库能力，还需要：

- `QWEN_VISION_MODEL` 或复用 `QWEN_CHAT_MODEL`
- `QWEN_EMBEDDING_MODEL` 或 `EMBEDDING_MODEL`

### 9.4 默认端口

- 后端：`3000`
- 前端：Umi dev 默认端口由本地环境决定

如果前端不是直接代理到 `3000`，需要配置：

- `UMI_APP_API_BASE_URL`

## 10. 建议的阅读顺序

如果是第一次接手这个项目，建议按下面顺序看：

1. `front/src/pages/Home/index.tsx`
   - 先看页面到底做了哪些事
2. `front/src/services/imageAgent.ts`
   - 再看前端实际调了哪些接口
3. `background/src/llm/llm.controller.ts`
4. `background/src/llm/llm.service.ts`
   - 理解 Agent 如何决定追问还是生成
5. `background/src/generate-agent/generate-agent.service.ts`
   - 理解与上游生图接口的对接方式
6. `background/src/style-rag/style-rag.service.ts`
   - 理解风格图入库和检索增强

## 11. 总结

这个项目目前已经具备一个"中国风漫画生成 Agent"的核心闭环：

- 前端负责收集故事需求、角色设定和参考图，展示生成结果
- `llm` 负责对话、记忆、故事理解、提示词优化和工具决策
- `generate-agent` 负责真正创建漫画生成任务
- `style-rag` 负责长期角色和风格记忆，确保一致性

**核心竞争力**：
- 不是简单的图片生成，而是漫画创意指导
- 强调角色一致性和故事连贯性
- 融合中国风美学和现代漫画叙事

如果后续继续演进，最优先的方向通常会是：

- 拆分前端 `Home` 页面，分离故事编辑、角色管理、结果展示等功能
- 给后端补充更真实的测试
- 把会话记忆和漫画参考库从本地/内存迁移到持久化存储
- 清理模板残留代码，收敛为单一业务路径
- 增强漫画分镜的连贯性检测（确保相邻分镜的逻辑关联）
# phone
