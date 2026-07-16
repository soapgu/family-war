import { Modal } from 'antd'
import RpsMatchResult from './RpsMatchResult'
import ArithmeticMatchResult from './ArithmeticMatchResult'
import SpellingMatchResult from './SpellingMatchResult'

function MatchResult({ visible, gameType, matchWinner, scores, history, ranking, myId, onBack, onRematch }) {
  const contentProps = { matchWinner, scores, history, ranking, myId, onBack, onRematch }

  return (
    <Modal open={visible} closable={false} footer={null} centered width={380}>
      {gameType === 'spelling' ? (
        <SpellingMatchResult {...contentProps} />
      ) : gameType === 'arithmetic' ? (
        <ArithmeticMatchResult {...contentProps} />
      ) : (
        <RpsMatchResult {...contentProps} />
      )}
    </Modal>
  )
}

export default MatchResult
