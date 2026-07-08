export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-art" aria-hidden="true">
          <span className="moon" />
          <span className="tree tree-left" />
          <span className="tree tree-center" />
          <span className="tree tree-right" />
        </div>

        <div className="hero-content">
          <p className="eyebrow">Enchanted forest wedding</p>
          <h1>Lilla & Norbi</h1>
          <p className="wedding-date">2027. június 5.</p>
          <p>
            Szeretettel várunk az esküvői weboldalunkon. A részletek hamarosan
            érkeznek.
          </p>
        </div>
      </section>

      <section id="important-info" className="content-section">
        <p className="eyebrow">Vendéginformációk</p>
        <h2>Fontos információk</h2>
        <p>
          Itt fogjuk összegyűjteni a helyszínnel, időpontokkal, parkolással és
          egyéb praktikus tudnivalókkal kapcsolatos részleteket.
        </p>
      </section>

      <section id="dress-code" className="content-section">
        <p className="eyebrow">Hangulat</p>
        <h2>Dress code</h2>
        <p>
          Az esküvő témája enchanted forest: természetes zöldek, meleg barnák,
          bézs árnyalatok és visszafogott arany részletek illenek majd a
          hangulathoz.
        </p>
      </section>
    </main>
  )
}
