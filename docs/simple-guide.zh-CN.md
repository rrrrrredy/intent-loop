# 两分钟上手 Intent Formation

## 它有什么用

Intent Formation 会帮 Codex 在开工前发现一个关键问题：你的要求里还有没有会让结果走向完全不同方向的选择。

任务很清楚时，Codex 直接做。方向没定，而且猜错会浪费很多时间时，它只问一个有用的问题，或者给你两三个具体方案看。你照平时的方式说话就行。

## 最简单的安装方法

电脑需要有 [Codex CLI 官方版](https://developers.openai.com/codex/cli) 和 [Node.js 官方版](https://nodejs.org/en/download)。安装后关闭并重新打开终端，分别输入 `node --version` 和 `codex --version`：前者应显示 20 或更高版本，后者应显示 Codex 版本。这里常说的 PATH，简单理解就是“终端能直接找到并运行这个命令”。如果看到“找不到命令”或 `command not found`，先按对应链接完成安装，再重新打开终端重试。

Windows 打开 PowerShell，macOS 打开“终端”，Linux 打开 Terminal。依次粘贴下面两行：

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.3.0-beta.1
codex plugin add intent-formation@intent-loop
~~~

安装后新建一个 Codex 任务。Codex 提示检查 Hook 时，先看内容，再启用。Hook 就是插件在你发送消息前运行的一小段本地脚本；它的内容可以先检查。

到这里就能用了，不用学命令，也不用填表。

## 怎么用

直接说你要做什么：

> 帮我做一个产品首页，要显得专业。

“专业”可能有几种差别很大的方向。如果这个选择会影响接下来的设计，Codex 会问一个具体问题，或者给出少量可比较的样例。你可以选一个、混合几个，也可以说都不对。

如果你说：

> 把这段中文翻成英文。

它会直接翻译，不多问。

## 什么时候需要 State

普通使用不用装 State。只有在你希望 Codex 下次打开任务时还记得已经确认的目标，才安装：

~~~shell
codex plugin add intent-formation-state@intent-loop
~~~

新建任务后，在 **Codex 任务的聊天输入框**里输入 `/intent start`，不要输到 PowerShell 或 Terminal。成功时会看到一段 `IF-...` 回执。没有回执，就当作没有成功。

- `/intent remember 只在所有发布门槛通过后公开`：在 standard 模式明确保存一条目标。也可以写 `/intent remember constraint: 不上传私密数据` 来保存硬性限制。
- `/intent show`：每页查看最多三条已保存记录；还有更多时输入 `/intent show 2`、`/intent show 3` 继续看。
- `/intent private`：清掉已落盘的当前任务内容，之后只在本次进程内临时保存。
- `/intent off`：关闭当前任务的意图干预和状态更新。
- `/intent export`：在 standard 或 off 模式导出 JSON 文件，并给出不包含本机路径的导出 ID 和 SHA-256 校验值；private 模式不会把临时内容写盘。
- `/intent forget`：删除插件管理范围内的当前任务记录和导出文件。

`/intent off` 只有在你已经检查并信任 State 的 Hook，而且命令返回 `IF-...` 回执时才算生效。自动命令模式 `codex exec` 没有可点击的检查界面，不能替你完成这次安全检查，也不能把模型自己调用本地 State 助手后写下的 off 状态当成真正关闭。

State 只保存有意写入的短句，不会默认保存整段对话。主动写进短句里的个人信息仍会留在本机，所以不要把密码、密钥或敏感原文放进去。

private 模式只保留当前本地 State 助手运行期间的临时内容。执行命令的 Hook 很快就会退出，无法保证临时内容继续存在，所以它会拒绝 `/intent remember`，也不会给成功回执。要用这条简单命令，先输入 `/intent start` 回到 standard 模式。

## 怎么卸载

装过 State，并且想删掉当前任务数据，先输入 `/intent forget`，确认拿到回执。然后在终端执行：

~~~shell
codex plugin remove intent-formation-state@intent-loop
codex plugin remove intent-formation@intent-loop
codex plugin marketplace remove intent-loop
~~~

复制到其他目录的导出文件、系统备份和 Codex 自己保存的对话不归这个插件管理，需要你单独处理。
