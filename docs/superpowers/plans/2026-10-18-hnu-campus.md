# HNU Campus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a static, responsive 3D HNU campus with selectable buildings and first-person interiors.

**Architecture:** Compact OSM-derived geometry feeds a Three.js scene builder. UI state and camera controls stay separate from geometry construction; procedural interiors are swapped into the same renderer.

**Tech Stack:** Vite, Three.js, vanilla JavaScript, CSS.

**Spec:** `docs/superpowers/specs/2026-10-18-hnu-campus-design.md`

## Global Constraints

- Static frontend, works under a GitHub Pages subpath.
- PC and mobile browser controls.
- Explicit source attribution and illustrative-interior label.

## Review Focus

- WebGL unavailable: show an understandable fallback message.
- Narrow screens: controls remain usable and do not cover the full scene.
- Search with no matches: show a visible empty state.
- First-person mode without pointer lock: touch drag and keyboard still operate.
- Page served from `/HNU/`: assets resolve through Vite base configuration.

### Task 1: Campus data and base scene

Create compact OSM geometry, scene terrain, roads, buildings and landmark detail in `src/data/campus.json` and `src/scene.js`. Verify the build and inspect browser rendering.

### Task 2: Navigation and interiors

Create `src/navigation.js`, `src/interior.js` and selection flow in `src/main.js`. Verify building search, focus, first-person movement, entry and exit in a browser.

### Task 3: Responsive interface and delivery

Create `src/style.css`, `README.md`, configure Vite for Pages and add GitHub Actions deployment. Run build and interactive PC/mobile checks. Commit and push over SSH.

## 执行记录

- [x] 地图提取范围扩展、南北校区资料对照、关键位置关系核验。
- [x] 430 个楼体、9 个区域、103 个目录地点及道路/水体/运动场建模。
- [x] 第一人称、移动端触控、6 类示意室内、日夜与超清/PNG 导出。
- [x] 独立代码审查及发现问题修复。
- [x] 单元与地图检查、桌面/触控浏览器交互、生产子路径检查。

发布目标：`git@github.com:wentao1176/HNU.git` 的 `main` 分支，最终发布状态以远端提交记录为准。
