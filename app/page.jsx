import IndiaMap from '../components/IndiaMap';
import ThemeButton from '../components/ThemeButton';

export default function Page() {
  return (
    <>
      <header className="wrap site-head">
        <div className="head-row">
          <h1>India — Population by State &amp; District</h1>
          <ThemeButton />
        </div>
        <p className="sub">
          Interactive choropleth &middot; Source: <strong>Census 2011</strong> &middot; Hover a
          state, click to zoom into its districts
        </p>
        <div id="stats" className="stats" aria-live="polite">
          <span className="chip">
            <strong id="stat-pop">…</strong> people counted
          </span>
          <span className="chip">
            <strong id="stat-states">…</strong> states/UTs
          </span>
          <span className="chip">
            <strong id="stat-districts">…</strong> districts
          </span>
        </div>
      </header>

      <main className="wrap layout">
        <IndiaMap />
      </main>

      <footer className="wrap foot">
        <span>
          Next.js + React + vendored <code>d3</code> (no CDN). No API calls. Boundaries: DataMeet
          maps (CC BY 4.0).
        </span>
      </footer>
    </>
  );
}
