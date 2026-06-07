// china-map.js
// Simplified SVG China map with province paths
// Each path has data-name attribute for interaction

export function getChinaMapSVG() {
  return `
<svg viewBox="0 0 800 680" xmlns="http://www.w3.org/2000/svg" id="china-map">
  <!-- 新疆 Xinjiang -->
  <path data-name="新疆" d="M60,40 L200,30 L240,60 L260,120 L240,180 L260,220 L220,260 L180,280 L120,260 L80,220 L40,180 L30,120 L40,80 Z" />
  
  <!-- 西藏 Tibet -->
  <path data-name="西藏" d="M60,260 L180,280 L220,260 L260,280 L280,320 L260,370 L220,400 L160,410 L100,380 L60,340 L40,300 Z" />
  
  <!-- 青海 Qinghai -->
  <path data-name="青海" d="M220,260 L260,220 L320,210 L360,230 L370,280 L340,320 L280,320 L260,280 Z" />
  
  <!-- 甘肃 Gansu -->
  <path data-name="甘肃" d="M260,120 L310,100 L350,130 L380,160 L360,190 L320,210 L260,220 L240,180 Z M350,130 L400,110 L420,140 L400,170 L380,160 Z" />
  
  <!-- 内蒙古 Inner Mongolia -->
  <path data-name="内蒙古" d="M310,100 L350,60 L420,40 L500,30 L560,50 L600,80 L580,120 L540,140 L500,130 L460,140 L420,140 L400,110 L350,130 Z" />
  
  <!-- 宁夏 Ningxia -->
  <path data-name="宁夏" d="M360,190 L380,160 L400,170 L395,200 L375,210 Z" />
  
  <!-- 陕西 Shaanxi -->
  <path data-name="陕西" d="M375,210 L395,200 L420,190 L440,220 L450,270 L430,310 L400,330 L380,300 L370,280 L360,230 Z" />
  
  <!-- 四川 Sichuan -->
  <path data-name="四川" d="M260,370 L280,320 L340,320 L370,280 L380,300 L400,330 L390,370 L360,400 L320,420 L280,410 Z" />
  
  <!-- 云南 Yunnan -->
  <path data-name="云南" d="M220,400 L260,370 L280,410 L320,420 L330,460 L310,500 L280,520 L240,510 L210,470 L200,430 Z" />
  
  <!-- 贵州 Guizhou -->
  <path data-name="贵州" d="M320,420 L360,400 L400,410 L420,440 L400,470 L370,480 L340,470 L330,460 Z" />
  
  <!-- 广西 Guangxi -->
  <path data-name="广西" d="M310,500 L330,460 L340,470 L370,480 L400,470 L420,500 L410,540 L370,560 L330,550 L300,530 Z" />
  
  <!-- 重庆 Chongqing -->
  <path data-name="重庆" d="M390,370 L400,330 L430,340 L440,370 L420,400 L400,410 L390,390 Z" />
  
  <!-- 湖北 Hubei -->
  <path data-name="湖北" d="M430,310 L450,270 L490,280 L530,290 L540,320 L520,350 L480,360 L450,350 L430,340 Z" />
  
  <!-- 湖南 Hunan -->
  <path data-name="湖南" d="M420,400 L440,370 L450,350 L480,360 L500,390 L490,430 L460,450 L430,440 L420,440 Z" />
  
  <!-- 广东 Guangdong -->
  <path data-name="广东" d="M420,500 L420,440 L430,440 L460,450 L490,430 L520,450 L540,480 L560,510 L530,530 L490,540 L450,530 L420,520 Z" />
  
  <!-- 海南 Hainan -->
  <path data-name="海南" d="M440,570 L470,560 L480,580 L470,600 L445,600 L435,585 Z" />
  
  <!-- 台湾 Taiwan -->
  <path data-name="台湾" d="M620,430 L635,400 L650,410 L650,450 L635,470 L620,460 Z" />
  
  <!-- 福建 Fujian -->
  <path data-name="福建" d="M540,380 L570,360 L600,380 L610,420 L590,450 L560,440 L540,420 L540,400 Z" />
  
  <!-- 江西 Jiangxi -->
  <path data-name="江西" d="M500,390 L520,350 L540,380 L540,400 L540,420 L520,450 L490,430 Z" />
  
  <!-- 浙江 Zhejiang -->
  <path data-name="浙江" d="M570,360 L590,330 L610,340 L620,370 L600,380 Z" />
  
  <!-- 安徽 Anhui -->
  <path data-name="安徽" d="M530,290 L550,270 L570,290 L580,320 L570,340 L540,340 L530,320 Z" />

  <!-- 江苏 Jiangsu -->
  <path data-name="江苏" d="M550,270 L570,250 L600,260 L620,280 L610,310 L590,330 L570,310 L570,290 Z" />
  
  <!-- 上海 Shanghai -->
  <path data-name="上海" d="M620,310 L635,300 L640,320 L630,330 L620,320 Z" />
  
  <!-- 河南 Henan -->
  <path data-name="河南" d="M440,220 L470,210 L500,220 L520,250 L530,290 L490,280 L450,270 Z" />
  
  <!-- 山东 Shandong -->
  <path data-name="山东" d="M520,200 L550,180 L590,190 L620,210 L630,240 L620,260 L600,260 L570,250 L540,230 L520,210 Z" />
  
  <!-- 河北 Hebei -->
  <path data-name="河北" d="M500,130 L520,120 L540,140 L560,160 L550,180 L520,200 L500,190 L480,170 L470,150 L480,140 Z" />
  
  <!-- 山西 Shanxi -->
  <path data-name="山西" d="M460,140 L480,140 L500,190 L520,200 L500,220 L470,210 L440,220 L420,190 Z" />
  
  <!-- 北京 Beijing -->
  <path data-name="北京" d="M530,148 L545,140 L552,155 L540,162 Z" />
  
  <!-- 天津 Tianjin -->
  <path data-name="天津" d="M552,155 L565,150 L568,168 L558,172 L552,165 Z" />
  
  <!-- 辽宁 Liaoning -->
  <path data-name="辽宁" d="M560,50 L600,80 L620,110 L630,140 L610,160 L580,150 L560,160 L540,140 L560,120 Z" />
  
  <!-- 吉林 Jilin -->
  <path data-name="吉林" d="M600,80 L640,60 L680,70 L700,100 L680,130 L650,140 L630,140 L620,110 Z" />
  
  <!-- 黑龙江 Heilongjiang -->
  <path data-name="黑龙江" d="M560,50 L600,30 L650,20 L700,30 L740,50 L750,80 L730,110 L700,100 L680,70 L640,60 L600,80 Z" />

  <!-- 香港 Hong Kong -->
  <path data-name="香港" d="M530,535 L542,530 L545,540 L535,545 Z" />

  <!-- 澳门 Macau -->
  <path data-name="澳门" d="M518,540 L526,536 L528,544 L520,546 Z" />

  <!-- 南海诸岛 decorative box -->
  <rect x="600" y="500" width="80" height="70" fill="none" stroke="var(--border-subtle)" stroke-width="0.5" stroke-dasharray="3,3" rx="2" />
  <text x="640" y="540" text-anchor="middle" font-size="8" fill="var(--muted)">南海诸岛</text>
</svg>
  `
}
