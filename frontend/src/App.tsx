import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import axios from 'axios'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { Activity, Bird, BookOpen, CalendarCheck, ChartNoAxesCombined, ChevronDown, CircleHelp, Feather, HeartPulse, LogOut, Menu, Plus, Search, Send, ShieldAlert, Sparkles, Weight as WeightIcon, X } from 'lucide-react'
import api, { type Article, type Parrot, type RoutineTask, type Weight } from './api'

type CareEntry = { id: number; kind: string; occurred_at: string; detail: string; amount: string }
type Analytics = {
  weight: Weight[]
  care_counts_30d: Record<string, number>
  anomaly: { status: string; message: string; score?: number | null }
}
type AssistantMessage = { id: number; role: string; content: string; metadata?: { urgent?: boolean; mode?: string; sources?: { title: string; url: string }[] } }
type AssistantConversation = { id: number; title: string; updated_at: string; messages: AssistantMessage[] }

function errorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback
  const detail = error.response?.data?.detail
  return typeof detail === 'string' ? detail : fallback
}

function App() {
  const [authenticated, setAuthenticated] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [bird, setBird] = useState<Parrot | null>(null)
  const [birds, setBirds] = useState<Parrot[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let active = true
    api.get('/auth/me/').then(() => { if (active) setAuthenticated(true) }).catch(() => { if (active) setAuthenticated(false) }).finally(() => { if (active) setCheckingSession(false) })
    return () => { active = false }
  }, [])

  const loadBirds = useCallback(async () => {
    if (!authenticated) return
    try {
      const response = await api.get('/parrots/')
      const items: Parrot[] = response.data.results ?? response.data
      setBirds(items)
      setBird((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null)
    } catch { setBirds([]) }
  }, [authenticated])

  useEffect(() => { void loadBirds() }, [loadBirds])

  async function signOut() {
    try { await api.post('/auth/logout/') } catch { setAuthenticated(false) }
    setAuthenticated(false)
    navigate('/login')
  }

  if (checkingSession) return <main className="session-loading" aria-live="polite">Checking your care space…</main>
  if (!authenticated) return <Routes><Route path="/login" element={<AuthPage onLogin={() => { setAuthenticated(true); navigate('/') }} />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>

  const navItems = [
    { to: '/', label: 'Overview', icon: Activity },
    { to: '/care', label: 'Daily care', icon: CalendarCheck },
    { to: '/assistant', label: 'Care assistant', icon: Sparkles },
    { to: '/knowledge', label: 'Care library', icon: BookOpen },
    { to: '/analytics', label: 'Trends', icon: ChartNoAxesCombined },
  ]

  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Feather size={19} /></div><span>parrotcare<span className="brand-ai">.ai</span></span><button className="icon-button close-menu" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={18} /></button></div>
      <div className="workspace-label">YOUR AVIARY</div>
      <div className="bird-select-wrap"><Bird size={17} /><select aria-label="Selected parrot" value={bird?.id ?? ''} onChange={(event) => setBird(birds.find((item) => item.id === Number(event.target.value)) ?? null)}><option value="">Select a parrot</option>{birds.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><ChevronDown size={14} /></div>
      <nav className="main-nav" aria-label="Main navigation">{navItems.map(({ to, label, icon: Icon }) => <Link onClick={() => setMobileOpen(false)} className={location.pathname === to ? 'active' : ''} to={to} key={to}><Icon size={18} /><span>{label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="care-note"><div className="care-note-icon"><HeartPulse size={17} /></div><p>Quiet changes matter.<br /><span>When in doubt, call your avian vet.</span></p></div><button className="profile-button" onClick={signOut}><div className="avatar">{(bird?.name ?? 'P').slice(0, 1).toUpperCase()}</div><span>My account</span><LogOut size={16} /></button></div>
    </aside>
    {mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button><div className="breadcrumb">ParrotCare <span>/</span> {navItems.find((item) => item.to === location.pathname)?.label ?? 'Workspace'}</div><div className="topbar-actions"><span className="status-dot" /> Personal care space <button className="help-button" title="Emergency guidance" onClick={() => navigate('/assistant')}><CircleHelp size={17} /></button></div></header>
      <div className="page-wrap"><Routes><Route path="/" element={<Dashboard bird={bird} onCreated={loadBirds} />} /><Route path="/care" element={<CarePage bird={bird} />} /><Route path="/assistant" element={<AssistantPage bird={bird} />} /><Route path="/knowledge" element={<KnowledgePage />} /><Route path="/analytics" element={<AnalyticsPage bird={bird} />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></div>
    </main>
  </div>
}

function AuthPage({ onLogin }: { onLogin: () => void }) {
  const [register, setRegister] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    try {
      await api.get('/auth/csrf/')
      if (register) await api.post('/auth/register/', { email, password: form.get('password'), first_name: form.get('first_name') })
      await api.post('/auth/login/', { email, password: form.get('password') })
      onLogin()
    } catch (exception: unknown) { setError(errorMessage(exception, register ? 'Check your details and password requirements.' : 'Email or password did not match.')) }
    finally { setBusy(false) }
  }
  return <main className="auth-page"><section className="auth-aside"><div className="auth-brand"><Feather size={19} /> parrotcare<span>.ai</span></div><div className="auth-message"><span className="eyebrow">CARE, WITH CONTEXT</span><h1>A steadier way<br />to care for them.</h1><p>Good days are made of small observations, thoughtful routines, and knowing when to ask for help.</p><div className="bird-illustration"><img src="https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=900&q=85" alt="Colorful parrot perched among green leaves" /><div className="image-caption"><span>Every detail, in one place</span><Feather size={17} /></div></div></div></section><section className="auth-form-side"><form className="auth-form" onSubmit={submit}><div className="form-kicker">A HOME FOR THEIR WHOLE STORY</div><h2>{register ? 'Create your account' : 'Welcome back'}</h2><p className="muted">{register ? 'Start building a care rhythm that fits your bird.' : 'Sign in to pick up where you left off.'}</p>{register && <label>Your name<input name="first_name" autoComplete="given-name" required /></label>}<label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={8} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary full" disabled={busy}>{busy ? 'Working…' : register ? 'Create account' : 'Sign in'}</button><button type="button" className="text-button auth-switch" onClick={() => { setRegister(!register); setError('') }}>{register ? 'Already have an account? Sign in' : 'New to ParrotCare? Create an account'}</button><div className="auth-safety"><ShieldAlert size={15} /> Care guidance supports, but never replaces, an avian veterinarian.</div></form></section></main>
}

function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action}</div>
}

function Dashboard({ bird, onCreated }: { bird: Parrot | null; onCreated: () => void }) {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState<RoutineTask[]>([])
  const [weights, setWeights] = useState<Weight[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!bird) { setTasks([]); setWeights([]); return }
    setLoading(true)
    Promise.all([api.get(`/parrots/${bird.id}/routine/`), api.get(`/parrots/${bird.id}/weight/`)]).then(([routine, weight]) => { setTasks(routine.data); setWeights(weight.data) }).catch(() => setError('Could not load care data. Check your API connection.')).finally(() => setLoading(false))
  }, [bird])
  async function toggleTask(task: RoutineTask) {
    try { await api.post(`/routine-tasks/${task.id}/complete/`); setTasks((items) => items.map((item) => item.id === task.id ? { ...item, completed_today: true } : item)) } catch { setError('Could not save completion.') }
  }
  const completed = tasks.filter((task) => task.completed_today).length
  const percent = tasks.length ? Math.round(completed / tasks.length * 100) : 0
  return <>
    <PageHeading eyebrow="YOUR CARE DESK" title={bird ? `Good to see you, ${bird.name}'s person.` : 'A little more in tune.'} subtitle={bird ? `Here's the shape of ${bird.name}'s day so far.` : 'Add a parrot profile to begin making care more personal.'} action={bird ? <button className="button button-outline" onClick={() => setShowForm(true)}><Plus size={16} /> Add bird</button> : undefined} />
    {error && <div className="inline-error" role="alert">{error}</div>}
    {!bird ? <section className="empty-aviary"><div className="empty-bird"><Bird size={34} /></div><div><h2>Your aviary starts here</h2><p>Keep profiles, routines, and observations together for each bird in your care.</p></div><button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Add your first parrot</button></section> : <>
      <section className="welcome-strip"><div className="welcome-copy"><span className="welcome-label"><span className="status-dot" /> TODAY'S CARE SNAPSHOT</span><h2>Small things add up, {bird.name}.</h2><p>{bird.species_name ? `${bird.species_name} · ` : ''}{bird.weight_grams ? `Last recorded ${bird.weight_grams} g` : 'Build a useful history one gentle check-in at a time.'}</p></div><div className="progress-ring" style={{ '--progress': `${percent * 3.6}deg` } as CSSProperties}><div className="progress-inner"><b>{percent}%</b><span>done today</span></div></div><div className="leaf-pattern">✳</div></section>
      <section className="dashboard-grid"><div className="panel routine-panel"><div className="panel-heading"><div><div className="eyebrow">THE DAILY RHYTHM</div><h2>Care checklist</h2></div><span className="count-pill">{completed} / {tasks.length}</span></div>{loading ? <div className="loading-line">Gathering today's care…</div> : <div className="task-list">{tasks.map((task) => <label className={`task-row ${task.completed_today ? 'task-done' : ''}`} key={task.id}><input type="checkbox" checked={task.completed_today} onChange={() => void toggleTask(task)} /><span className="checkmark" /><span className="task-title">{task.title}<small>{task.category}{task.essential && ' · essential'}</small></span><span className={`task-category ${task.category}`}>{task.category}</span></label>)}</div>}{!tasks.length && !loading && <p className="empty-note">No routine items yet.</p>}</div><div className="side-stack"><div className="panel weight-panel"><div className="panel-heading"><div><div className="eyebrow">BODY WEIGHT</div><h2>Personal trend</h2></div><WeightIcon size={19} className="muted-icon" /></div>{weights.length ? <><div className="weight-number">{weights.at(-1)?.grams}<span>g</span></div><MiniTrend values={weights.map((item) => item.grams)} /><p className="small-note">Logged measurements, not a health verdict.</p></> : <p className="empty-note">A first measurement gives you a starting point for {bird.name}'s own history.</p>}</div><button className="vet-banner vet-banner-button" onClick={() => navigate('/assistant')}><HeartPulse size={19} /><span><b>Something feels off?</b><small>Trust the change. Call an avian vet.</small></span><ChevronDown size={17} /></button></div></section>
      <section className="quick-links"><Link to="/care"><CalendarCheck size={18} /><span>Log today's care</span><ChevronDown size={16} /></Link><Link to="/assistant"><Sparkles size={18} /><span>Ask a care question</span><ChevronDown size={16} /></Link><Link to="/analytics"><ChartNoAxesCombined size={18} /><span>Review trends</span><ChevronDown size={16} /></Link></section>
    </>}
    {showForm && <ParrotModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onCreated() }} />}
  </>
}

function MiniTrend({ values }: { values: number[] }) {
  const points = values.slice(-12).map((value, index, items) => `${items.length < 2 ? 50 : index / (items.length - 1) * 100},${38 - (value - Math.min(...items)) / (Math.max(...items) - Math.min(...items) || 1) * 30}`).join(' ')
  return <svg className="mini-trend" viewBox="0 0 100 42" preserveAspectRatio="none" aria-label="Recent weight trend"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.3" vectorEffect="non-scaling-stroke" /></svg>
}

function ParrotModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [species, setSpecies] = useState<{ id: number; common_name: string }[]>([])
  const [error, setError] = useState('')
  useEffect(() => { void api.get('/species/').then((result) => setSpecies(result.data.results ?? result.data)).catch(() => setSpecies([])) }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget)
    const optional = (key: string) => String(data.get(key) ?? '').trim()
    try {
      await api.post('/parrots/', {
        name: optional('name'), species: optional('species') || null, subspecies: optional('subspecies'),
        hatch_date: optional('hatch_date') || null, estimated_age: optional('estimated_age'), sex: optional('sex'),
        weight_grams: optional('weight_grams') || null, diet: optional('diet'), activity_level: optional('activity_level'),
        medical_conditions: optional('medical_conditions'), medications: optional('medications'), sensitivities: optional('sensitivities'),
        housing: optional('housing'), acquired_on: optional('acquired_on') || null, notes: optional('notes'),
        veterinarian_name: optional('veterinarian_name'), veterinarian_contact: optional('veterinarian_contact'),
      })
      onSaved()
    } catch (exception: unknown) { setError(errorMessage(exception, 'Could not save profile. Check the fields and try again.')) }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="modal profile-modal" onSubmit={submit}><div className="modal-head"><div><div className="eyebrow">NEW PROFILE</div><h2>Meet your parrot</h2><p>Unknown details can be left blank and filled in later.</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={19} /></button></div><div className="profile-fields"><label>Name<input name="name" required maxLength={80} autoFocus /></label><label>Species<select name="species"><option value="">Not sure yet</option>{species.map((item) => <option key={item.id} value={item.id}>{item.common_name}</option>)}</select></label><label>Subspecies<input name="subspecies" /></label><div className="form-row"><label>Sex<select name="sex"><option value="unknown">Unknown</option><option value="female">Female</option><option value="male">Male</option></select></label><label>Weight (g)<input name="weight_grams" type="number" min="1" /></label></div><div className="form-row"><label>Hatch date<input name="hatch_date" type="date" /></label><label>Estimated age<input name="estimated_age" placeholder="e.g. around 4 years" /></label></div><div className="form-row"><label>Activity level<select name="activity_level"><option value="">Not set</option><option value="low">Low</option><option value="moderate">Moderate</option><option value="high">High</option></select></label><label>Acquired on<input name="acquired_on" type="date" /></label></div><label>Current diet<textarea name="diet" rows={2} /></label><label>Known health conditions<textarea name="medical_conditions" rows={2} /></label><label>Medication and supplements<textarea name="medications" rows={2} /></label><label>Allergies or sensitivities<textarea name="sensitivities" rows={2} /></label><label>Housing and environment<textarea name="housing" rows={2} /></label><div className="form-row"><label>Veterinarian<input name="veterinarian_name" /></label><label>Clinic contact<input name="veterinarian_contact" /></label></div><label>Notes<textarea name="notes" rows={2} /></label></div>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary">Create profile</button></div></form></div>
}

function CarePage({ bird }: { bird: Parrot | null }) {
  const [entries, setEntries] = useState<CareEntry[]>([])
  const [weights, setWeights] = useState<Weight[]>([])
  const [tasks, setTasks] = useState<RoutineTask[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    if (!bird) return
    const [care, routine, weight] = await Promise.all([api.get(`/parrots/${bird.id}/care/`), api.get(`/parrots/${bird.id}/routine/`), api.get(`/parrots/${bird.id}/weight/`)]); setEntries(care.data); setTasks(routine.data); setWeights(weight.data)
  }, [bird])
  useEffect(() => { void load().catch(() => setMessage('Care entries could not be loaded.')) }, [load])
  async function addEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!bird) return; setBusy(true); const data = new FormData(event.currentTarget)
    try { await api.post(`/parrots/${bird.id}/care/`, { kind: data.get('kind'), occurred_at: new Date().toISOString(), detail: data.get('detail'), amount: data.get('amount') }); setMessage('Care note saved.'); event.currentTarget.reset(); await load() } catch { setMessage('Could not save the care note.') } finally { setBusy(false) }
  }
  async function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!bird) return; const data = new FormData(event.currentTarget)
    try { await api.post(`/parrots/${bird.id}/routine/`, { title: data.get('title'), category: data.get('category'), essential: false }); event.currentTarget.reset(); await load() } catch { setMessage('Could not add routine task.') }
  }
  async function addWeight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!bird) return
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await api.post(`/parrots/${bird.id}/weight/`, { grams: Number(data.get('grams')), measured_at: new Date().toISOString(), note: data.get('note') })
      setMessage('Weight measurement saved to the personal trend.')
      form.reset()
      await load()
    } catch { setMessage('Could not save the measurement. Check the value and try again.') }
  }
  if (!bird) return <EmptyBird />
  return <><PageHeading eyebrow="CARE JOURNAL" title="The rhythm of the day" subtitle={`Log the little details that help you understand ${bird.name}'s routine.`} /><div className="care-layout"><section className="panel care-form-panel"><div className="eyebrow">ADD AN OBSERVATION</div><h2>What happened?</h2><form onSubmit={addEntry}><label>Care type<select name="kind"><option value="feeding">Feeding</option><option value="hydration">Water refresh</option><option value="activity">Activity</option><option value="sleep">Sleep</option><option value="enrichment">Enrichment</option></select></label><label>Note<input name="detail" placeholder="Ate breakfast, tried a new puzzle…" /></label><label>Amount or duration<input name="amount" placeholder="Optional" /></label><button className="button button-primary full" disabled={busy}><Plus size={16} /> {busy ? 'Saving…' : 'Save care note'}</button>{message && <p className="inline-message" role="status">{message}</p>}</form></section><section className="panel care-timeline"><div className="panel-heading"><div><div className="eyebrow">RECENTLY RECORDED</div><h2>Care notes</h2></div><span className="count-pill">{entries.length}</span></div>{entries.length ? entries.map((entry) => <div className="timeline-row" key={entry.id}><div className={`timeline-dot ${entry.kind}`} /><div><b>{entry.kind[0].toUpperCase() + entry.kind.slice(1)}</b><p>{entry.detail || entry.amount || 'Recorded care'}</p></div><time>{new Date(entry.occurred_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></div>) : <div className="empty-state"><Feather size={24} /><p>Your care journal is ready for its first entry.</p></div>}</section></div><div className="care-secondary"><section className="panel weight-entry-panel"><div className="eyebrow">WEIGHT HISTORY</div><h2>Record a measurement</h2><p>Compare with {bird.name}'s own history, not a universal target.</p><form onSubmit={addWeight}><label>Weight in grams<input name="grams" type="number" min="1" required placeholder="e.g. 420" /></label><label>Note<input name="note" placeholder="Optional context" /></label><button className="button button-outline"><WeightIcon size={15} /> Save measurement</button></form></section><section className="panel weight-history-panel"><div className="panel-heading"><div><div className="eyebrow">RECENT MEASUREMENTS</div><h2>Personal record</h2></div><span className="count-pill">{weights.length}</span></div>{weights.slice(-5).reverse().map((weight) => <div className="weight-history-row" key={weight.id}><b>{weight.grams} g</b><time>{new Date(weight.measured_at).toLocaleDateString()}</time></div>)}{!weights.length && <p className="empty-note">Your first measurement will appear here.</p>}</section></div><section className="panel routine-editor"><div className="panel-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h2>Today's routine</h2></div></div><div className="routine-editor-list">{tasks.map((task) => <div key={task.id}><span>{task.title}{task.essential && <em>Essential</em>}</span><span className={task.completed_today ? 'done-label' : 'pending-label'}>{task.completed_today ? 'Completed' : 'Open'}</span></div>)}</div><form className="inline-task-form" onSubmit={addTask}><input name="title" placeholder="Add a routine activity" required /><select name="category"><option value="enrichment">Enrichment</option><option value="feeding">Feeding</option><option value="hydration">Hydration</option><option value="activity">Activity</option><option value="sleep">Sleep</option></select><button className="button button-outline"><Plus size={15} /> Add task</button></form></section></>
}

function AssistantPage({ bird }: { bird: Parrot | null }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<{ role: string; text: string; urgent?: boolean; sources?: { title: string; url: string }[]; mode?: string }[]>([])
  const [conversations, setConversations] = useState<AssistantConversation[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    void api.get('/assistant/conversations/').then(({ data }) => setConversations(data.results ?? data)).catch(() => setConversations([]))
  }, [])
  async function ask(value = question) {
    if (!value.trim() || busy) return
    setMessages((items) => [...items, { role: 'user', text: value }]); setQuestion(''); setBusy(true); setError('')
    try {
      const { data } = await api.post('/assistant/chat/', { message: value, parrot: bird?.id, conversation: conversationId })
      setConversationId(data.conversation)
      setMessages((items) => [...items, { role: 'assistant', text: data.answer, urgent: data.urgent, sources: data.sources, mode: data.mode }])
      const { data: recent } = await api.get('/assistant/conversations/')
      setConversations(recent.results ?? recent)
    } catch { setError('The assistant could not reach the care service. Your message has not been answered.') } finally { setBusy(false) }
  }
  async function openConversation(id: number) {
    setBusy(true); setError('')
    try {
      const { data } = await api.get<AssistantConversation[]>('/assistant/conversations/')
      const conversation = (data as AssistantConversation[]).find((item) => item.id === id)
      if (!conversation) return
      setConversationId(id)
      setMessages(conversation.messages.map((message) => ({
        role: message.role,
        text: message.content,
        urgent: message.metadata?.urgent,
        mode: message.metadata?.mode,
        sources: message.metadata?.sources,
      })))
    } catch { setError('Could not open this conversation.') } finally { setBusy(false) }
  }
  function newConversation() { setConversationId(null); setMessages([]); setError('') }
  const prompts = ['What should I track in a daily routine?', 'How can I add safe enrichment?', 'What changes should prompt a vet call?']
  return <><PageHeading eyebrow="CARE ASSISTANT" title="A thoughtful second opinion." subtitle={bird ? `Questions about ${bird.name}, grounded in the care library.` : 'Ask general care questions, or select a bird for more context.'} /><div className="assistant-layout"><section className="chat-panel"><div className="chat-topline"><div className="assistant-avatar"><Sparkles size={18} /></div><div><b>ParrotCare guide</b><span><i className="status-dot" /> Retrieval grounded · not a diagnosis</span></div><button className="icon-button" title="New conversation" onClick={newConversation}><Plus size={18} /></button></div>{conversations.length > 0 && <div className="conversation-strip"><span>RECENT</span>{conversations.slice(0, 4).map((conversation) => <button className={conversation.id === conversationId ? 'selected' : ''} key={conversation.id} onClick={() => void openConversation(conversation.id)} title={conversation.title}>{conversation.title || 'Care conversation'}</button>)}</div>}<div className="chat-scroll">{!messages.length ? <div className="chat-welcome"><div className="welcome-spark"><Sparkles size={20} /></div><h2>What are you noticing?</h2><p>Ask about routines, behavior, nutrition, or what details might be useful to track. Urgent signs are handled first.</p><div className="prompt-list">{prompts.map((prompt) => <button key={prompt} onClick={() => void ask(prompt)}>{prompt}<Send size={14} /></button>)}</div></div> : messages.map((item, index) => <div className={`chat-message ${item.role}`} key={`${index}-${item.text.slice(0, 12)}`}><div className="message-avatar">{item.role === 'assistant' ? <Feather size={14} /> : 'Y'}</div><div className="message-body">{item.urgent && <div className="urgent-notice"><ShieldAlert size={17} /><div><b>Immediate veterinary care</b><span>Call an avian veterinarian or emergency service now.</span></div></div>}<p>{item.text}</p>{item.mode && <small className="mode-label">{item.mode === 'retrieval-fallback' ? 'Knowledge fallback' : item.mode === 'safety-rule' ? 'Safety guidance' : 'AI-assisted'}</small>}{item.sources?.map((source) => <a className="source-chip" href={source.url} target="_blank" rel="noreferrer" key={source.url}><BookOpen size={13} /> {source.title}</a>)}</div></div>)}{busy && <div className="typing-indicator"><span /><span /><span /> Gathering relevant care context…</div>}{error && <div className="form-error chat-error" role="alert">{error}<button onClick={() => void ask(messages.at(-1)?.text ?? '')}>Retry</button></div>}</div><form className="chat-composer" onSubmit={(event) => { event.preventDefault(); void ask() }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a care question…" aria-label="Your question" maxLength={4000} /><button className="send-button" disabled={!question.trim() || busy} aria-label="Send message"><Send size={18} /></button></form><p className="chat-disclaimer"><ShieldAlert size={13} /> Not a diagnosis. Sudden or severe symptoms need an avian veterinarian.</p></section><aside className="assistant-aside"><div className="eyebrow">A SAFER WAY TO ASK</div><div className="assistant-aside-item"><span className="aside-number">01</span><div><b>Describe the change</b><p>When it started and what is different can help frame the next step.</p></div></div><div className="assistant-aside-item"><span className="aside-number">02</span><div><b>Urgent comes first</b><p>Breathing distress, collapse, seizure, bleeding, or toxin exposure means call now.</p></div></div><div className="assistant-aside-item"><span className="aside-number">03</span><div><b>Sources stay visible</b><p>References link to stored care articles. Missing sources are never invented.</p></div></div><Link className="aside-library-link" to="/knowledge"><BookOpen size={16} /> Browse care library <ChevronDown size={15} /></Link></aside></div></>
}

function KnowledgePage() {
  const [query, setQuery] = useState('')
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
        event.preventDefault()
        searchInput.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])
  useEffect(() => {
    setLoading(true); const timer = window.setTimeout(() => { api.get('/knowledge/', { params: query ? { search: query } : {} }).then((result) => setArticles(result.data.results ?? result.data)).catch(() => setError('Care library is not reachable.')).finally(() => setLoading(false)) }, 250)
    return () => window.clearTimeout(timer)
  }, [query])
  return <><PageHeading eyebrow="CURATED REFERENCES" title="The care library" subtitle="Practical starting points with sources attached. Articles need professional review before being treated as clinical guidance." /><label className="search-field"><Search size={18} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nutrition, behavior, routines…" /><kbd>/</kbd></label>{error && <div className="inline-error">{error}</div>}{loading ? <div className="loading-line">Searching references…</div> : articles.length ? <div className="article-grid">{articles.map((article) => <article className="article-card" key={article.id}><div className="article-mark"><BookOpen size={19} /></div><div className="article-review">{article.reviewed ? 'Reviewed' : 'Source not reviewed'}</div><h2>{article.title}</h2><p>{article.body}</p><a href={article.source_url} target="_blank" rel="noreferrer">{article.source_title}<span>↗</span></a></article>)}</div> : <div className="empty-state library-empty"><BookOpen size={28} /><h2>No matching references</h2><p>Try a broader term. New articles should include identifiable sources.</p></div>}</>
}

function AnalyticsPage({ bird }: { bird: Parrot | null }) {
  const [data, setData] = useState<Analytics | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { if (!bird) { setData(null); return } api.get(`/parrots/${bird.id}/analytics/`).then((result) => setData(result.data)).catch(() => setError('Trend data could not be loaded.')) }, [bird])
  if (!bird) return <EmptyBird />
  const weights: Weight[] = data?.weight ?? []
  const care = data?.care_counts_30d ?? {}
  return <><PageHeading eyebrow="PERSONAL HISTORY" title={`${bird.name}'s patterns`} subtitle="Descriptive trends from records you entered. A statistical change is a prompt to review, not a medical conclusion." /><section className="analytics-summary"><div className="panel analytics-chart"><div className="panel-heading"><div><div className="eyebrow">WEIGHT HISTORY</div><h2>Your bird, over time</h2></div><WeightIcon size={19} className="muted-icon" /></div>{weights.length > 1 ? <div className="chart-area"><ResponsiveWeightChart data={weights} /></div> : <div className="chart-empty"><ChartNoAxesCombined size={26} /><span>{weights.length ? 'Add another measurement to see a trend.' : 'No weight measurements recorded yet.'}</span></div>}<p className="small-note">Measurements shown as recorded. No universal species threshold is applied.</p></div><div className="analytics-side"><div className="panel coverage-panel"><div className="eyebrow">CARE LOG · LAST 30 DAYS</div><h2>Recorded moments</h2>{Object.entries(care).length ? Object.entries(care).map(([kind, count]) => <div className="care-stat" key={kind}><span>{kind}</span><b>{count as number}</b></div>) : <p className="empty-note">Care patterns will appear as you log activity.</p>}</div><div className="panel anomaly-panel"><div className="anomaly-icon"><Activity size={18} /></div><div className="eyebrow">PERSONAL TREND REVIEW</div><h2>{data?.anomaly?.status === 'insufficient_history' ? 'Building a baseline' : data?.anomaly?.status === 'review_change' ? 'A change to review' : 'No strong change flagged'}</h2><p>{data?.anomaly?.message ?? 'Add measurements to compare this bird with its own history.'}</p><span className="not-diagnosis">NOT A DIAGNOSIS</span></div></div></section><div className="model-status"><ShieldAlert size={18} /><div><b>Clinical risk model unavailable</b><span>No suitable labeled veterinary dataset is configured. Emergency rules always take precedence.</span></div><Link to="/assistant">Symptom guidance <ChevronDown size={14} /></Link></div>{error && <div className="inline-error">{error}</div>}</>
}

function ResponsiveWeightChart({ data }: { data: Weight[] }) {
  return <div className="weight-chart"><svg viewBox="0 0 560 180" role="img" aria-label="Weight plotted across recorded dates" preserveAspectRatio="none"><line x1="20" y1="150" x2="540" y2="150" stroke="#dce2d6" /><line x1="20" y1="95" x2="540" y2="95" stroke="#e8ece4" strokeDasharray="4 6" /><line x1="20" y1="40" x2="540" y2="40" stroke="#e8ece4" strokeDasharray="4 6" />{(() => { const values = data.map((item) => item.grams); const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1; const points = data.map((item, index) => `${20 + index / (data.length - 1) * 520},${145 - (item.grams - min) / range * 105}`).join(' '); return <><polyline points={points} fill="none" stroke="#3d7a58" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.split(' ').map((point, index) => { const [cx, cy] = point.split(','); return <circle key={data[index].id} cx={cx} cy={cy} r="4" fill="#f8f8f3" stroke="#3d7a58" strokeWidth="2" /> })}</> })()}</svg><div className="chart-dates"><span>{new Date(data[0].measured_at).toLocaleDateString()}</span><span>{new Date(data.at(-1)!.measured_at).toLocaleDateString()}</span></div></div>
}

function EmptyBird() { return <div className="empty-aviary page-empty"><div className="empty-bird"><Bird size={34} /></div><div><h2>No parrot selected</h2><p>Create a profile from the overview, then return to this page.</p></div><Link className="button button-primary" to="/"><Plus size={16} /> Go to overview</Link></div> }

export default App