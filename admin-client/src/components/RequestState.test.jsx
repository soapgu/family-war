import { fireEvent, render, screen } from '@testing-library/react'
import RequestState from './RequestState'

describe('RequestState', () => {
  it('渲染加载状态', () => {
    render(<RequestState state="loading" description="正在读取数据…" />)
    expect(screen.getByRole('status')).toHaveTextContent('正在读取数据…')
  })

  it('渲染带说明的空状态', () => {
    render(<RequestState state="empty" title="暂无记录" description="完成操作后显示。" />)
    expect(screen.getByText('暂无记录')).toBeInTheDocument()
    expect(screen.getByText('完成操作后显示。')).toBeInTheDocument()
  })

  it('渲染可重试错误状态', () => {
    const retry = vi.fn()
    render(<RequestState state="error" description="服务不可用" onRetry={retry} />)
    fireEvent.click(screen.getByRole('button', { name: /重.*试/ }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
