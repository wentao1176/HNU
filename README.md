# 湖大漫游 · 湖南大学三维校园

可部署到 GitHub Pages 的纯前端三维校园。收录湖南大学南校区、天马学生公寓一至四区、德智园公寓东/西区、财院校区和望麓桥公寓边界。当前数据包含 430 个公开楼体轮廓、9 个区域、105 段道路、103 个可搜索地点，以及运动场、园林和水体。

## 运行

```bash
npm install
npm run dev
```

浏览器打开 Vite 显示的本地地址。生产构建与检查：

```bash
npm test
npm run build
```

`dist/` 是可部署的静态文件。`vite.config.js` 已设置 `/HNU/` 路径，适配 `https://wentao1176.github.io/HNU/`。仓库内的 GitHub Actions 工作流在推送到 `main` 后尝试发布；仓库需在 **Settings → Pages → Build and deployment** 中选择 **GitHub Actions**。

## 操作

- 鸟瞰：鼠标拖动旋转、滚轮缩放；手机单指旋转、双指缩放和平移。
- 选择：点击场景里的建筑或列表里的地点；搜索框可按名称查找。
- 步行：切换“第一人称”。电脑用 WASD/方向键移动、Shift 加速、拖动鼠标或点击场景锁定指针环视；手机用左下摇杆移动、拖动画面环视。
- 进入建筑：选中建筑后点击“进入建筑”。室内可以步行浏览，从入口返回，也可用“退出建筑”按钮或 Esc。
- 日夜、画质：右上角按钮切换流畅、高清、超清；超清最高按 3 倍像素渲染，总像素数限制在 900 万以内。
- 图片导出：右上角下载按钮导出最长边 3840 像素的 PNG 场景视图。

## 数据与还原范围

校园相对布局参照[湖南大学官方南、北校区总平面图](https://www.hnu.edu.cn/xysh/xydt/xxdt.htm)。建筑平面、道路和区域使用 [© OpenStreetMap contributors](https://www.openstreetmap.org/copyright) 数据，按 [ODbL](https://opendatacommons.org/licenses/odbl/) 许可。`src/data/campus.json` 是 2026-10-18 从公开 OSM 数据提取并简化的派生数据；脚本 `scripts/prepare-map.py` 说明变换方式。重新生成时，将南校区 Overpass JSON 保存为根目录 `osm.json`，将财院校区 [OSM API 地图导出](https://api.openstreetmap.org/api/0.6/map?bbox=112.920,28.196,112.934,28.207)保存为 `osm-north-full.xml`，运行 `python scripts/prepare-map.py`。南校区查询：

```text
[out:json][timeout:120];
(
  way[building](28.1615,112.931,28.189,112.955);
  way[highway](28.1615,112.931,28.189,112.955);
  way[leisure](28.1615,112.931,28.189,112.955);
  way[landuse](28.1615,112.931,28.189,112.955);
  node[name](28.1615,112.931,28.189,112.955);
  way[name](28.1615,112.931,28.189,112.955);
);
out geom;
```

复临舍玻璃立面和切角、研楼院落及水刷石等特征参考[复临舍建筑介绍](https://news.hnu.edu.cn/info/1027/12780.htm)与[研楼建筑介绍](https://news.hnu.edu.cn/info/1023/15511.htm)。[新生校园介绍](https://law.hnu.edu.cn/info/1219/17033.htm)、[后勤服务指南](https://hqfw.hnu.edu.cn/info/1010/1129.htm)用于确认建筑功能与生活区位置。

**准确度说明：** 场景保留可获取的地理相对位置与楼体轮廓；楼高、部分立面、植被、地形与道路细节为估计。所有室内均是功能示意，不代表真实房间布局、开放状态或进出方式。望麓桥公寓当前仅有园区边界；其余区域也可能存在公开地图尚未收录的楼宇。场景不使用照片素材或在线地图瓦片。逐点复核记录见 [地图审查记录](docs/map-audit.md)。
