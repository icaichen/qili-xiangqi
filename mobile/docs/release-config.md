# 双 App 发布配置

移动端拆成两个独立发布单元，共享 `mobile/packages` 中的代码，但分别拥有自己的应用身份和更新渠道：

| App | Expo slug | URL scheme | iOS bundle ID | Android package |
| --- | --- | --- | --- | --- |
| QiliChess | `qilichess` | `qilichess://` | `com.qilichess.app` | `com.qilichess.app` |
| QiliChess Kids | `qilichesskids` | `qilichesskids://` | `com.qilichess.kids` | `com.qilichess.kids` |

每个 App 目录都包含自己的 `app.config.ts` 和 `eas.json`。因此可以从对应目录分别运行 Expo/EAS 命令，同时继续复用共享的棋规、课程数据和 UI 包。

## EAS profiles

- `development`: Development Client + internal distribution，用于本机开发和调试。
- `preview`: internal distribution，用于测试包、验收和分享给测试人员。
- `production`: 商店构建，启用 EAS 版本号自动递增，并使用独立的 production channel。

示例（在对应 App 目录执行）：

```bash
eas build --profile development --platform ios
eas build --profile preview --platform android
eas build --profile production --platform all
```

## 正式发布前必须替换/补齐

当前配置故意不包含真实 EAS `projectId`，本地 Expo 配置解析不依赖它。提交商店前需要：

1. 在对应的 Expo/EAS project 中初始化两个项目，并将各自的 `extra.eas.projectId` 写入对应 `app.config.ts`（或由 `eas init` 生成）。
2. 确认 Apple Developer 的两个 Bundle ID、签名团队和 App Store Connect 应用记录。
3. 确认 Google Play Console 的两个 package/application 记录与签名密钥。
4. 替换临时的图标、启动图、隐私政策链接和商店元数据；Kids 版本还要完成儿童隐私与年龄分级审核。
5. 首次生产构建前确认两个应用使用不同的 EAS project、channel 和商店凭据，避免更新渠道串包。
