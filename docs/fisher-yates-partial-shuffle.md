# Fisher-Yates 部分洗牌

## 问题背景

在「默写达人」模式中，需要从单词的 `len` 个字母位置中**均匀随机**选出 `showCount` 个来暴露（填空提示）。例如单词 `apple`（5 个字母）easy 难度需要暴露 `ceil(5 * 0.5) = 3` 个位置。

需要解决的问题：从 `[0, len)` 中无放回地随机抽取 `showCount` 个不同索引，且每个索引被抽中的概率完全相等。

---

## 初始实现（while 循环）

```js
const positions = new Set()
while (positions.size < showCount) {
  positions.add(Math.floor(Math.random() * len))
}
```

**问题**：随机碰撞导致循环次数不可控。

当 `showCount` 接近 `len` 时，碰撞概率急剧上升：

| len | showCount | 碰撞概率（最后一次 add） | 预期循环次数 |
|-----|-----------|------------------------|-------------|
| 5   | 3         | 40%                    | ~3.7 次 |
| 10  | 9         | 80%                    | ~25 次 |
| 20  | 19        | 90%                    | ~65 次 |

虽然单词长度通常 ≤ 15，性能开销可以忽略，但**逻辑上不够优雅**——循环次数的不确定性是代码坏味。

---

## Fisher-Yates 部分洗牌

```js
const positions = Array.from({ length: len }, (_, i) => i)
for (let i = 0; i < showCount; i++) {
  const j = i + Math.floor(Math.random() * (len - i))
  ;[positions[i], positions[j]] = [positions[j], positions[i]]
}
const posSet = new Set(positions.slice(0, showCount))
```

### 执行过程

以 `len=5, showCount=3` 为例，初始 positions = `[0, 1, 2, 3, 4]`：

| i | 候选范围 `[i, len)` | 随机 j | 交换后 positions |
|---|---------------------|--------|-----------------|
| 0 | `[0, 1, 2, 3, 4]`  | 3      | `[3, 1, 2, 0, 4]` |
| 1 | `[1, 2, 3, 4]`     | 2      | `[3, 2, 1, 0, 4]` |
| 2 | `[2, 3, 4]`        | 4      | `[3, 2, 4, 0, 1]` |

最终前 3 个元素 `positions.slice(0, 3)` = `[3, 2, 4]`，即为均匀随机选中的位置。

### 复杂度

- 时间复杂度：O(len)，严格 `showCount` 次循环
- 空间复杂度：O(len)，额外创建索引数组

### 等概率论证

**数学归纳法**：

1. **第一次迭代（i=0）**：从 `len` 个位置中均匀选择一个放到 `positions[0]`，每个位置概率 `1/len`。
2. **第 k 次迭代**：此时前 `k-1` 个位置已选定。从剩下的 `len - (k-1)` 个位置中均匀选择一个，每个剩余位置概率 `1/(len - k + 1)`。
3. 最终任意特定位置在**最终前 `showCount` 个集合中**的概率为 `showCount / len`，且所有位置概率相等。

计算验证（某个位置被选入前 `showCount` 的概率）：

```
P = 1/len + (len-1)/len × 1/(len-1) + (len-1)/len × (len-2)/(len-1) × 1/(len-2) + ...
  = 1/len + 1/len + 1/len + ... （共 showCount 项）
  = showCount / len
```

---

## 使用场景

| 场景 | 描述 | 示例 |
|------|------|------|
| 填空游戏 | 从 N 个位置中随机选 K 个暴露 | 默写达人 blanks 生成 |
| 抽题 | 从题库中不重复地抽题 | 考试系统 |
| 样本选择 | 从数据集中无偏采样 | 测试集划分 |
| 推荐展示 | 从候选列表中选 K 个展示 | Feed 流打散 |
| 蒙特卡洛模拟 | 从集合中无放回抽样 | 随机模拟 |

**何时不该使用**：

- N 极大（百万级）且 K 远小于 N：此时 while 循环碰撞概率可忽略，且 O(N) 空间不可接受，应改用 Reservoir Sampling
- 需要**加权**随机采样：应使用加权随机算法（如 Alias Method）
- K = N（全排列）：直接用完整的 Fisher-Yates 洗牌即可，不需要 `slice`
