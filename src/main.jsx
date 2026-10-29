import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import PageBoundary from './components/PageBoundary.jsx'
import Entry from './Entry.jsx'
import './index.css'
import './roomService.css'
import './studio.css'
import './routingLiquid.css'
import './liquidWorkspace.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PageBoundary><Suspense fallback={<p className="page-loading" role="status">Открываем аудиосистему…</p>}><Entry /></Suspense></PageBoundary>
  </React.StrictMode>,
)
