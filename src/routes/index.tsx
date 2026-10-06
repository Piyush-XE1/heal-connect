import { createFileRoute } from '@tanstack/react-router';
import { ArrowUpRight, ArrowRight, Heart, HeartHandshake, Droplet, ShieldCheck, LockKeyhole, Stethoscope, Check, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import careImage from '@/assets/livora-care.jpg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'livora — A little of you. A lifetime for someone.' },
    { name: 'description', content: 'Give hope or find support with livora, a human-centered concept for blood and organ donation awareness and medical donation assistance.' },
    { property: 'og:title', content: 'livora — A little of you. A lifetime for someone.' },
    { property: 'og:description', content: 'Two paths. One purpose. Discover a more human approach to medical donation and assistance.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

function Brand() {
  return <a className="brand" href="#" aria-label="livora home"><svg className="brand-mark" viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M18 30C13.5 26.5 4 20.5 4 12.5a8 8 0 0 1 14-5 8 8 0 0 1 14 5C32 20.5 22.5 26.5 18 30Z" stroke="currentColor" strokeWidth="2.1"/><path d="M8 17h6l3-6 4 12 3-6h5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/></svg><span>livora<span className="text-primary">.</span></span></a>;
}

function DonationActions({ closing = false }: { closing?: boolean }) {
  return <div className={closing ? 'closing-actions' : 'hero-actions'}>
    <Button variant="donor" type="button">Become a Donor <ArrowUpRight aria-hidden="true" /></Button>
    <Button variant="recipient" type="button">Request Help <ArrowUpRight aria-hidden="true" /></Button>
  </div>;
}

function Index() {
  return <div className="site-shell">
    <header className="site-header"><div className="container header-inner">
      <Brand />
      <nav className="main-nav" aria-label="Main navigation"><a href="#our-purpose">Our purpose</a><a href="#two-paths">How it works</a><a href="#safety">Trust & safety</a></nav>
      <Button variant="navigation" className="header-action" asChild><a href="#two-paths">Be part of something good <ArrowUpRight aria-hidden="true" /></a></Button>
    </div></header>

    <main>
      <section className="hero" id="our-purpose" aria-labelledby="hero-title">
        <img className="hero-photo" src={careImage} alt="A doctor offering compassionate support to a patient in a bright, welcoming clinic" width={1920} height={1024} fetchPriority="high" />
        <div className="container hero-inner"><div className="hero-copy">
          <div className="eyebrow hero-eyebrow reveal"><Heart size={12} aria-hidden="true" /> Small acts. Life-changing possibilities.</div>
          <h1 id="hero-title" className="reveal">A little of you.<br /><span>A lifetime</span><br />for someone.</h1>
          <p className="hero-description reveal reveal-delay">Meet livora. A place where the willingness to give meets the need for care. Bringing donors and recipients closer, with humanity at heart.</p>
          <div className="reveal reveal-delay"><DonationActions /><p className="hero-note"><ShieldCheck size={14} aria-hidden="true" /> Built around care, consent, and compassion.</p></div>
        </div></div>
        <div className="photo-label"><HeartHandshake size={21} strokeWidth={1.6} aria-hidden="true" /><span>Behind every donation, there’s a person.</span></div>
      </section>

      <section className="values-strip" aria-label="Our values"><div className="container values-inner">
        <p className="values-intro">Human connection. Meaningful care.</p>
        <div className="value-item"><Droplet aria-hidden="true" /> Blood & organ donation awareness</div>
        <div className="value-item"><HeartHandshake aria-hidden="true" /> Support when it matters</div>
        <div className="value-item"><ShieldCheck aria-hidden="true" /> Safety at every step</div>
      </div></section>

      <section className="roles-section" id="two-paths" aria-labelledby="roles-title"><div className="container">
        <div className="section-heading"><div><p className="eyebrow">Different journeys. Shared humanity.</p><h2 id="roles-title">Two paths. One purpose.</h2></div><p>Whether you’re ready to give or looking for help, you deserve a place to begin.</p></div>
        <div className="role-grid">
          <article className="role-card"><div className="role-top"><div className="role-icon"><Droplet strokeWidth={1.7} aria-hidden="true" /></div><span className="role-label">FOR DONORS</span></div><h3>Your kindness.<br />Someone’s second chance.</h3><p>Be a source of hope through blood donation or learning about organ donation. A decision to give can mean more than you imagine.</p><div className="role-tags"><span><Check aria-hidden="true" /> Blood donation</span><span><Check aria-hidden="true" /> Organ donation awareness</span></div><div className="role-bottom"><span>A little generosity goes a long way</span><ArrowUpRight size={18} aria-hidden="true" /></div></article>
          <article className="role-card recipient"><div className="role-top"><div className="role-icon"><HeartHandshake strokeWidth={1.7} aria-hidden="true" /></div><span className="role-label">FOR RECIPIENTS</span></div><h3>You don’t have to<br />navigate this alone.</h3><p>When you or someone you love needs medical donation assistance, finding support shouldn’t feel out of reach. Your journey matters.</p><div className="role-tags"><span><Check aria-hidden="true" /> Medical donation assistance</span><span><Check aria-hidden="true" /> Compassionate support</span></div><div className="role-bottom"><span>Hope starts with a connection</span><ArrowUpRight size={18} aria-hidden="true" /></div></article>
        </div>
      </div></section>

      <section className="safety-section" id="safety" aria-labelledby="safety-title"><div className="container safety-layout">
        <div className="safety-intro"><p className="eyebrow">Care comes first. Always.</p><h2 id="safety-title">Trust isn’t an extra.<br />It’s the foundation.</h2><p>Medical donation is deeply personal. Our vision for livora puts dignity, informed choice, and responsible care at the center.</p><div className="safety-seal"><ShieldCheck size={19} aria-hidden="true" /> People first. Without exception.</div></div>
        <div className="safety-list">
          <article className="safety-item"><LockKeyhole strokeWidth={1.6} aria-hidden="true" /><div><h3>Privacy by principle</h3><p>Personal health information deserves respect. Privacy and consent are essential to the experience we’re building.</p></div></article>
          <article className="safety-item"><Stethoscope strokeWidth={1.6} aria-hidden="true" /><div><h3>Medical care stays with the experts</h3><p>Eligibility, screening, and organ allocation belong to licensed medical professionals and authorized donation systems.</p></div></article>
          <article className="safety-item"><Heart strokeWidth={1.6} aria-hidden="true" /><div><h3>Donation, never a transaction</h3><p>A gift of life should never become a marketplace. Our vision is rooted in voluntary donation, compassion, and ethical care.</p></div></article>
        </div>
      </div></section>

      <section className="closing-section" aria-labelledby="closing-title"><Sprout className="closing-symbol" size={30} strokeWidth={1.5} aria-hidden="true" /><h2 id="closing-title">A more human way forward.</h2><p>Because giving hope—and finding it—starts with people.</p><DonationActions closing /></section>
    </main>

    <footer className="site-footer"><div className="container"><div className="footer-top"><Brand /><p>A little connection. A lot of possibility.</p></div><div className="footer-bottom"><p className="footer-disclaimer">livora is a platform concept, not a medical provider or emergency service. Donation and assistance services are not yet available. For urgent medical needs, contact your local emergency services.</p><p className="copyright">© 2026 livora. Made with care.</p></div></div></footer>
  </div>;
}
