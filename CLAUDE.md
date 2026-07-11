# folio-2026

物理驱动的 3D 驾驶作品集（Three.js + cannon-es + TypeScript + Vite）。零外部资产：所有网格 / matcap / 贴图运行时由代码生成。

## 命令

```bash
pnpm dev      # dev server（--port 5031，被占用会自动 +1）
pnpm build    # tsc --noEmit && vite build → dist/
pnpm preview  # 预览生产包
```

## 架构（Z-up 世界，车头 +X）

- `src/Experience.ts` — 主循环编排：vehicle.update → physics.step → syncVisuals → car.update → camera → render；点击展板开链接也在这里
- `src/PhysicsWorld.ts` — cannon-es 世界 + 接触材质 + 代理体配对 helper（addObject：盒/柱/球 ↔ 视觉容器，一律 pre-sleep）
- `src/Vehicle.ts` — RaycastVehicle（手感参数来源见 LICENSE），翻车自动复位、无输入滑行阻尼（0.6）
- `src/CarVisual.ts` — 蓝猫车网格 + 尾巴摆动（逆加速度+回中力）+ 尘土 + 假影
- `src/World.ts` — 区块内容：字块/展板/保龄球，SCREEN_TILT=0.665 让可读物面向固定相机
- `src/Materials.ts` — 程序化 matcap + onBeforeCompile 注入地面反弹光
- `src/projects.ts` — 展板数据源（改这里即换内容）

## 关键坑（已踩过）

1. **cannon-es RaycastVehicle 默认 Y-up**：必须传 `indexRightAxis:1, indexForwardAxis:0, indexUpAxis:2`，否则四轮永不接地、车不动（原版老 cannon.js 默认 Z-up 所以源码里没有这三项）
2. 速度单位是 **每毫秒位移**（原版约定），maxSpeed≈0.0097 = 9.7 unit/s，别当成 m/s 调
3. 所有可撞物 spawn 后主动 `body.sleep()`，性能靠这个；chassis 例外 `allowSleep=false`
4. 页面被遮挡时 rAF 降到 1fps，测试驾驶用 `window.__folio.drive()` + evaluate，别隔着截图等

## 调试句柄

浏览器 console：`__folio.speed() / .position() / .awakeBodies() / .drawCalls() / .triangles() / .drive(up,left,right,down)`

## 部署

GitHub Pages（Actions：push main → pnpm build → deploy dist）。仓库 https://github.com/shushuitie2017/folio-2026
