const { HomePage } = require('../pages/HomePage')
const { RoomPage } = require('../pages/RoomPage')

module.exports = {
  id: '01',
  name: '两人分别进入房间',
  async run({ pageA, pageB, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const homeA = new HomePage(pageA, config)
    await homeA.join('小明')
    const roomA = new RoomPage(pageA, config)
    await roomA.waitForRoomReady()
    details.push('玩家 A（小明）进入房间')

    const homeB = new HomePage(pageB, config)
    await homeB.join('小红')
    const roomB = new RoomPage(pageB, config)
    await roomB.waitForRoomReady()
    details.push('玩家 B（小红）进入房间')

    reporter.onStepPass(this.id, details)
  },
}
