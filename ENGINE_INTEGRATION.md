# 象棋引擎接入说明

## 当前状态

项目已经包含 `engine-server.mjs`，它是一个与具体引擎解耦的 UCI HTTP 包装层。

提供接口：

- `GET /api/engine/health`
- `POST /api/engine/analyze`

分析请求示例：

```json
{
  "fen": "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1",
  "depth": 12,
  "multiPv": 3
}
```

响应包含：

- `bestMove`
- `depth`
- `multiPv`
- 各候选着的评分
- 主要变化 `pv`
- 搜索节点数和耗时

## 启动方式

先设置本地引擎路径：

```bash
export XIANGQI_ENGINE_PATH="/absolute/path/to/engine"
export XIANGQI_ENGINE_KIND="pikafish"
npm run engine
```

Fairy-Stockfish：

```bash
export XIANGQI_ENGINE_PATH="/absolute/path/to/fairy-stockfish"
export XIANGQI_ENGINE_KIND="fairy-stockfish"
npm run engine
```

默认监听：

```text
http://127.0.0.1:8787
```

可选环境变量：

- `ENGINE_PORT`
- `ENGINE_DEPTH`
- `ENGINE_MULTIPV`
- `ENGINE_TIMEOUT_MS`

## 商业许可注意事项

### Pikafish 程序

Pikafish 程序代码采用 GPLv3。可以用于商业项目，但分发程序时需要履行 GPLv3 的源代码和许可义务。

### Pikafish NNUE 权重

Pikafish 官方 Networks 仓库对其权重设置了独立限制，其中包含“未经许可不得商业使用”。因此：

- 不应直接把官方 Pikafish NNUE 权重用于付费产品。
- 商业发布前应向权利方获得明确书面许可。
- 不能因为引擎程序是 GPLv3，就假设权重也允许商业使用。

### Fairy-Stockfish 备选

Fairy-Stockfish 支持中国象棋并采用 GPLv3。Pikafish 官方 Networks 说明，其为 Fairy-Stockfish 中国象棋变体训练的权重采用 CC0，不受上述 Pikafish 权重商业限制。

正式选择前仍需：

1. 核对实际下载的每个二进制和权重文件对应许可证。
2. 保存版本、来源、哈希和许可证副本。
3. 对比 Fairy-Stockfish 与获授权 Pikafish 的棋力和响应速度。
4. 发布前进行一次正式法律审查。

## 推荐路线

开发阶段先使用 Fairy-Stockfish 或不带受限权重的兼容 UCI 引擎完成技术验证。

产品确认有真实用户需求以后，再决定：

- 申请 Pikafish NNUE 商业授权；或
- 继续采用许可证清晰的 Fairy-Stockfish 方案；或
- 长期训练和拥有自己的评估网络。

## 安全与部署

- 引擎服务必须放在独立常驻服务器，不放在 Vercel Serverless Function。
- 所有分析请求必须限制深度、MultiPV、超时和并发。
- 相同 FEN 应缓存结果，降低 CPU 成本。
- 线上对局平台应防止接口被用于作弊；本产品优先服务于本地人机和赛后复盘。
