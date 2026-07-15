import { useState, useEffect, useCallback, useRef } from 'react'
import { Typography, Button, Tag, Card, Switch, Space, Image, Spin, App } from 'antd'
import { ReloadOutlined, SyncOutlined, SoundOutlined } from '@ant-design/icons'

const BASE = import.meta.env.DEV ? '' : (import.meta.env.BASE_URL || '')

function WordConfig() {
  const { message } = App.useApp()
  const voiceRef = useRef(null)

  useEffect(() => {
    const load = () => {
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v => /Google UK English/.test(v.name))
        || voices.find(v => /Daniel|Kate/.test(v.name))
        || voices.find(v => v.lang.startsWith('en'))
      voiceRef.current = preferred || null
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', load)
  }, [])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedNotify, setSavedNotify] = useState(false)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(BASE + '/api/admin/word-config')
      if (res.ok) setData(await res.json())
    } catch {
      message.error('获取词库配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const handleChapterToggle = (index, enabled) => {
    if (!data) return
    const chapters = [...data.enabledChapters]
    const ch = data.chapters[index].chapter
    if (enabled && !chapters.includes(ch)) {
      chapters.push(ch)
    } else if (!enabled) {
      const i = chapters.indexOf(ch)
      if (i !== -1) chapters.splice(i, 1)
    }
    const next = { ...data, enabledChapters: chapters }
    setData(next)
  }

  const handleWordToggle = (word, enabled) => {
    if (!data) return
    const disabled = [...data.disabledWords]
    if (!enabled && !disabled.includes(word)) {
      disabled.push(word)
    } else if (enabled) {
      const i = disabled.indexOf(word)
      if (i !== -1) disabled.splice(i, 1)
    }
    const next = { ...data, disabledWords: disabled }
    setData(next)
  }

  const handleSave = async () => {
    if (!data) return
    setSaving(true)
    try {
      const body = { enabledChapters: data.enabledChapters, disabledWords: data.disabledWords }
      const res = await fetch(BASE + '/api/admin/word-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setSavedNotify(true)
        setTimeout(() => setSavedNotify(false), 2000)
      } else {
        message.error('保存失败')
      }
    } catch {
      message.error('保存请求失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const res = await fetch(BASE + '/api/admin/word-images/sync', { method: 'POST' })
      if (res.ok) {
        message.success('同步完成')
        fetchConfig()
      } else {
        const err = await res.json()
        message.error(err.error || '同步失败')
      }
    } catch {
      message.error('同步请求失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncMissing = async () => {
    setSyncing(true)
    try {
      const res = await fetch(BASE + '/api/admin/word-images/sync-missing', { method: 'POST' })
      if (res.ok) {
        message.success('缺失图片同步完成')
        fetchConfig()
      } else {
        const err = await res.json()
        message.error(err.error || '同步失败')
      }
    } catch {
      message.error('同步请求失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleReplace = async (word) => {
    try {
      const res = await fetch(BASE + `/api/admin/word-images/replace/${encodeURIComponent(word)}`, {
        method: 'POST',
      })
      if (res.ok) {
        message.success(`${word} 图片已更换`)
        setRefreshKey(k => k + 1)
        fetchConfig()
      } else {
        const err = await res.json()
        message.error(err.error || '更换失败')
      }
    } catch {
      message.error('更换请求失败')
    }
  }

  const speak = useCallback((text) => {
    if (!window.speechSynthesis) return message.warning('当前浏览器不支持语音')
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.8
    if (voiceRef.current) utterance.voice = voiceRef.current
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }, [message])

  if (loading && !data) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>词库管理</Typography.Title>
        <Space>
          <Button onClick={() => window.history.back()}>返回管理</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>刷新</Button>
        </Space>
      </div>

      {data && (
        <Card style={{ marginBottom: 20 }}>
          <Space wrap>
            <Button type="primary" icon={<SyncOutlined />} onClick={handleSyncAll} loading={syncing}>
              同步所有图片
            </Button>
            <Button icon={<SyncOutlined />} onClick={handleSyncMissing} loading={syncing}>
              仅同步缺失
            </Button>
            <Typography.Text type="secondary">
              已同步 {data.chapters.reduce((s, c) => s + c.words.filter((w) => w.synced).length, 0)} / {data.chapters.reduce((s, c) => s + c.words.length, 0)} 个单词
            </Typography.Text>
          </Space>
        </Card>
      )}

      {data && data.chapters.length === 0 && (
        <Typography.Text type="secondary">暂无词库章节</Typography.Text>
      )}

      {data?.chapters.map((ch, ci) => {
        const chapterEnabled = data.enabledChapters.includes(ch.chapter)
        return (
          <Card
            key={ch.chapter}
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space>
                <Switch
                  checked={chapterEnabled}
                  onChange={(v) => handleChapterToggle(ci, v)}
                  size="small"
                />
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {ch.chapter}
                </Typography.Text>
                <Tag>{ch.words.length} 词</Tag>
              </Space>
            }
          >
            {ch.words.map((w) => {
              const wordDisabled = data.disabledWords.includes(w.word)
              const active = chapterEnabled && !wordDisabled
              return (
                <div
                  key={w.word}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                    opacity: active ? 1 : 0.4,
                  }}
                >
                  <Switch
                    checked={!wordDisabled}
                    onChange={(v) => handleWordToggle(w.word, v)}
                    size="small"
                    disabled={!chapterEnabled}
                  />
                  <Typography.Text style={{ minWidth: 120, fontWeight: 500 }}>
                    {w.word}
                  </Typography.Text>
                  <Button
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    onClick={() => speak(w.word)}
                  />
                  <Tag color={w.synced ? 'green' : 'default'} style={{ minWidth: 52, textAlign: 'center' }}>
                    {w.synced ? '已同步' : '待同步'}
                  </Tag>
                  {w.synced ? (
                    <Image
                      src={BASE + `/api/images/${encodeURIComponent(w.word)}?t=${refreshKey}`}
                      width={48}
                      height={48}
                      style={{ borderRadius: 4, objectFit: 'cover' }}
                      preview={{ mask: '预览' }}
                      fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjQiIHk9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzk5OSI+5pqC5L2T55WZPC90ZXh0Pjwvc3ZnPg=="
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 4,
                        background: '#fafafa',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        color: '#ccc',
                      }}
                    >
                      无图
                    </div>
                  )}
                  <Button
                    size="small"
                    onClick={() => handleReplace(w.word)}
                    disabled={syncing}
                  >
                    换图
                  </Button>
                </div>
              )
            })}
          </Card>
        )
      })}

      {data && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {savedNotify ? '✅ 已保存' : '保存配置'}
          </Button>
        </div>
      )}
    </div>
  )
}

export default WordConfig