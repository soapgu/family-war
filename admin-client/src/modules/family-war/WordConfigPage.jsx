import { useState, useEffect, useCallback, useRef } from 'react'
import { Typography, Button, Tag, Card, Switch, Space, Image, Spin, App, Modal, Alert, Progress } from 'antd'
import { ReloadOutlined, SyncOutlined, SoundOutlined } from '@ant-design/icons'
import { useAdminAuth } from '../../auth/AdminAuthContext'
import PageHeader from '../../components/PageHeader'
import RequestState from '../../components/RequestState'
import { ApiRequestError } from '../../config/request'
import { familyWarAdminApi } from './api'

const EMPTY_WORD_BANK_MESSAGE = '至少需要保留一个可用的默写单词'
const SPEECH_RESTART_DELAY = 50

function getActiveWordCount(config) {
  if (!config) return 0
  const enabledChapters = new Set(config.enabledChapters)
  const disabledWords = new Set(config.disabledWords)
  return config.chapters.reduce((count, chapter) => {
    if (!enabledChapters.has(chapter.chapter)) return count
    return count + chapter.words.filter((word) => !disabledWords.has(word.word)).length
  }, 0)
}

function WordConfigPage() {
  const { expireSession } = useAdminAuth()
  const { message } = App.useApp()
  const voiceRef = useRef(null)
  const utteranceRef = useRef(null)
  const speechTimerRef = useRef(null)

  useEffect(() => {
    const synth = window.speechSynthesis
    if (!synth) return undefined
    const load = () => {
      const voices = synth.getVoices?.() || []
      const preferred = voices.find(v => /Google UK English/.test(v.name))
        || voices.find(v => /Daniel|Kate/.test(v.name))
        || voices.find(v => v.lang?.startsWith('en-GB'))
        || voices.find(v => v.lang?.startsWith('en'))
      voiceRef.current = preferred || null
    }
    if (synth.getVoices) {
      load()
      synth.addEventListener?.('voiceschanged', load)
    }
    return () => {
      synth.removeEventListener?.('voiceschanged', load)
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
      synth.cancel?.()
      utteranceRef.current = null
    }
  }, [])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [savedNotify, setSavedNotify] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [selectingWord, setSelectingWord] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [selectedPhotoId, setSelectedPhotoId] = useState(null)
  const [candidatesLoading, setCandidatesLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalCandidates, setTotalCandidates] = useState(0)

  const reportRequestError = useCallback((requestError, fallback) => {
    if (requestError instanceof ApiRequestError && requestError.status === 401) {
      expireSession()
      return
    }
    message.error(requestError instanceof ApiRequestError ? requestError.message : fallback)
  }, [expireSession, message])

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      setData(await familyWarAdminApi.getWordConfig())
      setHasUnsavedChanges(false)
    } catch (requestError) {
      if (requestError instanceof ApiRequestError && requestError.status === 401) {
        expireSession()
        return
      }
      setLoadError(requestError instanceof ApiRequestError
        ? requestError.message
        : '获取词库配置失败')
    } finally {
      setLoading(false)
    }
  }, [expireSession])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  const updateImageStatuses = (statuses) => {
    const syncedWords = new Set(
      statuses.filter((item) => item.status === 'synced').map((item) => item.word)
    )
    setData((current) => current && ({
      ...current,
      chapters: current.chapters.map((chapter) => ({
        ...chapter,
        words: chapter.words.map((word) => ({ ...word, synced: syncedWords.has(word.word) })),
      })),
    }))
  }

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
    if (getActiveWordCount(next) === 0) {
      message.warning(EMPTY_WORD_BANK_MESSAGE)
      return
    }
    setData(next)
    setHasUnsavedChanges(true)
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
    if (getActiveWordCount(next) === 0) {
      message.warning(EMPTY_WORD_BANK_MESSAGE)
      return
    }
    setData(next)
    setHasUnsavedChanges(true)
  }

  const handleSave = async () => {
    if (!data) return
    if (getActiveWordCount(data) === 0) {
      message.warning(EMPTY_WORD_BANK_MESSAGE)
      return
    }
    setSaving(true)
    try {
      const body = { enabledChapters: data.enabledChapters, disabledWords: data.disabledWords }
      await familyWarAdminApi.saveWordConfig(body)
      setHasUnsavedChanges(false)
      setSavedNotify(true)
      setTimeout(() => setSavedNotify(false), 2000)
    } catch (requestError) {
      reportRequestError(requestError, '保存请求失败')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    try {
      const status = await familyWarAdminApi.syncAllWordImages()
      updateImageStatuses(status.words || [])
      message.success('同步完成')
    } catch (requestError) {
      reportRequestError(requestError, '同步请求失败')
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncMissing = async () => {
    setSyncing(true)
    try {
      const status = await familyWarAdminApi.syncMissingWordImages()
      updateImageStatuses(status.words || [])
      message.success('缺失图片同步完成')
    } catch (requestError) {
      reportRequestError(requestError, '同步请求失败')
    } finally {
      setSyncing(false)
    }
  }

  const fetchCandidatesPage = async (word, pageNum) => {
    setSelectedPhotoId(null)
    setSelectingWord(word)
    setCandidatesLoading(true)
    try {
      const candidateData = await familyWarAdminApi.getWordImageCandidates(word, pageNum)
      setCandidates(candidateData.candidates)
      setTotalCandidates(candidateData.total)
      setPage(candidateData.page)
    } catch (requestError) {
      reportRequestError(requestError, '获取候选图片请求失败')
    } finally {
      setCandidatesLoading(false)
    }
  }

  const openSelector = (word) => fetchCandidatesPage(word, 1)

  const handlePrevPage = () => fetchCandidatesPage(selectingWord, page - 1)

  const handleNextPage = () => fetchCandidatesPage(selectingWord, page + 1)

  const handleConfirmSelect = async () => {
    if (!selectingWord || !selectedPhotoId) return
    const photo = candidates.find(c => c.candidateId === selectedPhotoId)
    if (!photo) return
    try {
      await familyWarAdminApi.confirmWordImage(selectingWord, photo.candidateId)
      message.success(`${selectingWord} 图片已更换`)
      setSelectingWord(null)
      setCandidates([])
      setSelectedPhotoId(null)
      setRefreshKey(k => k + 1)
      setData((current) => current && ({
        ...current,
        chapters: current.chapters.map((chapter) => ({
          ...chapter,
          words: chapter.words.map((word) => (
            word.word === selectingWord ? { ...word, synced: true } : word
          )),
        })),
      }))
    } catch (requestError) {
      reportRequestError(requestError, '确认换图请求失败')
    }
  }

  const speak = useCallback((text) => {
    const synth = window.speechSynthesis
    if (!synth?.speak || typeof SpeechSynthesisUtterance === 'undefined') {
      message.warning('当前浏览器不支持语音')
      return
    }
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current)
    synth.cancel?.()
    synth.resume?.()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-GB'
    utterance.rate = 0.8
    if (voiceRef.current) utterance.voice = voiceRef.current
    utteranceRef.current = utterance
    const release = () => {
      if (utteranceRef.current === utterance) utteranceRef.current = null
    }
    utterance.onend = release
    utterance.onerror = release
    speechTimerRef.current = setTimeout(() => {
      speechTimerRef.current = null
      if (utteranceRef.current === utterance) synth.speak(utterance)
    }, SPEECH_RESTART_DELAY)
  }, [message])

  const activeWordCount = getActiveWordCount(data)
  const totalWordCount = data?.chapters.reduce((sum, chapter) => sum + chapter.words.length, 0) || 0
  const syncedWordCount = data?.chapters.reduce(
    (sum, chapter) => sum + chapter.words.filter((word) => word.synced).length,
    0
  ) || 0
  const missingWordCount = Math.max(totalWordCount - syncedWordCount, 0)
  const allWordsSynced = totalWordCount > 0 && syncedWordCount === totalWordCount
  const syncPercent = totalWordCount > 0 ? Math.round((syncedWordCount / totalWordCount) * 100) : 0
  const syncButtonLabel = totalWordCount === 0
    ? '暂无单词'
    : allWordsSynced
      ? '已全部同步'
      : `同步缺失 ${missingWordCount} 个`

  return (
    <main className="platform-page word-config-page">
      <PageHeader
        title="词库管理"
        description="配置默写章节、单词和配图。"
        breadcrumbs={[
          { title: '管理首页', path: '/' },
          { title: 'Family War', path: '/family-war' },
          { title: '词库管理' },
        ]}
        extra={(
          <Button icon={<ReloadOutlined />} onClick={fetchConfig} loading={loading}>刷新</Button>
        )}
      />

      {loading && !data && (
        <RequestState state="loading" description="正在加载词库配置…" />
      )}
      {loadError && (
        <RequestState
          state="error"
          title="词库配置加载失败"
          description={loadError}
          onRetry={fetchConfig}
        />
      )}

      {data && (
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'stretch' }}>
            <div
              aria-label={`图片同步 ${syncedWordCount} / ${totalWordCount}`}
              style={{
                flex: '1.4 1 420px',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 20,
                padding: '12px 16px',
                borderRadius: 10,
                background: allWordsSynced ? '#f6ffed' : '#fffbe6',
                border: `1px solid ${allWordsSynced ? '#b7eb8f' : '#ffe58f'}`,
              }}
            >
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>图片同步</Typography.Text>
                <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                  <span style={{ fontSize: 28, lineHeight: 1.2, fontWeight: 750, color: allWordsSynced ? '#389e0d' : '#d48806' }}>
                    {syncedWordCount}
                  </span>
                  <span style={{ fontSize: 14, color: '#8c8c8c' }}>/ {totalWordCount}</span>
                </div>
              </div>
              <div style={{ flex: '1 1 150px', minWidth: 130 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 2 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>同步进度</Typography.Text>
                  <Typography.Text style={{ fontSize: 12, color: allWordsSynced ? '#52c41a' : '#d48806' }}>
                    {syncPercent}%
                  </Typography.Text>
                </div>
                <Progress
                  percent={syncPercent}
                  showInfo={false}
                  size="small"
                  strokeColor={allWordsSynced ? '#52c41a' : '#faad14'}
                  trailColor={allWordsSynced ? '#d9f7be' : '#fff1b8'}
                />
                <Typography.Text style={{ fontSize: 12, color: allWordsSynced ? '#52c41a' : '#d48806' }}>
                  {totalWordCount === 0
                    ? '暂无单词图片'
                    : allWordsSynced
                      ? '所有图片均已就绪'
                      : `还差 ${missingWordCount} 张图片待同步`}
                </Typography.Text>
              </div>
              <Button
                aria-label={syncButtonLabel}
                icon={<SyncOutlined />}
                onClick={handleSyncMissing}
                loading={syncing}
                disabled={allWordsSynced || totalWordCount === 0}
              >
                {syncButtonLabel}
              </Button>
            </div>

            <div
              aria-label={`当前启用 ${activeWordCount} 个单词`}
              style={{
                flex: '1 1 280px',
                padding: '12px 16px',
                borderRadius: 10,
                background: '#e6f4ff',
                border: '1px solid #91caff',
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>当前启用</Typography.Text>
              <div style={{ marginTop: 2, display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontSize: 28, lineHeight: 1.2, fontWeight: 750, color: '#1677ff' }}>
                  {activeWordCount}
                </span>
                <span style={{ fontSize: 14, color: '#8c8c8c' }}>个单词</span>
              </div>
              <Typography.Text style={{ fontSize: 12, color: '#4096ff' }}>
                本轮默写选题范围
              </Typography.Text>
            </div>
          </div>
        </Card>
      )}

      {data && activeWordCount === 0 && (
        <Alert
          type="warning"
          showIcon
          message={EMPTY_WORD_BANK_MESSAGE}
          description="请先启用至少一个章节和单词，再保存配置。"
          style={{ marginBottom: 20 }}
        />
      )}

      {data && data.chapters.length === 0 && (
        <RequestState
          state="empty"
          title="暂无词库章节"
          description="服务端当前没有可配置的默写章节。"
        />
      )}

      {data?.chapters.map((ch, ci) => {
        const chapterEnabled = data.enabledChapters.includes(ch.chapter)
        const enabledWordCount = chapterEnabled
          ? ch.words.filter((word) => !data.disabledWords.includes(word.word)).length
          : 0
        const syncedChapterWords = ch.words.filter((word) => word.synced).length
        return (
          <Card
            key={ch.chapter}
            className="word-config-chapter-card"
            size="small"
            style={{ marginBottom: 12 }}
            title={
              <Space wrap>
                <Switch
                  checked={chapterEnabled}
                  onChange={(v) => handleChapterToggle(ci, v)}
                />
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {ch.chapter}
                </Typography.Text>
                <Tag color="blue">{enabledWordCount}/{ch.words.length} 已启用</Tag>
                <Tag color={syncedChapterWords === ch.words.length ? 'green' : 'gold'}>
                  图片 {syncedChapterWords}/{ch.words.length}
                </Tag>
              </Space>
            }
          >
            <div className="word-config-grid word-config-grid-header" aria-hidden="true">
              <span>单词</span>
              <span>图片状态</span>
              <span>预览</span>
              <span>操作</span>
            </div>
            {ch.words.map((w) => {
              const wordDisabled = data.disabledWords.includes(w.word)
              const active = chapterEnabled && !wordDisabled
              return (
                <div
                  key={w.word}
                  className={`word-config-grid word-config-word-row${active ? '' : ' is-inactive'}`}
                >
                  <div className="word-config-word-info">
                  <Switch
                    checked={!wordDisabled}
                    onChange={(v) => handleWordToggle(w.word, v)}
                    size="small"
                    disabled={!chapterEnabled}
                  />
                  <Typography.Text className="word-config-word-name" strong>
                    {w.word}
                  </Typography.Text>
                  <Button
                    aria-label={`播放 ${w.word}`}
                    type="text"
                    size="small"
                    icon={<SoundOutlined />}
                    onClick={() => speak(w.word)}
                  />
                  </div>
                  <div className="word-config-image-status">
                    {w.synced ? <span className="word-config-synced">✓ 已同步</span> : <Tag color="gold" style={{ margin: 0 }}>待同步</Tag>}
                  </div>
                  <div className="word-config-preview">
                  {w.synced ? (
                    <Image
                      src={familyWarAdminApi.getWordImageUrl(w.word, refreshKey)}
                      width={56}
                      height={56}
                      style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid #e8e8e8' }}
                      preview={{ mask: '预览' }}
                      fallback="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iMjQiIHk9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzk5OSI+5pqC5L2T55WZPC90ZXh0Pjwvc3ZnPg=="
                    />
                  ) : (
                    <div className="word-config-no-image">无图</div>
                  )}
                  </div>
                  <div className="word-config-action">
                  <Button
                    aria-label={`更换 ${w.word} 图片`}
                    size="small"
                    onClick={() => openSelector(w.word)}
                    disabled={syncing}
                  >
                    换图
                  </Button>
                  </div>
                </div>
              )
            })}
          </Card>
        )
      })}

      {data && (
        <div className={`word-config-save-bar${hasUnsavedChanges ? ' has-changes' : ''}`}>
          <div>
            <Typography.Text strong>{hasUnsavedChanges ? '有未保存的修改' : '配置已保存'}</Typography.Text>
            <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              当前启用 {activeWordCount} 个单词
            </Typography.Text>
          </div>
          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={activeWordCount === 0 || !hasUnsavedChanges}
          >
            {savedNotify ? '✅ 已保存' : '保存配置'}
          </Button>
        </div>
      )}

      <Modal
        title={`选择 ${selectingWord || ''} 的新图片`}
        open={!!selectingWord}
        onCancel={() => { setSelectingWord(null); setCandidates([]); setSelectedPhotoId(null); setPage(1); setTotalCandidates(0) }}
        width={660}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button size="small" disabled={page <= 1} onClick={handlePrevPage}>上一页</Button>
              <Typography.Text type="secondary">
                第 {page} / {Math.ceil(totalCandidates / 15) || 1} 页（共 {totalCandidates} 张）
              </Typography.Text>
              <Button size="small" disabled={page >= Math.ceil(totalCandidates / 15)} onClick={handleNextPage}>下一页</Button>
            </Space>
            <Button type="primary" disabled={!selectedPhotoId} onClick={handleConfirmSelect}>确认换图</Button>
          </div>
        }
      >
        <Spin spinning={candidatesLoading}>
          <div className="word-config-candidate-grid">
            {candidates.map(p => (
              <div
                key={p.id}
                className="word-config-candidate"
                onClick={() => setSelectedPhotoId(p.candidateId)}
                style={{
                  cursor: 'pointer',
                  border: selectedPhotoId === p.candidateId ? '3px solid #1677ff' : '3px solid transparent',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <img
                  src={p.thumb}
                  alt={p.alt || selectingWord || ''}
                  style={{ width: '100%', display: 'block' }}
                />
                <div style={{ fontSize: 11, color: '#888', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.author}
                </div>
              </div>
            ))}
          </div>
        </Spin>
      </Modal>
    </main>
  )
}

export default WordConfigPage
