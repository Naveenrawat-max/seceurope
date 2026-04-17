export default function Home() {
  return (
    <div className="hub-body">
      <div className="hub-wrap">
        <header className="hub-brand">
          <div className="row">
            <div className="mark">Se</div>
            <div>
              <div className="wordmark">Seceurope</div>
              <div className="subline">RFID access & perimeter suite</div>
            </div>
          </div>
          <div className="meta">
            <span className="device-hint">
              <span className="dot live" /> DB + realtime sync
            </span>
            <span className="device-hint">Web build - 2026.04</span>
          </div>
        </header>

        <section className="hub-hero">
          <div>
            <h1>
              Every car, badge, and approach. <em>Seen before it reaches the gate.</em>
            </h1>
            <p>
              ABIOT writes raw RFID rows to Supabase. This website converts those rows to canonical JSON access events, then keeps manager and
              guard tablet views synchronized over realtime channels.
            </p>
          </div>
          <aside className="hero-side">
            <div className="eyebrow">Live architecture</div>
            <ul>
              <li>
                <span className="num">1</span>
                ABIOT scanner writes column-based raw rows
              </li>
              <li>
                <span className="num">2</span>
                Next.js converter normalizes row payloads to JSON events
              </li>
              <li>
                <span className="num">3</span>
                Manager and tablet surfaces fetch `/api/events`
              </li>
              <li>
                <span className="num">4</span>
                Guard decisions persist to `event_resolutions`
              </li>
            </ul>
          </aside>
        </section>

        <section className="hub-apps" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <a href="/manager" className="app-tile">
            <div>
              <div className="eyebrow">Desktop - Control room</div>
              <h3>Manager Portal</h3>
              <p>Live feed, exception queue, gate map, reader health, and decision timeline from normalized access events.</p>
            </div>
            <div className="row-between">
              <span className="device-hint">Manager web</span>
              <span className="open-cta">Open portal</span>
            </div>
          </a>

          <a href="/tablet" className="app-tile">
            <div>
              <div className="eyebrow">Tablet - Guard kiosk</div>
              <h3>Tablet Guard</h3>
              <p>Review unknown vehicles, issue passes, deny entry, and trigger manual scans while syncing in near realtime.</p>
            </div>
            <div className="row-between">
              <span className="device-hint">Guard web</span>
              <span className="open-cta">Open tablet</span>
            </div>
          </a>
        </section>
      </div>
    </div>
  );
}

