import { COLORS, text, fill, rule, badge, check } from './fusion-memory-ui.js'

function canvas(width, height, draw) {
  const result = document.createElement('canvas')
  result.width = width * 2
  result.height = height * 2
  const context = result.getContext('2d')
  context.scale(2, 2)
  fill(context, 2, 2, width - 4, height - 4, 52, COLORS.paper)
  draw(context)
  return result
}

export function familyPages() {
  const request = canvas(2004, 1197, context => {
    text(context, '银龄智办 / 家人协作', 76, 89, 35, COLORS.muted)
    badge(context, '待接手', 1680, 89, 240, { height: 65, size: 30 })
    text(context, '上次复诊，是哪位医生？', 76, 208, 76, COLORS.ink, 500)
    text(context, '老人说：“不记得了，问问女儿。”', 76, 304, 42, COLORS.muted)
    rule(context, 76, 368, 1852)
    const fields = [['正在办', '普通内科复诊'], ['已确认', '周四上午'], ['还缺少', '上次的医生']]
    fields.forEach(([label, value], index) => {
      const horizontal = 76 + index * 628
      fill(context, horizontal, 428, 594, 196, 28, index === 2 ? '#f4eee3' : '#e9eff3')
      text(context, label, horizontal + 30, 481, 31, COLORS.muted)
      text(context, value, horizontal + 30, 563, 49, index === 2 ? '#92703f' : COLORS.ink)
    })
    text(context, '查看求助背景', 76, 720, 34, COLORS.muted)
    text(context, '手机停在当前进度，等老人确认后继续。', 76, 807, 48, COLORS.ink)
    fill(context, 76, 946, 340, 148, 38, COLORS.jade)
    text(context, '我来处理', 246, 1020, 52, '#ffffff', 500, 'center')
    text(context, '打开网页即可协作', 465, 1020, 34, COLORS.muted)
  })
  const compose = canvas(1113, 1209, context => {
    text(context, '家人回复 / 已接手', 72, 91, 34, COLORS.muted)
    text(context, '给老人一句话', 72, 208, 69, COLORS.ink)
    text(context, '补充线索，由老人确认后继续', 72, 307, 35, COLORS.muted)
    fill(context, 72, 383, 969, 396, 30, '#ffffff')
    text(context, '上次是陈医生，', 110, 480, 54, COLORS.ink)
    text(context, '他周四上午门诊。', 110, 573, 54, COLORS.ink)
    rule(context, 110, 714, 886)
    text(context, '信息会回到这一次求助', 72, 855, 34, COLORS.muted)
    fill(context, 72, 981, 969, 148, 38, COLORS.jade)
    text(context, '提交留言', 557, 1055, 52, '#ffffff', 500, 'center')
  })
  const message = canvas(1600, 280, context => {
    text(context, '家人补充的线索', 52, 72, 31, COLORS.muted)
    text(context, '上次是陈医生，他周四上午门诊。', 52, 174, 57, COLORS.ink)
    check(context, 1490, 174, 1, COLORS.jade, 2)
  })
  const read = canvas(1854, 507, context => {
    badge(context, '家人回复', 64, 80, 230, { height: 64, size: 31 })
    text(context, '上次是陈医生，他周四上午门诊。', 64, 208, 68, COLORS.ink)
    rule(context, 64, 291, 1726)
    text(context, '本人核对：就选陈医生，继续办理。', 64, 393, 49, COLORS.jade)
  })
  return { request, compose, message, read }
}
