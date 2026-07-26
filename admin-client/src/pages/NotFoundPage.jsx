import { Button, Result } from 'antd'
import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="not-found-page">
      <Result
        status="404"
        title="页面不存在"
        subTitle="请检查管理页面地址，或返回管理首页重新选择应用。"
        extra={(
          <Link to="/">
            <Button type="primary">返回管理首页</Button>
          </Link>
        )}
      />
    </main>
  )
}
