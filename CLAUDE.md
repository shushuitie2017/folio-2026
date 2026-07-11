# folio-2026

物理驱动的 3D 驾驶作品集（Three.js + cannon-es + TypeScript + Vite）。素材两层：`public/models`（MIT 授权 Draco 压缩 GLB：车 5 件套 + 保龄球/瓶 + 砖 + 锥筒，base.glb=视觉 / collision.glb=物理代理）+ `public/matcaps`（13 张 matcap png）；展板/字块/地标仍为运行时 canvas 生成。

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
- `src/Assets.ts` — GLTFLoader+DRACOLoader 预载全部 GLB 与 matcap（main.ts await 后才建 Experience）
- `src/Converted.ts` — GLB→matcap 网格转换器：mesh 名 `shadeRed_*`→红 matcap、`pure*`→Basic、`center_*`→重定枢轴；overrides 可换色（车身 red→blue）
- `src/CarVisual.ts` — 正版皮卡 GLB + 猫耳 + 天线摆动（逆加速度+回中力）+ 尘土 + 假影；右侧轮 quaternion 乘 rotZ(π) 防毂盖镜像
- `src/World.ts` — 区块内容：字块/展板（canvas 生成）+ GLB 道具（spawnProp: 保龄球/瓶/砖墙/锥筒），SCREEN_TILT=0.665 让可读物面向固定相机
- `src/Materials.ts` — matcap 材质：优先用加载的原版贴图，缺名回退程序化生成；onBeforeCompile 注入地面反弹光
- `src/projects.ts` — 展板数据源（改这里即换内容）

## 关键坑（已踩过）

1. **cannon-es RaycastVehicle 默认 Y-up**：必须传 `indexRightAxis:1, indexForwardAxis:0, indexUpAxis:2`，否则四轮永不接地、车不动（原版老 cannon.js 默认 Z-up 所以源码里没有这三项）
2. 速度单位是 **每毫秒位移**（原版约定），maxSpeed≈0.0097 = 9.7 unit/s，别当成 m/s 调
3. 所有可撞物 spawn 后主动 `body.sleep()`，性能靠这个；chassis 例外 `allowSleep=false`
3b. collision.glb 的 cylinder 代理在 cannon-es 里要额外乘 rotX(π/2)（cannon-es Cylinder 轴向 Y，素材按 Z-up 老 cannon 约定制作）；GLTFLoader 会把节点名里的 `.` 洗掉（`Cylinder.001`→`Cylinder001`），正则用前缀匹配；cone 代理有负 scale 记得取绝对值
4. 页面被遮挡时 rAF 降到 1fps，测试驾驶用 `window.__folio.drive()` + evaluate，别隔着截图等

## 调试句柄

浏览器 console：`__folio.speed() / .position() / .awakeBodies() / .drawCalls() / .triangles() / .drive(up,left,right,down)`

## 部署

GitHub Pages（Actions：push main → pnpm build → deploy dist）。仓库 https://github.com/shushuitie2017/folio-2026
