import { Button, Empty, Result, Spin, Typography } from 'antd'

export default function RequestState({
  state,
  title,
  description,
  onRetry,
  retryLabel = '重试',
}) {
  if (state === 'loading') {
    return (
      <div className="request-state" role="status">
        <Spin size="large" />
        <Typography.Text type="secondary">{description || '正在加载…'}</Typography.Text>
      </div>
    )
  }

  if (state === 'empty') {
    return (
      <div className="request-state">
        <Empty
          description={(
            <span>
              <strong>{title || '暂无数据'}</strong>
              {description && <small>{description}</small>}
            </span>
          )}
        />
      </div>
    )
  }

  return (
    <Result
      className="request-state"
      status="warning"
      title={title || '加载失败'}
      subTitle={description || '暂时无法获取数据，请稍后重试。'}
      extra={onRetry && <Button type="primary" onClick={onRetry}>{retryLabel}</Button>}
    />
  )
}
