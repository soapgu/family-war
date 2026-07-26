import AdminPage from './AdminPage'
import WordConfigPage from './WordConfigPage'

export const familyWarApp = Object.freeze({
  id: 'family-war',
  name: 'Family War',
  description: '查看在线房间、历史对局和默写词库配置。',
  entryPath: '/family-war',
  routePrefix: '/family-war',
  navigationLabel: 'Family War',
  icon: 'control',
})

export const familyWarRoutes = Object.freeze([
  Object.freeze({
    id: 'family-war-overview',
    path: 'family-war',
    Component: AdminPage,
  }),
  Object.freeze({
    id: 'family-war-word-config',
    path: 'family-war/word-config',
    Component: WordConfigPage,
  }),
])
