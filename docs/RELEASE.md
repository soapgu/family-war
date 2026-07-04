# 发布流程

## 前置条件

- 安装 `gh` CLI：`brew install gh`
- 拥有 GitHub Personal Access Token（Scope: `repo`, `read:org`）
- 对仓库有写权限

## 方法一：使用 gh CLI（推荐）

### 1. 认证

```bash
echo "<你的token>" | gh auth login --with-token
```

Token 会自动存入系统凭据管理（macOS Keychain），后续无需重复认证。

验证是否成功：

```bash
gh auth status
```

### 2. 创建 Release

```bash
# 创建并推送 tag
git tag -a v<版本号> -m "v<版本号>"
git push origin v<版本号>

# 创建 Release
gh release create v<版本号> --title "v<版本号>" --notes-file RELEASE_NOTES.md
```

> **注意**：Release Notes 建议提前写到 `RELEASE_NOTES.md` 文件中，按功能分类整理更清晰。可以从 `git log --oneline` 历史 commit 中归纳。

## 方法二：使用 GitHub API（备选）

当 `gh` 不可用或 scope 受限时使用。

### 1. 创建并推送 tag

```bash
git tag -a v<版本号> -m "v<版本号>"
git push origin v<版本号>
```

### 2. 调用 GitHub API 创建 Release

```bash
TOKEN="<你的Personal Access Token>"
curl -X POST \
  -H "Authorization: token $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tag_name": "v<版本号>",
    "name": "v<版本号>",
    "body": "<Release Notes，支持Markdown>",
    "draft": false,
    "prerelease": false
  }' \
  https://api.github.com/repos/soapgu/family-war/releases
```

## 整理 Release Notes 的技巧

```bash
# 查看所有 commit，按类型归纳
git log --oneline --no-merges --reverse

# 按类型筛选
git log --oneline --no-merges --grep="^feat"
git log --oneline --no-merges --grep="^fix"
git log --oneline --no-merges --grep="^refactor"
```

建议按以下分类组织：
- **新功能**（feat）
- **Bug 修复**（fix）
- **重构**（refactor）
- **UI 更新**（style）
- **测试**（test）
- **文档**（docs）
- **其他**

## Token 管理建议

### 存放位置对比

| 方式 | 优点 | 缺点 |
|------|------|------|
| **macOS Keychain**（`gh auth login` 自动存储） | 安全、自动 | 仅限本机 |
| **密码管理器**（1Password / Bitwarden 等） | 跨设备同步、安全 | 每次使用需手动取出 |
| **环境变量**（`~/.zshrc`） | 方便脚本使用 | 明文存储，需确保文件权限安全 |

### 推荐做法

1. 在 [GitHub Token 设置页](https://github.com/settings/tokens) 生成 token（scope: `repo`, `read:org`）
2. 运行 `echo "<token>" | gh auth login --with-token` — `gh` 会自动保存到系统 Keychain
3. 后续只需运行 `gh release create`，无需再手动处理 token
4. token 也建议备份到密码管理器（如 1Password），以防 Keychain 丢失

### 安全提醒

- **不要**将 token 提交到 Git 仓库
- **不要**在公开场合泄露 token
- 定期到 [Token 设置页](https://github.com/settings/tokens) 检查和续期 token
- 如怀疑泄露，立即在 GitHub 上删除并重新生成
