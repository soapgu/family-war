const { GameBoardPage } = require('../pages/GameBoardPage')

const ROUNDS = [
  { a: '石头', b: '剪刀', desc: '爸爸石头 vs 妈妈剪刀 → 爸爸胜' },
  { a: '石头', b: '布', desc: '爸爸石头 vs 妈妈布 → 妈妈胜' },
  { a: '石头', b: '石头', desc: '爸爸石头 vs 妈妈石头 → 平局' },
  { a: '剪刀', b: '布', desc: '爸爸剪刀 vs 妈妈布 → 爸爸胜' },
]

module.exports = {
  id: '04',
  name: 'RPS 对战：编排 4 局',
  async run({ pageA, pageB, config, reporter }) {
    reporter.onStepStart(this.id, this.name)
    const details = []

    const boardA = new GameBoardPage(pageA, config)
    const boardB = new GameBoardPage(pageB, config)

    for (let i = 0; i < ROUNDS.length; i++) {
      const round = ROUNDS[i]
      const isLast = i === ROUNDS.length - 1

      await boardA.waitForChoosingPhase()
      await boardB.waitForChoosingPhase()

      await boardA.makeChoice(round.a)
      await boardB.makeChoice(round.b)

      if (isLast) {
        await boardA.waitForMatchResult()
        await boardB.waitForMatchResult()
      } else {
        await Promise.all([
          boardA.waitForRoundResult(),
          boardB.waitForRoundResult(),
        ])
      }

      details.push(`第 ${i + 1} 局: ${round.desc}`)
    }

    reporter.onStepPass(this.id, details)
  },
}
