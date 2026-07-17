import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { triggerSocketEvent } from '../hooks/useSocket'
import App from '../App'

vi.mock('../hooks/useSocket')

const PLAYERS = [
  { id: 'test-socket-id', nickname: '小明', role: '爸爸', online: true },
  { id: '__robot__', nickname: '机器人', role: '机器人', online: true },
]

function createRoomState(game) {
  return {
    id: 'default',
    roles: {
      '爸爸': { id: 'test-socket-id', nickname: '小明' },
      '妈妈': null,
      '儿子': null,
      '机器人': { id: '__robot__', nickname: '机器人' },
    },
    players: PLAYERS,
    gameMode: game?.type || 'rps',
    game,
  }
}

function mockAudio() {
  const instances = []
  const AudioMock = vi.fn((path) => {
    const audio = {
      path,
      loop: false,
      volume: 1,
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    }
    instances.push(audio)
    return audio
  })
  vi.stubGlobal('Audio', AudioMock)
  return { AudioMock, instances }
}

async function enterRoom() {
  render(<App />)
  await userEvent.type(screen.getByPlaceholderText('输入昵称'), '小明')
  await userEvent.click(screen.getByRole('button', { name: '进入房间' }))
}

describe('App BGM', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.history.pushState({}, '', '/family-war/')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('默写进行中暂停 BGM，避免干扰听写', async () => {
    const { AudioMock, instances } = mockAudio()
    await enterRoom()
    expect(AudioMock).toHaveBeenCalledOnce()

    act(() => {
      triggerSocketEvent('room:state', createRoomState({
        status: 'playing',
        type: 'spelling',
        players: ['test-socket-id', '__robot__'],
      }))
    })

    expect(instances).toHaveLength(1)
    expect(instances[0].pause).toHaveBeenCalled()
  })

  it('非默写对战仍播放战斗 BGM', async () => {
    const { AudioMock, instances } = mockAudio()
    await enterRoom()

    act(() => {
      triggerSocketEvent('room:state', createRoomState({
        status: 'playing',
        type: 'arithmetic',
        players: ['test-socket-id', '__robot__'],
      }))
    })

    expect(AudioMock).toHaveBeenCalledTimes(2)
    expect(instances[0].pause).toHaveBeenCalled()
    expect(instances[1].path).toContain('bgm_battle.mp3')
    expect(instances[1].play).toHaveBeenCalled()
  })
})
