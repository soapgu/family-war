import { Breadcrumb, Space, Typography } from 'antd'
import { Link } from 'react-router-dom'

export default function PageHeader({ title, description, breadcrumbs = [], extra }) {
  const items = breadcrumbs.map((item, index) => ({
    key: item.path || `${item.title}-${index}`,
    title: item.path ? <Link to={item.path}>{item.title}</Link> : item.title,
  }))

  return (
    <header className="page-header">
      {items.length > 0 && <Breadcrumb className="page-breadcrumb" items={items} />}
      <div className="page-header-main">
        <div className="page-header-copy">
          <Typography.Title level={2} className="page-title">
            {title}
          </Typography.Title>
          {description && (
            <Typography.Paragraph type="secondary" className="page-description">
              {description}
            </Typography.Paragraph>
          )}
        </div>
        {extra && <Space className="page-header-actions" wrap>{extra}</Space>}
      </div>
    </header>
  )
}
