# 两分钟上手 Intent Formation

## 它有什么用

Intent Formation 是装在 Codex 里的一个小插件。你一边让 Codex 做事，一边看结果、提意见，它帮助 Codex 跟上你现在想要的方向。

任务很清楚时，Codex 直接做。方向没定，而且猜错会浪费很多时间时，它只问一个有用的问题，或者给你两三个具体方案看。你照平时的方式说话就行。

## 最简单的安装方法

以下命令适用于 `v0.3.0-beta.1`。先打开 [下载页](https://github.com/rrrrrredy/intent-loop/releases)，确认能看到这个版本；如果还没有，就先不要运行下面的命令。旧版请按下载页对应版本的说明安装。

电脑需要有 [Codex CLI 官方版](https://developers.openai.com/codex/cli) 和 [Node.js 官方版](https://nodejs.org/en/download)。安装后关闭并重新打开终端，分别输入 `node --version` 和 `codex --version`：前者应显示 20 或更高版本，后者应显示 Codex 版本。这里常说的 PATH，简单理解就是“终端能直接找到并运行这个命令”。如果看到“找不到命令”或 `command not found`，先按对应链接完成安装，再重新打开终端重试。

Windows 打开 PowerShell，macOS 打开“终端”，Linux 打开 Terminal。依次粘贴下面两行：

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.3.0-beta.1
codex plugin add intent-formation@intent-loop
~~~

安装后新建一个 Codex 任务。Codex 提示检查 Hook 时，先看内容，再启用。Hook 就是插件在你发送消息前运行的本地脚本。只装核心即可开始；可选 State 的脚本更长，不能省略来源和内容检查，不确定时先不要开启 State。

到这里就能用了，不用学命令，也不用填表。

## 怎么用

直接说你要做什么：

> 帮我做一个产品首页，要显得专业。

“专业”有几种理解，也不一定需要先问你。如果一个小草稿就能让你判断，Codex 会先做。只有没定的方向会明显改变接下来的工作、猜错的代价又高时，它才会问一个具体问题，或者给出少量可比较的样例。你可以选一个、混合兼容的方向，也可以说都不对。

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
- `/intent correct 记录ID => 新内容`：纠正一条记录；先用 show 找到要改的记录 ID。
- `/intent private`：清掉已落盘的当前任务内容，之后只在本次进程内临时保存。
- `/intent off`：关闭当前任务的意图干预和状态更新。
- `/intent export`：在 standard 或 off 模式导出 JSON 文件，并给出不包含本机路径的导出 ID 和 SHA-256 校验值；private 模式不会把临时内容写盘。
- `/intent forget`：删除插件管理范围内的当前任务记录和导出文件。

`/intent off` 只有在你已经检查并信任 State 的 Hook，而且命令返回 `IF-...` 回执时才算生效。自动命令模式 `codex exec` 没有可点击的检查界面，不能替你完成这次安全检查，也不能把模型自己调用本地 State 助手后写下的 off 状态当成真正关闭。

State 只保存有意写入的短句，不会默认保存整段对话。主动写进短句里的个人信息仍会留在本机，所以不要把密码、密钥或敏感原文放进去。

private 模式不保存任务标题和工作区信息，临时记录只在当前本地 State 助手运行期间存在。执行命令的 Hook 很快就会退出，也读不到另一个进程的临时记录，所以它会拒绝私密模式下的 remember、feedback、show 和 correct 命令，不给成功回执。要用这些简单命令，先输入 `/intent start` 回到 standard 模式。

## 已保存的目标怎么改

在 standard 模式下依次输入下面三行。第二行的 `rec_123` 要先换成 show 里那条记录的真实 ID：

~~~text
/intent show
/intent correct rec_123 => 只给下午的排练组准备材料
/intent show
~~~

纠正后，新内容成为当前目标，旧内容仍保留在历史里。需要删除时，用 `/intent forget`。

| 模式 | 常用简单命令 | 数据在哪里 |
| --- | --- | --- |
| standard | 保存、查看、纠正、反馈、导出、删除 | 本机磁盘 |
| private | 可切换模式或删除；保存、查看、纠正、反馈、导出的简单命令不可用 | 临时记录只在同一个 State MCP 进程里，目前没有等价的新手命令路径 |
| off | 查看、导出、删除；用 start 重新开启 | 保留旧记录，不新增 |

导出回执中的 SHA-256 校验的是 JSON 里的指定内容，不是整个文件的字节，所以不要直接拿它和系统的文件哈希比较。导入时会自动检查；需要自己核对时，见[导出校验说明](export-verification.md)。

## 怎么卸载

装过 State，并且想删掉当前任务数据，先输入 `/intent forget`，确认拿到回执。然后关闭正在使用插件的 Codex 任务，在终端执行：

~~~shell
codex plugin remove intent-formation-state@intent-loop
codex plugin remove intent-formation@intent-loop
codex plugin marketplace remove intent-loop
~~~

Windows 如果提示“文件正在使用”或 `os error 32`，先退出 Codex 应用，再打开独立的 PowerShell 重试卸载。不要删除项目源码，也不要结束所有 Node 进程；其他程序也可能在用 Node。

复制到其他目录的导出文件、系统备份和 Codex 自己保存的对话不归这个插件管理，需要你单独处理。

如果进入 private 后只想恢复常规保存、查看，输入 `/intent start`。之后新保存的记录会重新写入本地；已经清除的旧记录不会恢复。private 目前没有同样便捷的 slash 保存、查看入口，技术小白可以先用标准模式。
