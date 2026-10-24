/**
 * 岳麓书院总平面（据 OSM 实测轮廓 + 文献考证重建）
 *
 * 坐标系：OSM 实测（x 东，z 南），单位米。
 * 以赫曦台中心为原点，u 为沿中轴「由东向西进入」的距离，v 为横向（北为正）。
 * 中轴方位取自 OSM 中赫曦台与御书楼的实际连线，约东偏南 10.4°。
 *
 * 实测锚点（OSM way 中心换算）：
 *   赫曦台 (0,0) 8.3×12.3 ｜ 教学斋 (52.2,-28.3) 50.6×15.7 ｜ 半学斋 (52.1,31.7) 49.3×16.9
 *   御书楼 (136,1) 17.2×18.9 ｜ 大成殿 (85,60.8) 15.9×24.2（面阔南北向，朝东）
 *   崇圣祠 (116.7,62.6) ｜ 文昌阁 (100.6,48.1) ｜ 明伦堂 (87.8,81.1) 29.6×13（朝南）
 *   吹香亭 (-7.8,91.5) ｜ 风雩亭 (-9.8,-49.3) ｜ 望江楼 (159,58.1) ｜ 延宾馆 (192,-39)
 *   专祠群：自 (145,-15) 至 (90,-72) 的对角带，祠宇面朝东北
 * 文献：头门→赫曦台→大门→二门→讲堂→御书楼；文庙在书院北侧自成东西轴线（朝东）。
 */

export const ORIGIN = { x: -60.8, z: 187.5 };
export const AXIS = { x: -0.9835, z: -0.180 };
export const RIGHT = { x: 0.180, z: -0.9835 };
/** 建筑正面（局部 +z）朝向世界坐标的旋转角 */
export const ROT = Math.atan2(0.9835, 0.180);

export function at(u, v) {
  return {
    x: ORIGIN.x + AXIS.x * u + RIGHT.x * v,
    z: ORIGIN.z + AXIS.z * u + RIGHT.z * v,
  };
}

/** 朝向 helper：b.rot 使建筑正面朝 (du,dv) 方向（uv 坐标系） */
export function rotFace(du, dv) {
  const wx = du * AXIS.x + dv * RIGHT.x;
  const wz = du * AXIS.z + dv * RIGHT.z;
  return Math.atan2(wx, wz) - ROT;
}
// 常用朝向：沿轴（朝东/入口）、朝西、朝南（-v）、朝北（+v）
export const FACE_E = 0;
export const FACE_W = Math.PI;
export const FACE_N = Math.PI / 2;
export const FACE_S = -Math.PI / 2;
/** 专祠对角带朝向（面朝东北） */
export const FACE_NE_ROW = rotFace(-0.724, 0.689);

/** 建筑清单 */
export const BUILDINGS = [
  /* ── 中轴 ── */
  {
    id: 'toumen', name: '头门', tag: '门屋', type: 'hall',
    u: -13.5, v: 0, rot: 0,
    info: '书院第一道门，单檐硬山三间，悬「千年学府」匾——岳麓书院自北宋开宝九年（976）创建，办学千年未断，世所罕见。',
    meta: [['形制', '单檐硬山'], ['开间', '三间'], ['匾额', '千年学府']],
    interior: { room: 'gate' },
    opts: {
      width: 11.5, depth: 5.8, bayWidths: [3.4, 4.7, 3.4],
      columnH: 4.0, platformH: 0.42, platformPad: 1.1,
      roofStyle: 'gable', roofRise: 2.2, overhangX: 0.9, overhangZ: 0.85,
      frontType: 'gate', backType: 'gate3', stepsWidth: 5.4,
      wallMat: 'plaster',
      plaque: { text: '千年学府', width: 2.6, height: 0.86, y: 3.15, bg: '#111008', fg: '#d8b96a' },
      drumStones: true,
    },
  },
  {
    id: 'hexitai', name: '赫曦台', tag: '戏台', type: 'hexitai',
    u: 0.6, v: 0, rot: 0,
    info: '清乾隆五十五年（1790）山长罗典建于大门前坪，平面凸字形，前部单檐歇山戏台，后部三间硬山。跨进头门迎面即此台，行人由两翼过道穿行。台上内壁存朱熹、张栻所书「福」「寿」二大字。',
    meta: [['形制', '单檐歇山 · 凸形平面'], ['创建', '清乾隆五十五年'], ['题字', '福 · 寿']],
    opts: { frontW: 8.6, frontD: 4.4, backW: 12.3, backD: 4.8, platformH: 1.05, columnH: 4.0, roofRise: 2.6 },
  },
  {
    id: 'gate', name: '大门', tag: '头门', type: 'hall',
    u: 20, v: 0, rot: 0,
    info: '南方将军门式，五间硬山出三山屏风墙，建于高台之上。门额「岳麓书院」传为宋真宗御笔（大中祥符八年赐），门联「惟楚有材，于斯为盛」——上联出《左传》，下联出《论语》，为书院最著名的一副门联。',
    meta: [['形制', '五间硬山 · 三山屏风墙'], ['门式', '南方将军门式'], ['门额', '宋真宗御笔']],
    interior: { room: 'gate' },
    detail: 'high',
    opts: {
      width: 17.5, depth: 8.8, bayWidths: [3.0, 3.2, 5.1, 3.2, 3.0],
      columnH: 4.7, platformH: 1.32, platformPad: 1.4,
      roofStyle: 'gable', roofRise: 2.9, overhangX: 1.15, overhangZ: 1.1,
      frontType: 'gate', backType: 'gate3', stepsWidth: 7.4,
      wallMat: 'plaster',
      screenGables: 3,
      plaque: { text: '岳麓书院', width: 3.4, height: 1.1, bg: '#0b0906', fg: '#c9a35c', y: 3.6 },
      couplets: { left: '惟楚有材', right: '于斯为盛' },
      drumStones: true,
      generalDoor: true,
    },
  },
  {
    id: 'ermen', name: '二门', tag: '仪门', type: 'hall',
    u: 33, v: 0, rot: 0,
    info: '明弘治七年（1494）建，五间单檐悬山，中三间开三门，抗战中被炸毁，1984 年重建。正面悬「名山坛席」匾，背面悬程颂万所题「潇湘槐市」——誉书院人才之盛如汉代太学槐市。',
    meta: [['形制', '五间单檐悬山'], ['开间', '中三间开三门'], ['匾额', '名山坛席 · 潇湘槐市']],
    interior: { room: 'gate' },
    opts: {
      width: 17.4, depth: 6.8, bayWidths: [3.1, 3.3, 4.6, 3.3, 3.1],
      columnH: 4.3, platformH: 0.55, platformPad: 1.1,
      roofStyle: 'gable', roofRise: 2.4, overhangX: 0.95, overhangZ: 0.9,
      frontType: 'gate3', backType: 'gate3', stepsWidth: 6.4,
      wallMat: 'plaster',
      plaque: { text: '名山坛席', width: 2.4, height: 0.8, y: 3.35 },
      plaqueBack: { text: '潇湘槐市', width: 2.4, height: 0.8, y: 3.35 },
      drumStones: true,
    },
  },
  {
    id: 'jiangtang', name: '讲堂', tag: '讲学', type: 'hall',
    u: 87.5, v: 0, rot: 0,
    info: '书院核心，五间单檐歇山，前出轩廊七间，后连拜厅，总面积 468 平方米，屋高 9.47 米。现存构架为清康熙二十六年重建、同治七年大修遗构。檐下悬「实事求是」匾；堂内两壁嵌朱熹手书「忠孝廉节」「整齐严肃」碑。乾道三年（1167）朱张会讲于此，一时生徒千余。',
    meta: [['形制', '五间单檐歇山 · 前轩廊七间'], ['面积', '468 ㎡'], ['匾额', '实事求是 · 道南正脉']],
    interior: { room: 'lecture' },
    detail: 'high',
    opts: {
      width: 21.5, depth: 12.6, bayWidths: [3.6, 4.0, 6.3, 4.0, 3.6],
      columnH: 5.5, platformH: 0.95, platformPad: 1.9,
      roofStyle: 'xieshan', roofRise: 4.3, overhangX: 1.35, overhangZ: 1.25,
      curve: 1.34, lift: 0.66, flare: 0.4,
      frontType: 'open', stepsWidth: 8.0,
      xuanLang: { width: 26.5, depth: 3.0, columnH: 3.9, rise: 1.7 },
      baiTing: { width: 21.5, depth: 5.6, columnH: 4.2, rise: 2.2 },
      plaque: { text: '实事求是', width: 3.0, height: 1.0, bg: '#0b0906', fg: '#cfae6b', y: 4.45 },
      railing: false,
    },
  },
  {
    id: 'yushulou', name: '御书楼', tag: '藏书', type: 'tower',
    u: 136, v: 0.5, rot: 0,
    info: '书院藏书之所，始建於宋咸平二年（999），清康熙二十六年（1687）巡抚丁思孔建于今址，1986 年重修。两层重檐歇山，面阔五间，高出全院以示尊崇。楼前两侧设廊，接拟兰、汲泉二亭，亭前临池。',
    meta: [['形制', '两层重檐歇山'], ['功能', '藏书'], ['始建', '宋咸平二年']],
    interior: { room: 'library' },
    opts: {
      width: 18.8, depth: 15.5, floors: 2, floorH: 4.4,
      platformH: 1.5, platformPad: 2.2,
      roofStyle: 'xieshan', roofRise: 4.0, overhangX: 1.5, overhangZ: 1.35,
      plaque: true, plaqueText: '御书楼',
    },
  },

  /* ── 讲堂两厢（斋舍沿中轴长向布置，实测 50×16） ── */
  {
    id: 'jiaoxuezhai', name: '教学斋', tag: '斋舍', type: 'hall',
    u: 52.2, v: -28.3, rot: FACE_N,
    info: '讲堂前院南侧斋舍，与半学斋对称，为生徒居止读书之处。光绪二十九年（1903）书院改制学堂时所建。「教学」取《礼记·学记》「教学相长」之义。',
    meta: [['形制', '单檐硬山 · 长舍'], ['朝向', '坐南朝北'], ['功能', '斋舍']],
    interior: { room: 'dorm' },
    opts: {
      width: 49, depth: 14.5, bayWidths: Array(10).fill(4.9),
      columnH: 3.8, platformH: 0.5, platformPad: 1.0,
      roofStyle: 'gable', roofRise: 2.4, overhangX: 0.9, overhangZ: 0.85,
      frontPorch: 1.8, frontType: 'door', steps: false, drumStones: false,
      ornament: false,
    },
  },
  {
    id: 'banxuezhai', name: '半学斋', tag: '斋舍', type: 'hall',
    u: 52.1, v: 31.7, rot: FACE_S,
    info: '讲堂前院北侧斋舍，与教学斋对称。「半学」取「学而后知不足」之意。1917—1919 年，青年毛泽东曾在此寓居，与蔡和森等研讨时事。',
    meta: [['形制', '单檐硬山 · 长舍'], ['朝向', '坐北朝南'], ['史迹', '毛泽东寓居处']],
    interior: { room: 'dorm' },
    opts: {
      width: 48, depth: 15.2, bayWidths: Array(10).fill(4.8),
      columnH: 3.8, platformH: 0.5, platformPad: 1.0,
      roofStyle: 'gable', roofRise: 2.4, overhangX: 0.9, overhangZ: 0.85,
      frontPorch: 1.8, frontType: 'door', steps: false, drumStones: false,
      ornament: false,
    },
  },
  {
    id: 'xiangshui', name: '湘水校经堂', tag: '讲学', type: 'hall',
    u: 104, v: -14.5, rot: FACE_N,
    info: '清道光十一年（1831）湖南巡抚吴荣光创建，专课经史，不习举业，开湖南近代经学教育之先。居讲堂与御书楼之间，北向开门，独立成院。',
    meta: [['形制', '单檐硬山'], ['创建', '清道光十一年'], ['功能', '经学讲习']],
    opts: {
      width: 14.5, depth: 8.5, bayWidths: [3.2, 3.6, 4.5, 3.2],
      columnH: 4.0, platformH: 0.6, platformPad: 1.2,
      roofStyle: 'gable', roofRise: 2.6, frontType: 'door', frontPorch: 1.5,
      plaque: { text: '湘水校经堂', width: 2.6, height: 0.78, y: 3.1 },
      steps: true, stepsWidth: 4.4, drumStones: false,
    },
  },
  {
    id: 'baiquanxuan', name: '百泉轩', tag: '园林', type: 'hall',
    u: 117, v: -26, rot: rotFace(0.35, 1),
    info: '书院园林建筑，处清风峡谷口，溪泉荟萃，故名。北宋创建书院时即有，历代山长燕居之所，朱熹、张栻曾彻夜谈经于此。轩前文泉澄澈，曲涧鸣泉，为「书院八景」之一。',
    meta: [['形制', '单檐歇山 · 临水'], ['始建', '北宋开宝九年'], ['景致', '曲涧鸣泉']],
    interior: { room: 'lounge' },
    opts: {
      width: 14, depth: 8.5, bayWidths: [3.0, 4.0, 4.0, 3.0],
      columnH: 3.8, platformH: 0.55, platformPad: 1.4,
      roofStyle: 'xieshan', roofRise: 2.8, overhangX: 1.15, overhangZ: 1.0,
      frontType: 'door', frontPorch: 1.6, steps: true, stepsWidth: 3.6,
      plaque: { text: '百泉轩', width: 2.0, height: 0.66, y: 3.0 },
      drumStones: false, railing: true,
    },
  },

  /* ── 专祠群（实测对角带，祠宇面朝东北，自东北向西南：慎斋→船山→六君子→崇道→四箴→濂溪） ── */
  {
    id: 'shenzhaici', name: '慎斋祠', tag: '专祠', type: 'hall',
    u: 141.5, v: -20.5, rot: FACE_NE_ROW,
    info: '祀书院山长罗典（号慎斋）。罗典主院二十七年，拓建园林，增置学田，书院规制于斯为大。初建于咸丰年间，今恢复于船山祠北侧。',
    meta: [['形制', '单檐硬山'], ['奉祀', '罗典']],
    opts: {
      width: 12, depth: 9, bayWidths: [3.5, 5.0, 3.5],
      columnH: 3.5, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, frontType: 'door', steps: true, stepsWidth: 3.0,
      plaque: { text: '慎斋祠', width: 1.7, height: 0.54, y: 2.8 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'chuanshanci', name: '船山祠', tag: '专祠', type: 'hall',
    u: 132.5, v: -29.5, rot: FACE_NE_ROW,
    info: '祀王夫之。船山先生明亡后隐居石船山，著书四十年，为湖湘学派集大成者。',
    meta: [['形制', '单檐硬山'], ['奉祀', '王夫之']],
    opts: {
      width: 12, depth: 9, bayWidths: [3.5, 5.0, 3.5],
      columnH: 3.5, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, frontType: 'door', steps: true, stepsWidth: 3.0,
      plaque: { text: '船山祠', width: 1.7, height: 0.54, y: 2.8 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'liujunzi', name: '六君子堂', tag: '专祠', type: 'hall',
    u: 123.5, v: -38.5, rot: FACE_NE_ROW,
    info: '祀宋、明两代对书院有建树之六人：朱洞、周式、刘鳌、李允则、周辛甫、刘珙。原《濂溪祠记》碑存于堂内。',
    meta: [['形制', '单檐硬山'], ['奉祀', '六先生']],
    opts: {
      width: 12.6, depth: 9.5, bayWidths: [3.7, 5.2, 3.7],
      columnH: 3.6, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.3, frontType: 'door', steps: true, stepsWidth: 3.2,
      plaque: { text: '六君子堂', width: 1.9, height: 0.58, y: 2.85 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'chongdaoci', name: '崇道祠', tag: '专祠', type: 'hall',
    u: 114.5, v: -47.5, rot: FACE_NE_ROW,
    info: '又称朱张祠，祀朱熹、张栻。乾道三年（1167）朱张会讲于此，开书院自由讲学之风。',
    meta: [['形制', '单檐硬山'], ['奉祀', '朱熹 · 张栻'], ['史事', '朱张会讲']],
    opts: {
      width: 12.6, depth: 9.5, bayWidths: [3.7, 5.2, 3.7],
      columnH: 3.6, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.3, frontType: 'door', steps: true, stepsWidth: 3.2,
      plaque: { text: '斯文正脉', width: 2.0, height: 0.62, y: 2.85 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'sizhenting', name: '四箴亭', tag: '专祠', type: 'hall',
    u: 105.5, v: -56.5, rot: FACE_NE_ROW,
    info: '祀程颢、程颐兄弟，清嘉庆二十三年（1818）迁建今址。亭内嵌「视、听、言、动」四箴碑，为二程理学修身之要。',
    meta: [['形制', '单檐硬山'], ['奉祀', '程颢 · 程颐'], ['碑刻', '四箴碑']],
    opts: {
      width: 12, depth: 9, bayWidths: [3.5, 5.0, 3.5],
      columnH: 3.5, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, frontType: 'door', steps: true, stepsWidth: 3.0,
      plaque: { text: '圣学渊源', width: 2.0, height: 0.62, y: 2.8 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'lianxici', name: '濂溪祠', tag: '专祠', type: 'hall',
    u: 96.5, v: -65.5, rot: FACE_NE_ROW,
    info: '祀周敦颐，清嘉庆十七年（1812）建。周氏世称濂溪先生，著《太极图说》《通书》，为理学开山。',
    meta: [['形制', '单檐硬山'], ['奉祀', '周敦颐']],
    opts: {
      width: 12, depth: 9, bayWidths: [3.5, 5.0, 3.5],
      columnH: 3.5, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, frontType: 'door', steps: true, stepsWidth: 3.0,
      plaque: { text: '悠然太极', width: 2.0, height: 0.62, y: 2.8 },
      drumStones: false, ornament: false,
    },
  },

  /* ── 文庙（书院北侧，独立成院，黄琉璃，整组建筑朝东） ── */
  {
    id: 'dachengmen', name: '大成门', tag: '文庙', type: 'hall',
    u: 63.5, v: 60.8, rot: 0,
    info: '文庙正门，面阔三间，单檐歇山，黄琉璃瓦。明正德二年（1507）吴世忠建文庙于院左（北），文庙与书院并置且用皇家规制，为全国书院所仅见。',
    meta: [['形制', '单檐歇山 · 黄琉璃'], ['开间', '三间']],
    opts: {
      width: 14, depth: 7.5, bayWidths: [4.0, 6.0, 4.0],
      columnH: 4.4, platformH: 0.75, platformPad: 1.3,
      roofStyle: 'xieshan', roofRise: 3.0, overhangX: 1.15, overhangZ: 1.05,
      tile: 'glazedYellow', frontType: 'gate', stepsWidth: 6.0,
      plaque: { text: '大成门', width: 2.2, height: 0.72, y: 3.5, fg: '#e0c070' },
      drumStones: true,
    },
  },
  {
    id: 'dachengdian', name: '大成殿', tag: '文庙', type: 'tower',
    u: 85.2, v: 60.8, rot: 0,
    info: '文庙主殿，重檐歇山，黄琉璃瓦，藻井天花，前有月台，属帝王规格。南宋建礼殿，明弘治十八年（1505）改称大成殿；抗战中被炸毁，仅存石雕石狮，今殿为重建。殿内祀孔子及四配十二哲。',
    meta: [['形制', '重檐歇山 · 黄琉璃'], ['奉祀', '孔子及四配'], ['等级', '皇家规制']],
    interior: { room: 'shrine' },
    detail: 'high',
    opts: {
      width: 24.2, depth: 15.9, floors: 2, floorH: 5.3,
      platformH: 1.9, platformPad: 2.6,
      roofStyle: 'xieshan', roofRise: 4.6, overhangX: 1.7, overhangZ: 1.5,
      tile: 'glazedYellow', plaque: true, plaqueText: '万世师表',
      yuetai: { w: 13, d: 5.0 },
    },
  },
  {
    id: 'minghuanci', name: '名宦祠', tag: '文庙', type: 'hall',
    u: 58, v: 44.8, rot: FACE_N,
    info: '文庙前院南侧庑舍，祀历代治湘有惠政的官员，为大成门两庑配享。',
    meta: [['形制', '单檐硬山 · 黄琉璃'], ['功能', '配祀名宦']],
    opts: {
      width: 24, depth: 6.5, bayWidths: Array(6).fill(4.0),
      columnH: 3.6, platformH: 0.5, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, tile: 'glazedYellow',
      frontType: 'door', frontPorch: 1.4, steps: false, drumStones: false, ornament: false,
    },
  },
  {
    id: 'xiangxianci', name: '乡贤祠', tag: '文庙', type: 'hall',
    u: 58, v: 77.5, rot: FACE_S,
    info: '文庙前院北侧庑舍，祀湖南历代乡贤，与名宦祠东西对称。实测北部庑廊自成一路，东起文庙院门。',
    meta: [['形制', '单檐硬山 · 黄琉璃'], ['功能', '配祀乡贤']],
    opts: {
      width: 24, depth: 6.5, bayWidths: Array(6).fill(4.0),
      columnH: 3.6, platformH: 0.5, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.2, tile: 'glazedYellow',
      frontType: 'door', frontPorch: 1.4, steps: false, drumStones: false, ornament: false,
    },
  },
  {
    id: 'chongshengci', name: '崇圣祠', tag: '文庙', type: 'hall',
    u: 117, v: 62.6, rot: 0,
    info: '祀孔子五代祖先，位于大成殿之后（西），单檐歇山黄琉璃。',
    meta: [['形制', '单檐歇山 · 黄琉璃'], ['奉祀', '孔子先世']],
    opts: {
      width: 19.6, depth: 9.5, bayWidths: [4.6, 6.4, 4.6, 4.0],
      columnH: 4.2, platformH: 0.8, platformPad: 1.2,
      roofStyle: 'xieshan', roofRise: 2.9, tile: 'glazedYellow',
      frontType: 'door', steps: true, stepsWidth: 4.4,
      plaque: { text: '崇圣祠', width: 2.0, height: 0.64, y: 3.4 },
      drumStones: false,
    },
  },
  {
    id: 'mingluntang', name: '明伦堂', tag: '文庙', type: 'hall',
    u: 87.8, v: 81.3, rot: FACE_S,
    info: '文庙讲学之所，取「明人伦」之义，面阔五间，坐北朝南，居大成殿之后。明清两代为生员课读之地。',
    meta: [['形制', '单檐硬山'], ['功能', '讲学'], ['朝向', '坐北朝南']],
    interior: { room: 'classroom' },
    opts: {
      width: 29.6, depth: 12.9, bayWidths: [4.6, 5.0, 7.6, 5.0, 4.6, 2.8],
      columnH: 4.6, platformH: 0.85, platformPad: 1.6,
      roofStyle: 'gable', roofRise: 3.2,
      frontType: 'open', frontPorch: 2.0, stepsWidth: 7.0,
      plaque: { text: '明伦堂', width: 2.4, height: 0.78, y: 3.7 },
      drumStones: true,
    },
  },
  {
    id: 'wenchangge', name: '文昌阁', tag: '文庙', type: 'tower',
    u: 100.6, v: 48.1, rot: 0,
    info: '祀文昌帝君，二层楼阁，黄琉璃瓦。旧时士子祈科第之所，居文庙前院东南。',
    meta: [['形制', '二层楼阁 · 黄琉璃'], ['奉祀', '文昌帝君']],
    opts: {
      width: 12.6, depth: 11, floors: 2, floorH: 3.8,
      platformH: 0.9, platformPad: 1.4,
      roofStyle: 'xieshan', roofRise: 3.0, overhangX: 1.2, overhangZ: 1.1,
      tile: 'glazedYellow', plaque: true, plaqueText: '文昌阁',
    },
  },

  /* ── 北侧诸建筑 ── */
  {
    id: 'quzici', name: '屈子祠', tag: '专祠', type: 'hall',
    u: 31, v: 82, rot: FACE_S,
    info: '祀屈原。屈原放逐沅湘，行吟泽畔，湖湘忠愤之气自此始。祠居书院北垣下，自成小院。',
    meta: [['形制', '单檐硬山'], ['奉祀', '屈原']],
    opts: {
      width: 14, depth: 8.5, bayWidths: [3.6, 5.0, 3.6, 1.8],
      columnH: 3.9, platformH: 0.6, platformPad: 1.1,
      roofStyle: 'gable', roofRise: 2.4, frontType: 'door', frontPorch: 1.4,
      plaque: { text: '屈子祠', width: 1.9, height: 0.6, y: 3.1 },
      drumStones: false,
    },
  },
  {
    id: 'jianyuan', name: '监院', tag: '院务', type: 'hall',
    u: 16, v: 36, rot: FACE_S,
    info: '书院监院（后称院务）办公之所，掌钱粮、修缮、生员名籍。',
    meta: [['形制', '单檐硬山'], ['功能', '院务']],
    opts: {
      width: 12.5, depth: 7.5, bayWidths: [3.2, 4.4, 3.2, 1.7],
      columnH: 3.6, platformH: 0.5, platformPad: 1.0,
      roofStyle: 'gable', roofRise: 2.2, frontType: 'door', frontPorch: 1.3,
      plaque: { text: '监院', width: 1.5, height: 0.5, y: 2.85 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'canglin', name: '仓廪', tag: '院务', type: 'hall',
    u: 12, v: -32, rot: FACE_N,
    info: '书院学田所入储于此，以供师生廪食。',
    meta: [['形制', '单檐硬山'], ['功能', '储粮']],
    opts: {
      width: 11, depth: 6.5, bayWidths: [3.6, 4.8, 2.6],
      columnH: 3.2, platformH: 0.5, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.0, frontType: 'wall',
      steps: false, drumStones: false, ornament: false, interior: false,
    },
  },
  {
    id: 'paochu', name: '庖厨', tag: '院务', type: 'hall',
    u: 1, v: -34, rot: FACE_N,
    info: '膳堂与厨灶。书院生员数百，饮食皆出于此。',
    meta: [['形制', '单檐硬山'], ['功能', '膳食']],
    opts: {
      width: 12, depth: 7, bayWidths: [3.6, 5.0, 3.4],
      columnH: 3.3, platformH: 0.5, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.0, frontType: 'wall',
      steps: false, drumStones: false, ornament: false, interior: false,
    },
  },
  {
    id: 'shanzhai', name: '山斋', tag: '斋舍', type: 'hall',
    u: 155, v: -27, rot: FACE_N,
    info: '书院旧斋舍，明代已有。山长与高第弟子读书静修之所。',
    meta: [['形制', '单檐硬山'], ['功能', '斋舍']],
    opts: {
      width: 13, depth: 7.5, bayWidths: [3.4, 4.4, 3.4, 1.8],
      columnH: 3.5, platformH: 0.5, platformPad: 1.0,
      roofStyle: 'gable', roofRise: 2.1, frontType: 'door', frontPorch: 1.4,
      plaque: { text: '山斋', width: 1.5, height: 0.5, y: 2.8 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'shanan', name: '杉庵', tag: '斋舍', type: 'hall',
    u: 154, v: 16, rot: FACE_S,
    info: '以杉木结庵，取山林野趣。旧为山长燕息之处。',
    meta: [['形制', '单檐硬山'], ['功能', '燕息']],
    opts: {
      width: 10.5, depth: 6.5, bayWidths: [3.4, 4.2, 2.9],
      columnH: 3.2, platformH: 0.45, platformPad: 0.9,
      roofStyle: 'gable', roofRise: 2.0, frontType: 'door', frontPorch: 1.2,
      plaque: { text: '杉庵', width: 1.4, height: 0.48, y: 2.6 },
      drumStones: false, ornament: false,
    },
  },
  {
    id: 'yanbinguan', name: '延宾馆', tag: '宾舍', type: 'hall',
    u: 192, v: -39, rot: rotFace(0.6, 0.8),
    info: '接待来访学者与宾客之所，居书院西门外官道旁。书院讲学不拒外人，远近来者皆可居此问学。',
    meta: [['形制', '单檐硬山'], ['功能', '宾舍']],
    opts: {
      width: 13, depth: 8.5, bayWidths: [3.2, 4.0, 3.2, 2.6],
      columnH: 3.8, platformH: 0.55, platformPad: 1.1,
      roofStyle: 'gable', roofRise: 2.4, frontType: 'door', frontPorch: 1.5,
      plaque: { text: '延宾馆', width: 1.9, height: 0.6, y: 3.0 },
      drumStones: false,
    },
  },

  /* ── 山上诸亭 ── */
  {
    id: 'jigaoming', name: '极高明亭', tag: '亭', type: 'pavilion',
    u: 404, v: -18, sides: 4, radius: 3.0,
    info: '取《中庸》「极高明而道中庸」。原在岳麓山顶，朱熹、张栻登山讲学处，久废后重建。',
    meta: [['形制', '四角攒尖'], ['典故', '极高明而道中庸']],
    opts: { sides: 4, radius: 3.0, columnH: 3.3, platformH: 0.5, roofRise: 2.3, railing: true, plaque: '极高明' },
  },
  {
    id: 'daozhongyong', name: '道中庸亭', tag: '亭', type: 'pavilion',
    u: 372, v: 52, sides: 4, radius: 2.9,
    info: '与极高明亭并称，同为朱张登山论道遗迹。',
    meta: [['形制', '四角攒尖'], ['典故', '道中庸']],
    opts: { sides: 4, radius: 2.9, columnH: 3.2, platformH: 0.5, roofRise: 2.2, railing: true, plaque: '道中庸' },
  },
  {
    id: 'cuiwei', name: '翠微亭', tag: '亭', type: 'pavilion',
    u: 330, v: -76, sides: 6, radius: 2.6,
    info: '山间小亭，取「苍翠微茫」之意，为登山歇脚处。',
    meta: [['形制', '六角攒尖']],
    opts: { sides: 6, radius: 2.6, columnH: 3.0, platformH: 0.45, roofRise: 2.1 },
  },
  {
    id: 'fanghe', name: '放鹤亭', tag: '亭', type: 'pavilion',
    u: 262, v: 66, sides: 6, radius: 2.7,
    info: '旧志载书院有放鹤亭，山长罗典养鹤其中。',
    meta: [['形制', '六角攒尖']],
    opts: { sides: 6, radius: 2.7, columnH: 3.1, platformH: 0.45, roofRise: 2.2 },
  },

  /* ── 亭 ── */
  {
    id: 'lushansi', name: '麓山寺碑亭', tag: '碑亭', type: 'pavilion',
    u: 30, v: -21, sides: 4, radius: 3.0,
    info: '护唐开元十八年（730）李邕所书《麓山寺碑》。碑文行楷，笔力沉雄，世称「北海三绝」，为书院镇院之宝。',
    meta: [['形制', '四角攒尖'], ['碑刻', '麓山寺碑'], ['书者', '李邕']],
    opts: { sides: 4, radius: 3.0, columnH: 3.4, platformH: 0.5, roofRise: 2.2, railing: true },
  },
  {
    id: 'nilan', name: '拟兰亭', tag: '亭', type: 'pavilion',
    u: 127.5, v: -12.5, sides: 4, radius: 2.5,
    info: '御书楼南侧小亭，临池，与汲泉亭对称，有廊相接，为藏书楼前庭点景。',
    meta: [['形制', '四角攒尖']],
    opts: { sides: 4, radius: 2.5, columnH: 3.0, platformH: 0.45, roofRise: 2.0 },
  },
  {
    id: 'jiquan', name: '汲泉亭', tag: '亭', type: 'pavilion',
    u: 127.5, v: 13.5, sides: 4, radius: 2.5,
    info: '御书楼北侧小亭，临池。亭下有泉，可汲以烹茶。',
    meta: [['形制', '四角攒尖']],
    opts: { sides: 4, radius: 2.5, columnH: 3.0, platformH: 0.45, roofRise: 2.0 },
  },
  {
    id: 'chuixiang', name: '吹香亭', tag: '亭', type: 'pavilion',
    u: -7.8, v: 91.5, sides: 6, radius: 2.9,
    info: '书院八景之一「风荷晚香」。亭立头门北侧池中，夏日荷香随风而至，故名吹香。',
    meta: [['形制', '六角攒尖'], ['景致', '风荷晚香']],
    opts: { sides: 6, radius: 2.9, columnH: 3.2, platformH: 0.5, roofRise: 2.3, plaque: '吹香亭' },
  },
  {
    id: 'fengyu', name: '风雩亭', tag: '亭', type: 'pavilion',
    u: -9.8, v: -49.3, sides: 6, radius: 2.7,
    info: '取《论语》「浴乎沂，风乎舞雩，咏而归」之意，立于头门南侧土丘，为书院前庭点景。',
    meta: [['形制', '六角攒尖'], ['典故', '风乎舞雩']],
    opts: { sides: 6, radius: 2.7, columnH: 3.1, platformH: 0.45, roofRise: 2.2, plaque: '风雩亭' },
  },
  {
    id: 'zibei', name: '自卑亭', tag: '亭', type: 'pavilion',
    u: -150, v: -28, sides: 4, radius: 3.2,
    info: '清康熙二十七年（1688）建，取《中庸》「君子之道，辟如行远必自迩，辟如登高必自卑」之义。旧时为书院门户，今立于东方红广场旁，为登山入院之起点。',
    meta: [['形制', '重檐方形'], ['创建', '清康熙二十七年'], ['典故', '登高必自卑']],
    opts: { sides: 4, radius: 3.2, columnH: 4.4, platformH: 0.8, roofRise: 2.6, railing: true, stone: true, doubleEave: true },
  },
  {
    id: 'aiwan', name: '爱晚亭', tag: '亭', type: 'pavilion',
    u: 267, v: -17, rot: 0, sides: 4, radius: 4.4,
    info: '清乾隆五十七年（1792）山长罗典建，原名红叶亭，后取杜牧「停车坐爱枫林晚，霜叶红于二月花」句意改今名，与醉翁亭、陶然亭、湖心亭并称中国四大名亭。方形平面边长 6.23 米，重檐八柱——外圈花岗岩方柱承下檐，内圈丹漆金柱通高承上檐，绿琉璃筒瓦，攒尖宝顶，四翼角远伸高翘；亭内彩绘藻井，悬毛泽东 1952 年题写之红底鎏金「爱晚亭」匾与《沁园春·长沙》横匾。坐西向东，居清风峡口，三面环山，枫林环绕。',
    meta: [['形制', '重檐八柱 · 四角攒尖'], ['创建', '清乾隆五十七年'], ['匾额', '毛泽东 1952 年题'], ['瓦色', '绿琉璃筒瓦']],
    opts: {
      sides: 4, radius: 4.4, columnH: 4.4, platformH: 0.4,
      roofRise: 3.6, overhang: 1.05, tile: 'glazed',
      railing: true, railingFront: false, basePad: 1.8, stone: false,
      eightPosts: { innerR: 2.55, innerExtra: 1.6 },
      caisson: true,
      plaque: { text: '爱晚亭', width: 2.3, height: 0.78, bg: '#8f2a1e', fg: '#f2cf70' },
      innerBoard: { text: '沁园春·长沙', w: 2.5, h: 0.6 },
    },
  },
  {
    id: 'wangjianglou', name: '望江楼', tag: '书院', type: 'tower',
    u: 159, v: 58, rot: rotFace(0.92, 0.38),
    info: '书院西北角高处，登楼可望湘江。旧志载书院有「望江」之胜，与岳麓山、湘水互为对景。',
    meta: [['形制', '二层楼阁'], ['景致', '望湘江']],
    opts: {
      width: 15, depth: 12, floors: 2, floorH: 3.6,
      platformH: 1.0, platformPad: 1.4,
      roofStyle: 'xieshan', roofRise: 2.8, overhangX: 1.15, overhangZ: 1.05,
      plaque: true, plaqueText: '望江楼',
    },
  },
];

/** 游廊：{ u0,v0,u1,v1, width, open, wallSide } */
export const CORRIDORS = [
  // 头门 → 赫曦台 两侧过道
  { u0: -9, v0: -7.6, u1: -3.4, v1: -7.6, width: 2.2, open: true },
  { u0: -9, v0: 7.6, u1: -3.4, v1: 7.6, width: 2.2, open: true },
  // 赫曦台 → 大门 两侧过道
  { u0: 5.6, v0: -7.6, u1: 14.6, v1: -7.6, width: 2.2, open: true },
  { u0: 5.6, v0: 7.6, u1: 14.6, v1: 7.6, width: 2.2, open: true },
  // 二门 → 讲堂：斋舍内侧前廊（院内两庑）
  { u0: 37, v0: -19.6, u1: 76, v1: -19.6, width: 2.4, open: false, wallSide: -1 },
  { u0: 37, v0: 19.8, u1: 76, v1: 19.8, width: 2.4, open: false, wallSide: 1 },
  // 讲堂后 → 御书楼 前院两廊
  { u0: 99, v0: -13.8, u1: 124, v1: -13.8, width: 2.6, open: false, wallSide: -1 },
  { u0: 99, v0: 13.8, u1: 124, v1: 13.8, width: 2.6, open: false, wallSide: 1 },
  // 拟兰/汲泉 二亭接御书楼前廊
  { u0: 127.5, v0: -12.5, u1: 128, v1: -9.2, width: 2.0, open: true },
  { u0: 127.5, v0: 13.5, u1: 128, v1: 10.2, width: 2.0, open: true },
  // 文庙：大成门 → 大成殿 两庑前廊
  { u0: 67, v0: 47.6, u1: 78, v1: 47.6, width: 2.4, open: false, wallSide: -1 },
  { u0: 67, v0: 74.4, u1: 78, v1: 74.4, width: 2.4, open: false, wallSide: 1 },
  // 大成殿 → 崇圣祠 短廊
  { u0: 96, v0: 52, u1: 112, v1: 56, width: 2.2, open: true },
  { u0: 96, v0: 70, u1: 112, v1: 68, width: 2.2, open: true },
  // 文庙北垣：乡贤祠东延廊（院门 → 乡贤祠）
  { u0: 46, v0: 80.5, u1: 58, v1: 80.5, width: 2.2, open: false, wallSide: 1 },
];

/** 牌坊、照壁、侧门 */
export const GATEWAYS = [
  { id: 'paifang', name: '千年学府牌坊', type: 'paifang', u: -52, v: 0, rot: 0,
    info: '书院中轴入口牌坊，额题「千年学府」，点出书院自北宋开宝九年延续办学之渊源。' },
  { id: 'eastgate', name: '东门', type: 'sidegate', u: -72, v: 0, rot: 0,
    info: '书院东入口，今游客由此入，门前即湖南大学校园。' },
  { id: 'wmtzhaobi', name: '文庙照壁', type: 'zhaobi', u: 51, v: 60.8, rot: 0,
    info: '文庙轴线起点。文庙自成院落于书院北侧，前设照壁，中为大成门，后为大成殿、崇圣祠。' },
  { id: 'wmyimen', name: '文庙仪门', type: 'sidegate', u: 44, v: 60.8, rot: 0,
    info: '文庙院墙东门，由书院讲堂前院入文庙由此进。' },
  { id: 'southgate', name: '南角门', type: 'sidegate', u: 40, v: -55, rot: FACE_N,
    info: '书院南墙角门，通斋舍与庖厨。' },
];

/** 水体：{ u,v,w,d,rot } */
export const WATER = [
  { id: 'chi', name: '吹香池', u: -8, v: 91.5, w: 30, d: 22, rot: 0.08 },
  { id: 'yinmachi', name: '饮马池', u: -9.8, v: -49.5, w: 17, d: 22, rot: 0.1 },
  { id: 'wenquan', name: '文泉', u: 114, v: -38, w: 15, d: 10, rot: 0.5 },
  { id: 'qujian', name: '曲涧', u: 99, v: -49, w: 30, d: 5.5, rot: 2.36 },
  { id: 'nilanchi', name: '拟兰池', u: 122.5, v: -12.5, w: 9, d: 6, rot: 0 },
  { id: 'jiquanchi', name: '汲泉池', u: 122.5, v: 13.5, w: 9, d: 6, rot: 0 },
  { id: 'aichichi', name: '爱晚池', u: 259.5, v: -14.5, w: 9, d: 6.5, rot: 0.25 },
];

/** 院墙（沿 u/v 的直线段，门洞由 GATEWAYS 自动避让）
 *  东段南墙让开饮马池（风雩亭立池中，在墙外） */
export const WALLS = [
  // 书院外墙
  { u0: -16, v0: -42, u1: -16, v1: 96, h: 2.7 },      // 东墙（头门即门屋）
  { u0: -16, v0: 96, u1: 168, v1: 96, h: 2.7 },       // 北墙
  { u0: 168, v0: -80, u1: 168, v1: 96, h: 2.7 },      // 西墙（西门为门洞）
  { u0: 78, v0: -80, u1: 168, v1: -80, h: 2.7 },      // 南墙（西段）
  { u0: 40, v0: -55, u1: 78, v1: -80, h: 2.7 },       // 南墙（斜段，随专祠地形）
  { u0: -16, v0: -42, u1: 40, v1: -55, h: 2.7 },      // 南墙（东段，斜向让开饮马池）
  // 文庙院墙
  { u0: 44, v0: 38, u1: 136, v1: 38, h: 2.6 },
  { u0: 136, v0: 38, u1: 136, v1: 92, h: 2.6 },
  { u0: 136, v0: 92, u1: 44, v1: 92, h: 2.6 },
  { u0: 44, v0: 92, u1: 44, v1: 38, h: 2.6 },         // 东墙（仪门为门洞）
];

/** 院中古树（香樟为主；避开轴线与建筑，讲究疏朗有致） */
export const TREES = [
  { u: -11, v: -16, kind: 'camphor', scale: 1.5 },
  { u: -11, v: 15, kind: 'camphor', scale: 1.45 },
  { u: 9, v: -13.5, kind: 'camphor', scale: 1.3 },
  { u: 9, v: 13.5, kind: 'camphor', scale: 1.35 },
  { u: 28, v: -17, kind: 'camphor', scale: 1.2 },
  { u: 28, v: 17, kind: 'camphor', scale: 1.25 },
  { u: 48, v: -14, kind: 'camphor', scale: 1.35 },
  { u: 48, v: 14, kind: 'camphor', scale: 1.3 },
  { u: 60, v: -11, kind: 'maple', scale: 1.15 },
  { u: 60, v: 11, kind: 'camphor', scale: 1.3 },
  { u: 72, v: -8, kind: 'camphor', scale: 1.15 },
  { u: 96, v: -9, kind: 'camphor', scale: 1.2 },
  { u: 120, v: -18, kind: 'camphor', scale: 1.2 },
  { u: 148, v: 24, kind: 'camphor', scale: 1.4 },
  { u: 156, v: 34, kind: 'camphor', scale: 1.3 },
  { u: 150, v: 70, kind: 'camphor', scale: 1.35 },
  { u: 18, v: 66, kind: 'camphor', scale: 1.25 },
  { u: 42, v: 62, kind: 'maple', scale: 1.15 },
  { u: 106, v: 84, kind: 'maple', scale: 1.2 },
  { u: 22, v: 86, kind: 'camphor', scale: 1.3 },
  { u: 40, v: 90, kind: 'camphor', scale: 1.2 },
];

/**
 * 导览路线：自卑亭 → 东门 → 头门 → 赫曦台 → 大门 → 二门 → 讲堂 → 斋舍 →
 * 湘水校经堂 → 御书楼 → 百泉轩 → 麓山寺碑亭 → 文庙大成门 → 大成殿 → 明伦堂 → 西门
 */
export const ROUTE = [
  { id: 'zibei', name: '自卑亭 · 起点', sub: '起点',
    camU: -138, camV: -16, camY: 3.0, lookU: -150, lookV: -28, lookY: 3.2,
    text: '清康熙二十七年（1688）建，取《中庸》「登高必自卑」之义。旧时谒书院者至此下轿整衣，自迩行远，自卑登高——一道心理的门槛，立了三百年。' },
  { id: 'eastgate', name: '东门 · 入', sub: '第二站',
    camU: -58, camV: -10, camY: 2.0, lookU: -72, lookV: 0, lookY: 3.2,
    text: '今人游书院，多由此入。门前即湖南大学校园，梧桐夹道。岳麓书院自北宋开宝九年（976）创建，弦歌至今一千零五十年。' },
  { id: 'toumen', name: '头门', sub: '第三站 · 门屋',
    camU: -24, camV: 0, camY: 1.9, lookU: -13.5, lookV: 0, lookY: 3.4,
    text: '书院第一道门，单檐硬山三间，悬「千年学府」匾。中国四大书院中，唯岳麓一脉相承、办学未断，故有此称。跨进此门两三米，赫曦台迎面而立。' },
  { id: 'hexitai', name: '赫曦台', sub: '第四站 · 戏台',
    camU: -3, camV: 4, camY: 1.8, lookU: 1, lookV: 0, lookY: 3.2,
    text: '清乾隆五十五年（1790）山长罗典建于大门前坪。平面凸字形，前部单檐歇山戏台，后部三间硬山，是典型湖南地方戏台做法。台上内壁存「福」「寿」二大字，传为朱熹、张栻所书。行人由两翼过道绕行入内。' },
  { id: 'gate', name: '大门', sub: '第五站 · 头门',
    camU: 9, camV: 0, camY: 2.0, lookU: 20, lookV: 0, lookY: 4.6,
    text: '南方将军门式，五间硬山出三山屏风墙，建于高台之上。门额「岳麓书院」传为宋真宗御笔；两侧白底墨书「惟楚有材，于斯为盛」——上联出《左传》，下联出《论语》，是书院最负盛名的一副门联。' },
  { id: 'ermen', name: '二门', sub: '第六站 · 仪门',
    camU: 24, camV: 0, camY: 1.8, lookU: 33, lookV: 0, lookY: 3.4,
    text: '明弘治七年建，五间单檐悬山，中三间开三门。正面「名山坛席」，背面「潇湘槐市」；门联「纳于大麓，藏之名山」——把一座书院放进岳麓山的形势里，也放进千年的文脉里。' },
  { id: 'jiangtang', name: '讲堂 · 入室', sub: '第七站 · 讲学',
    camU: 72, camV: 0, camY: 2.3, lookU: 88, lookV: 0, lookY: 2.2,
    text: '书院核心，五间单檐歇山，前出轩廊七间，后连拜厅，总面积 468 平方米，屋高 9.47 米。檐下「实事求是」匾，语出《汉书》，后为湖南大学校训；堂内两壁嵌朱熹手书「忠孝廉节」「整齐严肃」碑。乾道三年（1167），朱张会讲于此，一时生徒千余。' },
  { id: 'jiaoxuezhai', name: '教学斋', sub: '第八站 · 斋舍',
    camU: 40, camV: -14, camY: 1.9, lookU: 52, lookV: -24, lookY: 2.4,
    text: '讲堂前院南侧斋舍，长五十米，与北侧半学斋对称。光绪二十九年（1903）书院改制学堂时所建。生徒居此读书起居，「教学」取《学记》「教学相长」之义。' },
  { id: 'banxuezhai', name: '半学斋', sub: '第九站 · 斋舍',
    camU: 40, camV: 14, camY: 1.9, lookU: 52, lookV: 24, lookY: 2.4,
    text: '讲堂前院北侧斋舍。「半学」取「学而后知不足」之意。1917—1919 年，青年毛泽东曾在此寓居，与蔡和森等研讨时事，组织新民学会。' },
  { id: 'xiangshui', name: '湘水校经堂', sub: '第十站',
    camU: 94, camV: -8, camY: 1.9, lookU: 104, lookV: -14, lookY: 2.6,
    text: '清道光十一年（1831）湖南巡抚吴荣光创建，专课经史，不习举业，开湖南近代经学教育之先。居讲堂与御书楼之间，独立成院。' },
  { id: 'yushulou', name: '御书楼 · 入室', sub: '第十一站 · 藏书',
    camU: 126, camV: 0, camY: 2.2, lookU: 138, lookV: 0, lookY: 2.4,
    text: '书院藏书之所，始建於宋咸平二年（999），清康熙二十六年巡抚丁思孔建于今址。两层重檐歇山，面阔五间，高出全院以示尊崇。楼前两侧设廊接拟兰、汲泉二亭，亭前临池。一层为藏书阅览之所，书架环列。' },
  { id: 'baiquanxuan', name: '百泉轩', sub: '第十二站 · 园林',
    camU: 108, camV: -18, camY: 1.9, lookU: 116, lookV: -25, lookY: 2.4,
    text: '书院园林建筑，处清风峡谷口，溪泉荟萃，故名。北宋创建书院时即有，历代山长燕居之所，朱熹、张栻曾彻夜谈经于此。轩前文泉澄澈，曲涧鸣泉，为「书院八景」之一。' },
  { id: 'lushansi', name: '麓山寺碑亭', sub: '第十三站 · 碑',
    camU: 28, camV: -12, camY: 1.8, lookU: 30, lookV: -20, lookY: 1.8,
    text: '护唐开元十八年（730）李邕所书《麓山寺碑》。碑文行楷，笔力沉雄，世称「北海三绝」，为书院镇院之宝。' },
  { id: 'dachengmen', name: '文庙 · 大成门', sub: '第十四站',
    camU: 54, camV: 60.8, camY: 1.9, lookU: 64, lookV: 60.8, lookY: 3.6,
    text: '文庙正门，面阔三间，单檐歇山，黄琉璃瓦。明正德二年（1507）建文庙于院左（北），与书院并置且用皇家规制，为全国书院所仅见。' },
  { id: 'dachengdian', name: '大成殿 · 入殿', sub: '第十五站 · 祭孔',
    camU: 74, camV: 60.8, camY: 2.4, lookU: 86, lookV: 60.8, lookY: 2.6,
    text: '文庙主殿，重檐歇山，黄琉璃瓦，藻井天花，前有月台，属帝王规格。殿内祀孔子及四配十二哲，悬「万世师表」。书院三大功能——讲学、藏书、祭祀，于此汇合。' },
  { id: 'mingluntang', name: '明伦堂', sub: '第十六站',
    camU: 88, camV: 70, camY: 2.0, lookU: 88, lookV: 80, lookY: 2.6,
    text: '文庙讲学之所，取「明人伦」之义，面阔五间，坐北朝南，居大成殿之后。堂内课桌列阵，可见当年规制。' },
  { id: 'wenchangge', name: '文昌阁', sub: '第十七站',
    camU: 110, camV: 40, camY: 2.0, lookU: 101, lookV: 47, lookY: 4.6,
    text: '祀文昌帝君，二层楼阁，黄琉璃瓦。旧时士子祈科第之所，居文庙前院东南。' },
  { id: 'westgate', name: '西门 · 出', sub: '第十八站',
    camU: 160, camV: 0, camY: 2.0, lookU: 172, lookV: 0, lookY: 3.2,
    text: '出西门即后山官道，循石径西行入清风峡。书院之妙，正在于「纳于大麓」——出门便是山，进门便是书。' },
  { id: 'aiwan', name: '爱晚亭 · 终点', sub: '第十九站 · 枫林晚照',
    camU: 257, camV: -24, camY: 22, lookU: 267, lookV: -17, lookY: 17,
    text: '清乾隆五十七年（1792）山长罗典建，原名红叶亭，后取杜牧「停车坐爱枫林晚，霜叶红于二月花」句意改今名，与醉翁亭、陶然亭、湖心亭并称中国四大名亭。重檐八柱——外圈花岗岩方柱，内圈丹漆金柱，绿琉璃筒瓦攒尖宝顶；亭匾为毛泽东一九五二年应李达之请亲笔题写。四周枫林如染，「霜叶红于二月花」于此有了注脚。' },
];
