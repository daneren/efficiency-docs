import { useCallback, useEffect, useState } from 'react'
import './App.css'

type SyncState = 'syncing' | 'synced' | 'error' | 'offline_readonly'

type Task = { id: string; title: string; status?: string; url?: string; due?: string | null }

type View = 'today' | 'allTasks' | 'docs' | 'docEdit' | 'search' | 'settings'

type Doc = { id: string; title: string; lastModified?: string }

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
  const [allTasks, setAllTasks] = useState<Task[]>([])
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
  const [currentDocId, setCurrentDocId] = useState<string | null>(null)
  const [docs, setDocs] = useState<Doc[]>([
    { id: 'doc-1', title: '产品路线图', lastModified: '2026-09-15' },
    { id: 'doc-2', title: '技术文档模板', lastModified: '2026-09-14' },
    { id: 'doc-3', title: '会议纪要 - Q3回顾', lastModified: '2026-09-10' },
  ])
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')

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

  const loadAllTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks/all')
      const data = await res.json()
      if (isSyncState(data.syncState)) {
        // Don't override main sync state, just use the data
      }
      if (Array.isArray(data.tasks)) {
        setAllTasks(data.tasks)
      }
    } catch (e) {
      // Fallback: use today's tasks as placeholder
      setAllTasks(tasks)
    }
  }, [tasks])

  const openDoc = useCallback((docId: string) => {
    const doc = docs.find((d) => d.id === docId)
    if (doc) {
      setCurrentDocId(docId)
      setDocTitle(doc.title)
      // Stub body - in real implementation would fetch from API
      setDocBody('文档内容占位。实际应从 /api/docs/:id 读取 Notion 页面内容。')
      setView('docEdit')
    }
  }, [docs])

  const saveDoc = useCallback(async () => {
    // Stub - would call /api/docs/:id PUT in real implementation
    console.log('Save doc:', currentDocId, docTitle, docBody)
    alert('文档保存功能占位（需后端 /api/docs/:id PUT 端点）')
  }, [currentDocId, docTitle, docBody])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (view === 'allTasks') {
      void loadAllTasks()
    }
  }, [view, loadAllTasks])

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
              ['allTasks', '全部任务'],
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
                  <div>{syncDetail || '请检查配置'}</div>
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
              {syncState === 'syncing' && tasks.length === 0 && (
                <>
                  {[1, 2, 3].map((i) => (
                    <li key={`skeleton-${i}`} className="skeleton">
                      <span className="skeleton-line skeleton-title"></span>
                      <span className="skeleton-line skeleton-tag"></span>
                    </li>
                  ))}
                </>
              )}
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

        {view === 'allTasks' && (
          <section>
            <header className="page-h">
              <div>
                <h1>全部任务</h1>
                <p className="muted">所有未完成任务（不限日期） · Notion Task DB</p>
              </div>
            </header>

            {syncState === 'error' && (
              <div className="banner error" role="alert">
                <div>
                  <strong>同步失败</strong>
                  <div>显示今日任务占位数据</div>
                </div>
              </div>
            )}

            {syncState === 'offline_readonly' && (
              <div className="banner warn" role="status">
                离线模式 · 显示缓存数据
              </div>
            )}

            {syncState === 'syncing' && (
              <div className="banner info" role="status">
                {SYNC_HINT.syncing}
              </div>
            )}

            <ul className="task-list" data-write-disabled={writeDisabled ? '1' : '0'}>
              {syncState === 'syncing' && allTasks.length === 0 && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <li key={`skeleton-${i}`} className="skeleton">
                      <span className="skeleton-line skeleton-title"></span>
                      <span className="skeleton-line skeleton-tag"></span>
                    </li>
                  ))}
                </>
              )}
              {allTasks.length === 0 && syncState !== 'syncing' && (
                <li className="empty">暂无未完成任务</li>
              )}
              {allTasks.map((t) => (
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
                <p className="muted">Mock 列表 · 需后端 /api/docs 端点</p>
              </div>
            </header>
            {syncState === 'error' && (
              <div className="banner error" role="alert">
                文档同步失败。当前为本地占位数据。
              </div>
            )}
            {syncState === 'offline_readonly' && (
              <div className="banner warn" role="status">
                离线模式。显示本地占位文档列表。
              </div>
            )}
            {syncState === 'syncing' && (
              <div className="banner info" role="status">
                {SYNC_HINT.syncing}
              </div>
            )}
            <ul className="task-list">
              {syncState === 'syncing' && (
                <>
                  {[1, 2, 3].map((i) => (
                    <li key={`skeleton-${i}`} className="skeleton">
                      <span className="skeleton-line skeleton-title"></span>
                      <span className="skeleton-line skeleton-tag"></span>
                    </li>
                  ))}
                </>
              )}
              {syncState !== 'syncing' && docs.map((doc) => (
                <li key={doc.id}>
                  <span className="title">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() => openDoc(doc.id)}
                      style={{ fontSize: '0.95rem' }}
                    >
                      {doc.title}
                    </button>
                  </span>
                  {doc.lastModified && (
                    <span className="tag">{doc.lastModified}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {view === 'docEdit' && currentDocId && (
          <section>
            <header className="page-h">
              <div>
                <h1>编辑文档</h1>
                <p className="muted">编辑占位 · 需后端 /api/docs/:id GET/PUT</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setView('docs')}
                  style={{ background: 'var(--border-strong)' }}
                >
                  返回
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => void saveDoc()}
                  disabled={writeDisabled}
                >
                  保存
                </button>
              </div>
            </header>

            {syncState === 'error' && (
              <div className="banner error" role="alert">
                同步失败。可继续编辑，本地草稿已保留。
              </div>
            )}

            {syncState === 'offline_readonly' && (
              <div className="banner warn" role="status">
                离线只读。恢复网络后可编辑。
              </div>
            )}

            {syncState === 'syncing' && (
              <div className="banner info" role="status">
                同步中…
              </div>
            )}

            <div style={{ marginBottom: '1rem' }}>
              <input
                className="search"
                style={{ maxWidth: '100%', marginBottom: '0.75rem' }}
                placeholder="文档标题"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                disabled={writeDisabled}
              />
              <textarea
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '0.75rem 1rem',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  font: 'inherit',
                  fontSize: '0.95rem',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  lineHeight: '1.6',
                  resize: 'vertical',
                }}
                placeholder="文档正文（Markdown 或富文本占位）"
                value={docBody}
                onChange={(e) => setDocBody(e.target.value)}
                disabled={writeDisabled}
              />
            </div>

            <div className="banner info" style={{ marginTop: '1rem' }}>
              <div>
                <strong>占位说明</strong>
                <div>
                  • 实际应通过后端接口读取和保存 Notion 页面
                  <br />• 同步状态芯片与任务视图保持一致
                </div>
              </div>
            </div>
          </section>
        )}

        {view === 'search' && (
          <section>
            <header className="page-h">
              <div>
                <h1>搜索</h1>
                <p className="muted">
                  <strong>本地占位</strong> · 仅过滤已加载任务标题；全文搜索待后续实现
                </p>
              </div>
            </header>
            <div className="banner warn" role="status" style={{ marginBottom: '1rem' }}>
              当前为<strong>本地占位</strong>搜索，仅匹配今日任务标题。完整搜索功能需后端支持。
            </div>
            <input
              className="search"
              placeholder="搜任务标题（本地过滤）"
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
                <h1>设置</h1>
                <p className="muted">Notion 集成配置</p>
              </div>
            </header>

            <div className="health-grid">
              <span data-ok={health.configured ? '1' : '0'}>
                Token {health.configured ? '✓ 已识别' : '× 未配置'}
              </span>
              <span data-ok={health.taskDbId ? '1' : '0'}>
                Task DB {health.taskDbId ? '✓ 已填' : '× 缺失'}
              </span>
              <span data-ok={health.docRoot ? '1' : '0'} data-optional="1">
                Doc Root {health.docRoot ? '✓ 已填' : '○ 可选'}
              </span>
              <span data-ok={health.docDb ? '1' : '0'} data-optional="1">
                Doc DB {health.docDb ? '✓ 已填' : '○ 可选'}
              </span>
            </div>

            <ol className="steps">
              <li>创建 Notion Integration，复制 token</li>
              <li>在项目根目录创建配置文件（参考 .env.local.example）</li>
              <li>填入 Token 和 Task Database ID</li>
              <li>将 Integration 邀请至 Task Database</li>
              <li>重启开发服务器，点下方按钮验证</li>
            </ol>

            {setupSteps.length > 0 && (
              <ol className="steps setup-from-api">
                {setupSteps.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}

            <button type="button" className="btn" onClick={() => void ping()}>
              验证配置
            </button>
            {pingMsg && <pre className="ping">{pingMsg}</pre>}
          </section>
        )}
      </main>
    </div>
  )
}

export default App
