import { Component } from 'react'
import { Button, Result } from 'antd'
import { Link, useLocation } from 'react-router-dom'

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="not-found-page">
          <Result
            status="error"
            title="页面暂时无法显示"
            subTitle="管理页面发生异常，请返回首页后重试。"
            extra={(
              <Link to="/">
                <Button type="primary">返回管理首页</Button>
              </Link>
            )}
          />
        </main>
      )
    }

    return this.props.children
  }
}

export default function AppErrorBoundary({ children }) {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
}
