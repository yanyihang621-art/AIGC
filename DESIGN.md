# Design

## Theme
- **Strategy**: Restrained (大量留白，主色调定基调，点缀色极简使用)。
- **Mood**: 宣纸上的霁蓝微光——安静的留白，隐秘的力量，水墨与青花的现代回响。

## Colors (OKLCH)
- **bg**: `oklch(0.990 0.005 85)` (宣纸白 - 极浅的温润暖白，网页的全局背景)
- **surface**: `oklch(0.960 0.010 85)` (浅绢色 - 用于卡片、弹出对话框或特定卡块)
- **ink**: `oklch(0.200 0.020 230)` (黛墨 - 主要文字与重色线条，对比度 ≥7:1)
- **primary**: `oklch(0.450 0.086 230.0)` (霁蓝/Indigo - 视觉锚点、按钮及交互核心)
- **accent**: `oklch(0.450 0.080 35)` (暗朱砂 - 极度克制的印章或警告点缀色，绝不大面积使用)
- **muted**: `oklch(0.550 0.015 230)` (淡墨 - 用于次要文本，对比度 ≥3.5:1)

## Typography
- **Display**: 宋体/衬线体 (e.g., Noto Serif SC, SimSun)，用于大标题、叙事断句、古诗词展示，体现传统底蕴。
- **Body**: 黑体/无衬线体 (e.g., Inter, Noto Sans SC)，用于正文和系统说明，确保各设备可读性。
- **Scale**: 陡峭的字号对比。网页大标题与正文之间通过极端的字号差形成强烈张力。
- **Web Specifics**: 大标题字重设为 Bold，添加 `text-wrap: balance`，英文字体搭配使用，文字行高保持在 1.6–1.8 之间，提供呼吸感。

## Layout & Composition (网页布局)
- **Asymmetric Composition (非对称构图)**：遵循国画“疏可跑马，密不透风”原则。内容不采用死板的左右均分或九宫格，而是采用大片偏左/偏右留白，主体偏斜对角线排布。
- **Full-screen Sections (全屏画幅)**：每个核心内容段落（故事、互动区）应占据独立的全屏画幅（`min-height: 100vh`），使评委能沉浸在当前的单个叙事点中。
- **Minimalist Navigation (极简导航)**：顶部采用隐藏式悬浮导航，仅在向上滚动时出现，或仅保留极小图标，最大程度减少非内容元素的视觉干扰。
- **Interactive Canvas (互动画布)**：核心的 AI 书法或传统生成区域定义为一个“虚拟宣纸卷轴”，以物理边缘阴影和温润质感与底层背景做柔和区隔。

## Motion & Interaction (动效与交互)
- 绝对禁止使用弹簧 (bounce) 动效。
- 采用缓慢、极其流畅的指数级缓动曲线 (ease-out-expo 或 ease-out-quint)。
- **Scroll-linked Reveal (滚动显现)**：元素在进入视口（viewport）时，使用 `opacity`（0 -> 1）与 `filter: blur(10px -> 0px)`、`transform: translateY(20px -> 0)` 交织的慢速过渡，模拟水墨在宣纸上逐渐晕开渗透的过程。
- **Page Transitions (转场)**：全屏画幅之间过渡时，采用遮罩（Masking）或水墨泼开的遮罩过渡效果，而不是死板的幻灯片式滑动。
- **Loading State (加载中状态)**：AI 的生成状态不使用转圈圈，应设计为渐显的传统元素轮廓、呼吸式的霁蓝光晕或宣纸上晕染开的动态水墨点。

