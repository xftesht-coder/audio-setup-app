export default function WorkspaceHeader({ title, subtitle, symbol = '⌁', children, id, version }) {
  return <header className="studio-heading">
    <div className="studio-identity"><span className="studio-symbol" aria-hidden="true">{symbol}</span><div><h1 id={id}>{title}{version && <small> {version}</small>}</h1>{subtitle && <p>{subtitle}</p>}</div></div>
    {children && <div className="studio-heading-actions">{children}</div>}
  </header>;
}
