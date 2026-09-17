import { useCallback, useEffect, useState } from 'react'
import './App.css'

type SyncState = 'syncing' | 'synced' | 'error' | 'offline_readonly'

type Task = { id: string; title: string; status?: string; url?: string; due?: string | null }

type View = 'today' | 'docs' | 'search' | 'settings'

type HealthInfo = {
  configured: boolean
  taskDbId: boolean
  docRoot: boolean
  docDb: boolean
}

const SYNC_LABEL: Record<SyncState, string> = {
  syncing: '同步中…',
  synced: '已同步',
  error: '同步失败 · 重试',
  offline_readonly: '离线只读',
}

const SYNC_HINT: Record<SyncState, string> = {
  syncing: '正在与 Notion 同步',
  synced: '数据以 Notion 为准',
  error: '同步失败。可重试；本地草稿会保留。',
  offline_readonly: '仅浏览缓存，恢复网络后可编辑',
}

function isSyncState(v: unknown): v is SyncState {
  return (
    v === 'syncing' ||
    v === 'synced' ||
    v === 'error' ||
    v === 'offline_readonly'
  )
}

function App() {
  const [view, setView] = useState<View>('today')
  const [syncState, setSyncState] = useState<SyncState>('syncing')
  const [syncDetail, setSyncDetail] = useState('')
  const [tasks, setTasks] = useState<Task[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [pingMsg, setPingMsg] = useState('')
  const [setupSteps, setSetupSteps] = useState<string[]>([])
  const [health, setHealth] = useState<HealthInfo>({
    configured: false,
    taskDbId: false,
    docRoot: false,
    docDb: false,
  })
  const [warning, setWarning] = useState('')

  const writeDisabled = syncState === 'offline_readonly' || syncState === 'syncing'

  const refresh = useCallback(async () => {
    setSyncState('syncing')
    setSyncDetail('')
    setWarning('')
    try {
      const healthRes = await fetch('/api/health').then((r) => r.json())
      const nextHealth: HealthInfo = {
        configured: Boolean(healthRes.configured),
        taskDbId: Boolean(healthRes.taskDbId),
        docRoot: Boolean(healthRes.docRoot),
        docDb: Boolean(healthRes.docDb),
      }
      setHealth(nextHealth)

      if (isSyncState(healthRes.syncState) && healthRes.syncState === 'offline_readonly') {
        setSyncState('offline_readonly')
        setSyncDetail(healthRes.error || SYNC_HINT.offline_readonly)
        return
      }

      if (!nextHealth.configured || !nextHealth.taskDbId) {
        setSyncState('error')
        const missing = [
          !nextHealth.configured ? 'NOTION_TOKEN' : null,
          !nextHealth.taskDbId ? 'NOTION_TASK_DB_ID' : null,
        ]
          .filter(Boolean)
          .join(' + ')
        setSyncDetail(`未配置 ${missing}（见设置页 / docs/NOTION_SETUP.md）`)
        setTasks([])
        return
      }

      const today = await fetch('/api/tasks/today').then(async (r) => ({
        status: r.status,
        body: await r.json(),
      }))
      const body = today.body

      if (isSyncState(body.syncState)) {
        setSyncState(body.syncState)
      } else {
        setSyncState(body.ok ? 'synced' : 'error')
      }

      if (body.error) setSyncDetail(String(body.error))
      if (body.warning) setWarning(String(body.warning))

      // Keep prior tasks when offline_readonly if API returns empty cache for now
      if (Array.isArray(body.tasks)) {
        if (body.syncState === 'offline_readonly' && body.tasks.length === 0) {
          // leave existing tasks as soft cache
        } else {
          setTasks(body.tasks)
        }
      }

      if (!body.ok && body.syncState !== 'offline_readonly') {
        setSyncState('error')
        setSyncDetail(body.error || '拉取失败')
      }
    } catch (e) {
      setSyncState('offline_readonly')
      setSyncDetail(e instanceof Error ? e.message : 'API 不可达')
    }
  }, [])

  const ping = useCallback(async () => {
    setPingMsg('…')
    setSetupSteps([])
    try {
      const res = await fetch('/api/notion/ping')
      const r = await res.json()
      if (isSyncState(r.syncState)) setSyncState(r.syncState)
      if (Array.isArray(r.setup)) setSetupSteps(r.setup.map(String))

      if (r.ok) {
        const sample = r.sample
          ? `sample: ${r.sample.title || '(untitled)'} (${r.sample.id})`
          : 'no row'
        setPingMsg(
          [r.message || 'OK', `hasRow=${Boolean(r.hasRow)}`, sample]
            .filter(Boolean)
            .join('\n'),
        )
      } else {
        setPingMsg(r.error || JSON.stringify(r))
        if (r.error) setSyncDetail(String(r.error))
      }
    } catch (e) {
      setPingMsg(e instanceof Error ? e.message : 'ping failed')
      setSyncState('offline_readonly')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const filtered = tasks.filter((t) =>
    !searchQ ? true : (t.title || '').toLowerCase().includes(searchQ.toLowerCase()),
  )

  const chipTitle = [SYNC_HINT[syncState], syncDetail].filter(Boolean).join(' — ')

  return (
    <div className="app" data-sync-state={syncState}>
      <aside className="sidebar">
        <div className="brand">
          效率文档<span>.</span>
        </div>
        <nav>
          {(
            [
              ['today', '今日清单'],
              ['docs', '文档库'],
              ['search', '搜索'],
              ['settings', '设置'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={view === id ? 'nav active' : 'nav'}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <button
            type="button"
            className={`sync-chip sync-${syncState}`}
            title={chipTitle}
            onClick={() => {
              if (syncState === 'error') void refresh()
            }}
          >
            {SYNC_LABEL[syncState]}
          </button>
          <button
            type="button"
            className="linkish"
            onClick={() => void refresh()}
            disabled={syncState === 'syncing'}
          >
            刷新
          </button>
        </div>
      </aside>

      <main className="main">
        {view === 'today' && (
          <section>
            <header className="page-h">
              <div>
                <h1>今日清单</h1>
                <p className="muted">Notion Task DB · source of truth</p>
              </div>
            </header>

            {syncState === 'error' && (
              <div className="banner error" role="alert">
                <div>
                  <strong>同步失败</strong>
                  <div>{syncDetail || '请检查 Token / Task DB'}</div>
                </div>
                <button type="button" className="btn" onClick={() => void refresh()}>
                  重试
                </button>
              </div>
            )}

            {syncState === 'offline_readonly' && (
              <div className="banner warn" role="status">
                {syncDetail || SYNC_HINT.offline_readonly}
              </div>
            )}

            {syncState === 'syncing' && (
              <div className="banner info" role="status">
                {SYNC_HINT.syncing}
              </div>
            )}

            {warning && syncState === 'synced' && (
              <div className="banner warn" role="status">
                {warning}
              </div>
            )}

            <ul className="task-list" data-write-disabled={writeDisabled ? '1' : '0'}>
              {tasks.length === 0 && syncState === 'synced' && (
                <li className="empty">暂无今日/过期未完成任务（或 Due 属性未映射）</li>
              )}
              {tasks.length === 0 && syncState === 'error' && (
                <li className="empty">暂无列表 — 配置好后点重试</li>
              )}
              {tasks.length === 0 && syncState === 'offline_readonly' && (
                <li className="empty">离线无缓存任务可展示</li>
              )}
              {tasks.map((t) => (
                <li key={t.id}>
                  <span className="title">
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer">
                        {t.title}
                      </a>
                    ) : (
                      t.title
                    )}
                  </span>
                  {t.status ? <span className="tag">{t.status}</span> : null}
                  {t.due ? <span className="tag">{t.due}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === 'docs' && (
          <section>
            <header className="page-h">
              <div>
                <h1>文档库</h1>
                <p className="muted">骨架占位 · M3 接根页子页 / Doc DB</p>
              </div>
            </header>
            <div className="placeholder">文档树将按 PRD Doc 映射拉取</div>
          </section>
        )}

        {view === 'search' && (
          <section>
            <header className="page-h">
              <div>
                <h1>搜索</h1>
                <p className="muted">本地过滤占位；全文搜索后续</p>
              </div>
            </header>
            <input
              className="search"
              placeholder="搜任务标题"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              // offline_readonly 允许浏览/搜索缓存
            />
            <ul className="task-list">
              {filtered.length === 0 && <li className="empty">无匹配</li>}
              {filtered.map((t) => (
                <li key={t.id}>
                  <span className="title">
                    {t.url ? (
                      <a href={t.url} target="_blank" rel="noreferrer">
                        {t.title}
                      </a>
                    ) : (
                      t.title
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === 'settings' && (
          <section>
            <header className="page-h">
              <div>
                <h1>设置 · Notion</h1>
                <p className="muted">Token 只留本机，勿提交、勿推远程。</p>
              </div>
            </header>

            <div className="health-grid">
              <span data-ok={health.configured ? '1' : '0'}>
                Token {health.configured ? '已识别' : '未配置'}
              </span>
              <span data-ok={health.taskDbId ? '1' : '0'}>
                Task DB {health.taskDbId ? '已填' : '缺失'}
              </span>
              <span data-ok={health.docRoot ? '1' : '0'}>
                Doc Root {health.docRoot ? '已填' : '可选'}
              </span>
              <span data-ok={health.docDb ? '1' : '0'}>
                Doc DB {health.docDb ? '已填' : '可选'}
              </span>
            </div>

            <ol className="steps">
              <li>
                在项目根复制 <code>.env.local.example</code> → <code>.env.local</code>
              </li>
              <li>
                填入 <code>NOTION_TOKEN</code>、<code>NOTION_TASK_DB_ID</code>
              </li>
              <li>把 Integration 邀请进 Task DB（及 Doc）</li>
              <li>
                重启 <code>npm run dev</code>，点下方 M1 Ping
              </li>
            </ol>

            {setupSteps.length > 0 && (
              <ol className="steps setup-from-api">
                {setupSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}

            <button type="button" className="btn" onClick={() => void ping()}>
              M1：鉴权并读一条
            </button>
            {pingMsg && <pre className="ping">{pingMsg}</pre>}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
