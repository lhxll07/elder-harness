/* 封面右侧插画：用 Canvas 2D 重画 App 的真实形态——「提交前停住」。
 *
 * 依据 video/out/review/fusion-v18 与真机截图 shot-home.png：
 *   · 主色是深绿 #1A7F6B（大圆麦克风、底部按钮、状态胶囊都用它）
 *   · 任务页顶部是状态胶囊；停在提交前时换成描边胶囊「等您确认」
 *   · 中间是「请核对就诊信息」+ 四行信息卡
 *   · 底部是「本人提交」和「取消」，提交后不可撤销，所以停在这里
 *
 * 为什么不用截图：真机截图带真实取件码、第三方 App 界面和状态栏，
 * 不适合放进评审材料；这里按同一套视觉重画，避免隐私与品牌问题，
 * 也保证换手机、换分辨率后封面不变。
 *
 * 用法：p01.html 里放 <canvas id="cover-art">，在本文件后引入即可。
 * 内部按 2x 绘制（1200×2208），CSS 显示 288×530，打印清晰。
 */
(function () {
  var c = document.getElementById('cover-art');
  if (!c) return;
  var ctx = c.getContext('2d');
  var W = 600, H = 1104, S = 2;
  c.width = W * S;
  c.height = H * S;

  var INK = '#1A1D21', INK2 = '#5F6368', INK3 = '#9AA0A6';
  var LINE = '#E8ECF1', CARD = '#F5F7FA';
  var GREEN = '#1A7F6B', GREEN_T = '#E6F2EF';
  var WHITE = '#FFFFFF', FRAME = '#14171B';
  var FONT = '"Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", "Helvetica Neue", Arial, sans-serif';

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fillRR(x, y, w, h, r, color) { rr(x, y, w, h, r); ctx.fillStyle = color; ctx.fill(); }
  function strokeRR(x, y, w, h, r, color, lw) { rr(x, y, w, h, r); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke(); }
  function text(str, x, y, size, weight, color) {
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function center(str, cx, y, size, weight, color) {
    ctx.font = weight + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = color;
    ctx.fillText(str, cx - ctx.measureText(str).width / 2, y);
  }

  function draw() {
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.clearRect(0, 0, W, H);

    /* ---------- 手机 ---------- */
    ctx.save();
    ctx.shadowColor = 'rgba(16,24,40,.20)';
    ctx.shadowBlur = 44;
    ctx.shadowOffsetY = 22;
    fillRR(40, 14, 520, 1076, 54, FRAME);
    ctx.restore();

    fillRR(54, 28, 492, 1048, 42, WHITE);
    var g = ctx.createLinearGradient(0, 28, 0, 300);
    g.addColorStop(0, '#FBFCFC'); g.addColorStop(1, 'rgba(251,252,252,0)');
    ctx.save(); rr(54, 28, 492, 1048, 42); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(54, 28, 492, 272);
    ctx.restore();

    /* ---------- 状态栏 ---------- */
    text('9:41', 86, 76, 18, '600', INK2);
    for (var i = 0; i < 4; i++) {
      fillRR(454 + i * 8, 70 - (i + 1) * 3, 5, 4 + (i + 1) * 3, 1.5, INK2);
    }
    ctx.beginPath(); ctx.arc(496, 72, 10, -Math.PI * 0.78, -Math.PI * 0.22);
    ctx.strokeStyle = INK2; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();
    ctx.beginPath(); ctx.arc(496, 72, 4.5, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
    strokeRR(512, 64, 22, 14, 4, INK3, 2);
    fillRR(514.5, 66.5, 14, 9, 2, INK2);
    fillRR(535, 68.5, 3, 5, 1.5, INK3);

    /* ---------- 停在这里：描边胶囊「等您确认」 ---------- */
    ctx.font = '600 19px ' + FONT;
    var label = '等您确认';
    var lw = ctx.measureText(label).width;
    var pillW = lw + 62;
    var pillX = 300 - pillW / 2;
    fillRR(pillX, 104, pillW, 48, 24, WHITE);
    strokeRR(pillX, 104, pillW, 48, 24, GREEN, 2);
    ctx.beginPath(); ctx.arc(pillX + 24, 128, 5, 0, Math.PI * 2); ctx.fillStyle = GREEN; ctx.fill();
    text(label, pillX + 38, 135, 19, '600', GREEN);

    /* ---------- 标题 ---------- */
    ctx.beginPath();
    ctx.moveTo(94, 181); ctx.lineTo(84, 190); ctx.lineTo(94, 199);
    ctx.strokeStyle = INK2; ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
    center('预约挂号', 300, 199, 25, '600', INK);
    [0, 1, 2].forEach(function (k) {
      ctx.beginPath(); ctx.arc(500 + k * 9, 190, 2.2, 0, Math.PI * 2); ctx.fillStyle = INK3; ctx.fill();
    });
    ctx.beginPath(); ctx.moveTo(72, 228); ctx.lineTo(528, 228);
    ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.stroke();

    /* ---------- 请核对就诊信息 ---------- */
    center('请核对就诊信息', 300, 276, 21, '600', INK);
    center('助手已经填好，只等您点提交', 300, 308, 17, '400', INK3);

    fillRR(72, 336, 456, 310, 22, CARD);
    var rows = [
      ['医院', '北京协和医院'],
      ['科室', '普通内科'],
      ['时间', '周四上午'],
      ['医生', '陈医生']
    ];
    rows.forEach(function (r, i) {
      var y = 386 + i * 62;
      text(r[0], 100, y, 18, '400', INK3);
      ctx.font = '500 20px ' + FONT;
      var w = ctx.measureText(r[1]).width;
      ctx.fillStyle = INK;
      ctx.fillText(r[1], 500 - w, y);
      if (i < rows.length - 1) {
        ctx.beginPath(); ctx.moveTo(100, y + 20); ctx.lineTo(500, y + 20);
        ctx.strokeStyle = LINE; ctx.lineWidth = 1.2; ctx.stroke();
      }
    });

    /* ---------- 本人提交 ---------- */
    fillRR(72, 690, 456, 86, 43, GREEN);
    center('本人提交', 300, 745, 27, '600', WHITE);
    center('提交这一步不可撤销，所以停在这里', 300, 818, 17, '400', INK3);

    // 取消
    fillRR(72, 850, 456, 76, 38, WHITE);
    strokeRR(72, 850, 456, 76, 38, LINE, 1.5);
    center('取消', 300, 897, 22, '600', INK2);

    // home indicator
    fillRR(220, 1052, 160, 6, 3, '#D9DEE5');
  }

  draw();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(draw);
  }
})();
