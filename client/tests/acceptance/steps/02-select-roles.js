const { RoomPage } = require('../pages/RoomPage')

module.exports = {
  id: '02',
  name: '选择角色：爸爸 vs 妈妈',
  async run({ pageA, pageB, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const roomA = new RoomPage(pageA, config)
    await roomA.waitForRoomReady()
    await roomA.selectRole('爸爸')
    await roomA.waitForRoleSelected()
    details.push('玩家 A（小明）选择"爸爸" ✓')

    const roomB = new RoomPage(pageB, config)
    await roomB.waitForRoomReady()
    await roomB.selectRole('妈妈')
    await roomB.waitForRoleSelected()
    details.push('玩家 B（小红）选择"妈妈" ✓')

    reporter.onStepPass(this.id, details)
  },
}
