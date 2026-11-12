import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/500.css'
import '@fontsource/jetbrains-mono/700.css'
import '@fontsource-variable/space-grotesk/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/tokens.css'
import './styles/app.css'
import './styles/pop.css'

try {
  const t = localStorage.getItem('student:theme')
  if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t
} catch {
  /* sin almacenamiento: tema del sistema */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
