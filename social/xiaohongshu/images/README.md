# 小红书图片交付

四张图片均为本项目新生成的 `1086 x 1448`、3:4 竖图。视觉系统使用暖白、墨黑和珊瑚红，适合作为一组轮播发布。

| 顺序 | 文件 | 画面文字 | SHA-256 |
| --- | --- | --- | --- |
| 1 | `01-cover.png` | 先想清楚，再开工 / Intent Formation | `46947a0c1c132b62ae8a62f9a180a28877f8a30ba55a80965b4d018dcce6f7a0` |
| 2 | `02-when-to-ask.png` | 清楚就做 / 关键分岔才问 | `8d3468dc127831230fc5f55367907151f9817c649c3a77b14314dfd24a774e9f` |
| 3 | `03-three-steps.png` | 1 说任务 / 2 选方向 / 3 开始做 | `62dc202500c9722903a04ca8c7c8e435695f0f07994edbf66578854c2a1edb79` |
| 4 | `04-codex-deepseek-local.png` | Codex / DeepSeek Harness / 本地运行 | `330ccfd299ef2747b375754bf994ddc5e4d328e8a7ba268163e13b2ec01a4def` |

## 生成提示集

使用内置 OpenAI ImageGen 生成同一套 Swiss editorial 风格竖版海报：暖白纸张质感、墨黑粗体无衬线字、珊瑚红几何线条、大面积留白、不使用渐变、照片、真实商标或产品截图。四张图分别表达：开工前形成方向；清楚任务直接做、关键分岔才提问；说任务、选方向、开始做三步；Codex 与 DeepSeek Harness 均可在本地运行。

发布前已目视检查中文、英文、编号、比例和版式，并对仓库副本计算 SHA-256。
