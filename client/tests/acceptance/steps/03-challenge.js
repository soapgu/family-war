const { RoomPage } = require('../pages/RoomPage')

module.exports = {
  id: '03',
  name: '爸爸发起挑战',
  async run({ pageA, pageB, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const roomA = new RoomPage(pageA, config)
    await roomA.waitForChallengeButton()
    await roomA.clickChallenge('小红')
    details.push('爸爸点击挑战按钮')

    await roomA.waitForGameStart()
    details.push('爸爸收到 game:start')

    const roomB = new RoomPage(pageB, config)
    await roomB.waitForGameStart()
    details.push('妈妈收到 game:start')

    reporter.onStepPass(this.id, details)
  },
}
