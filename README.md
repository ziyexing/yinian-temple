# 一念 · 线上 AI 寺庙

> 香火不熄，心事有解。

一个一页式的静心站点：点一炷香写下放不下的事、摇一支签听一句解语、敲一记木鱼、与寺中师父说几句话。纯静态，无后端，可直接部署到 GitHub Pages。

线上地址：<https://ziyexing.github.io/yinian-temple/>

> 状态：仓库代码已就绪，但 GitHub Pages 尚未在仓库设置中开启，上述地址目前返回 404。
> 开启方式：仓库 Settings → Pages → Build and deployment → Source 选 **GitHub Actions**（建议同时把 Settings → Actions → General → Workflow permissions 改为 **Read and write**）。开启后推送到 `main` 即自动构建发布。

## 五处地方

| 位置 | 能做什么 |
| --- | --- |
| 山门 | 夜色寺门主视觉，按当前时辰显示「子时 · 寺门未关」，并记录你在此敬过的香、功德与签数 |
| 敬香 | 点香（铜磬音 + Canvas 青烟粒子），写下不超过 26 字的愿望，挂上木牌愿望墙（竖排、可撤下） |
| 求签 | 摇签筒（签筒晃动 + 竹签弹出），二十四支签文与解语，可输入所问之事请师父现解 |
| 木鱼 | 敲击计数（Web Audio 合成木鱼声）、功德印章、今日/连击/来访日数统计 |
| 问禅 | 与「一念师父」对话；本地禅语模式内置六大类回应，接入模型后由模型现写 |

## 另一页：金榜题名 · 考前祈愿空间

面向上海升学家长的中高考考前祈福 H5，同样一页式、纯静态：点亮文昌灯（自动生成带名字的祈福语，可复制）、敲状元鼓（每敲一句减压话，30 声有劝停）、挂许愿牌（20 字内，在古树上竖成牌，可生成朋友圈海报）、考前静心三分钟（钟声 / 雨声 / 翻书三种合成音景 + 呼吸引导倒计时）。

合规定位为「考前减压与传统文化体验」：全篇不提佛菩萨、不售法物符物开光物件、不作录取承诺；孩子名字、心愿与计数只存在本机 `localStorage`（键名 `jinbang.v1`）。

- 已发布线上版：<https://vcnf4nw9vyy2.doubao.link/app/app_17hzgk1yhfx>
- 仓库内路径：`jinbang/index.html`（Pages 开通后地址为 <https://ziyexing.github.io/yinian-temple/jinbang/>）——该文件目前只在本地产物目录，尚未随本仓库提交。

## 两种模式

- **本地禅语（默认）**：签文、解语、禅语全部内置，不联网、不需要 Key，开箱即用。
- **接入大模型**：右上角齿轮里填「OpenAI 兼容」接口（豆包方舟 / DeepSeek / OpenAI / 自定义），解签与问禅改由模型现写。

密钥只保存在本机 `localStorage`，请求由浏览器直接发往你填写的接口，不经过本站。这是纯静态站点的取舍：没有服务器替你看管密钥，也没有服务器替你转发请求。

## 隐私与边界

- 愿望、功德、对话默认只存在浏览器本地（`localStorage`，键名 `yinian.temple.v1`），不上传。
- 不做医疗、心理诊断、法律、投资建议；签文为拟古之作，解读出自程序。
- 对话内置危机兜底：出现自伤、轻生类表达时，绕过模型直接引导至身边可到场的人与全国心理援助热线 12356。
- 本站不是宗教场所，也不模仿任何宗教仪轨。

## 目录

```
index.html          页面结构
assets/base.css     设计令牌、基础排版、顶栏、山门
assets/sections.css 四座殿宇、页脚、设置面板、动效
assets/data.js      二十四支签文 + 本地禅语库
assets/app.js       交互逻辑（香火粒子 / 摇签 / 功德 / 对话 / 模型接入）
.github/workflows/pages.yml  GitHub Pages 自动部署
```

主视觉为 AI 生成的写实静物与夜景，托管在 CDN（`media.doubao.com`），页面通过绝对地址引用；如需完全自持，把这五张图下载到 `assets/` 并替换 `index.html` 中的图片地址即可。

## 本地预览

```bash
python3 -m http.server 8000
# 打开 http://127.0.0.1:8000/
```

直接双击 `index.html` 用 `file://` 打开也可以（脚本与样式均为相对路径，不依赖 fetch）。

## 部署

仓库 Settings → Pages → Source 选 **GitHub Actions**；推送到 `main` 即自动构建发布（`.github/workflows/pages.yml` 里的 `configure-pages` 带 `enablement: true`，首次运行会尝试自动开启 Pages）。

注意：工作流内的 token 无权自行创建 Pages 站点，若首次运行报 `Resource not accessible by integration`，说明 Pages 需要你在网页上手工开启一次，之后工作流才能正常部署。

## 说明

页面无障碍与降级：`prefers-reduced-motion` 时关闭粒子与动效；声音一律由点击触发，右上角常驻静音开关；圆形木鱼、签筒、愿望牌均提供 44px 以上可点区域；窄屏隐藏侧栏导航、改用底部五项导航。
