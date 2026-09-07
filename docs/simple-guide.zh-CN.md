# 用最简单的方法理解和使用 Intent Formation

它是 Codex 里的一个小插件：你让 AI 做事，看结果、提意见，它帮助 AI 跟上你现在想要的方向。

比如你说“做个给孩子用的选书卡片”，看完又说“字太挤了”，目标应该保持不变，只改排版。你说“改成给志愿者整理还书用”，目标才需要更新。

任务已经讲清楚，就直接做。确实有一个关键选择没定、猜错又会白做很多工作时，再问你一个问题或给几个小样例。

## 现在能直接装吗

这里介绍的是开发中的 `v0.3.0-beta.1`。普通反馈自动维护目标的连接正在验证；此前的独立效果实验没有通过发布门槛。

先看[下载页](https://github.com/rrrrrredy/intent-loop/releases)。没有这个版本，就先别运行下面的安装命令。已发布的 v0.2 是旧产品，不能当作这里的完整能力。

## 发布后怎么用

电脑先装好 [Codex CLI](https://developers.openai.com/codex/cli) 和 [Node.js 20 或更新版本](https://nodejs.org/en/download)。在终端输入 `codex --version`、`node --version`，都能显示版本号再继续。

Windows 打开 PowerShell；Mac 或 Linux 打开“终端”。依次粘贴：

~~~shell
codex plugin marketplace add rrrrrredy/intent-loop --ref v0.3.0-beta.1
codex plugin add intent-formation@intent-loop
codex plugin add intent-formation-state@intent-loop
~~~

新建一个 Codex 任务，检查并启用插件提供的本地脚本。Codex 会让你确认，不能跳过这次安全检查。

然后在 **Codex 的聊天框**输入一次：

~~~text
/intent start
~~~

看到 `IF-...` 回执，才表示已开启。之后照平时聊天：

> 帮我做一个给孩子选书用的卡片。
>
> 方向对，字太挤了，改一下排版。
>
> 我改主意了，改成给志愿者整理还书用。

不需要每句话都打命令，也不需要你自己维护记录编号。插件提供当前记录，Codex 负责判断哪些短句值得保留；这个判断仍可能出错。

## 只记住这三个命令

- `/intent show`：看看实际记住了什么。
- `/intent off`：关闭这个任务里的意图干预和自动更新，旧记录还在。
- `/intent forget`：删除插件保存的当前任务记录和它管理的导出文件。

这三个命令也要看到回执才算确认。记录保存在本机，但开启后会作为任务上下文交给 Codex 和你使用的模型服务处理。不应保存整段聊天，也不要让它记密码或敏感原文。

需要手动纠正某条记录、导出或使用隐私模式时，再看 [完整控制说明](../README.md#optional-local-memory-and-controls)。隐私模式的记录只留在当前助手进程里，目前不提供同样方便的简单命令路径。

## 不用了怎么卸载

先在聊天框输入 `/intent forget` 并确认回执，再关闭使用这个插件的 Codex 任务。在终端执行：

~~~shell
codex plugin remove intent-formation-state@intent-loop
codex plugin remove intent-formation@intent-loop
codex plugin marketplace remove intent-loop
~~~

Windows 若提示文件被占用，退出 Codex 后在独立 PowerShell 里重试。别删除项目源码，也别结束全部 Node 进程。你另存的导出副本和 Codex 自己的聊天记录需要单独处理。
