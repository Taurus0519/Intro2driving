import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/LandingPage.css';

const schoolMapCoordinates = '14.6597533,120.9797944';
const schoolMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(schoolMapCoordinates)}`;
const schoolMapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(schoolMapCoordinates)}&z=17&output=embed`;

const faqs = [
  {
    question: 'How do I sign in?',
    answer: 'Choose Log in and use the email and password assigned to your school account. If you do not have an account, contact your school administrator.',
  },
  {
    question: 'What should I do if I forgot my password?',
    answer: 'Click Forgot password on the sign-in page, enter your account email, and follow the reset link sent to your email.',
  },
  {
    question: 'Are you LTO-accredited?',
    answer: 'Yes. Accredited driving schools are certified by the Land Transportation Office (LTO). You can verify a school’s accreditation on the LTO official website.',
  },
  {
    question: 'What are the achievement badges on my profile dashboard?',
    answer: 'These badges represent achievements collected in the driving game. Badges are earned in the game and appear there for students and instructors to see.',
  },
];

export default function LandingPage() {
  const location = useLocation();
  const gameApkUrl = 'https://media.githubusercontent.com/media/Taurus0519/intro2driving-system/c394fb1ae271bdbffc58b509b900e1c261b8886b/public/downloads/intro2driving.apk';
  const [gameApkAvailable, setGameApkAvailable] = useState(null);
  const [gameApkCheckError, setGameApkCheckError] = useState('');
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const openMenu = () => {
    menuRef.current.showModal();
    setMenuOpen(true);
  };

  const closeMenu = () => {
    menuRef.current.close();
    setMenuOpen(false);
  };

  const handleMenuBackdropClick = (event) => {
    if (event.target !== event.currentTarget) return;
    const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect();
    if (event.clientX < left || event.clientX > right || event.clientY < top || event.clientY > bottom) {
      closeMenu();
    }
  };

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  useEffect(() => {
    const sectionId = location.hash.slice(1);
    if (['about', 'faq', 'download', 'contact'].includes(sectionId)) {
      const frame = window.requestAnimationFrame(() => {
        const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        document.getElementById(sectionId)?.scrollIntoView({ behavior, block: 'start' });
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [location.hash, location.key]);

  useEffect(() => {
    let active = true;
    fetch(gameApkUrl, { method: 'HEAD' })
      .then((response) => {
        const contentType = response.headers.get('content-type') || '';
        if (active) setGameApkAvailable(response.ok && !contentType.includes('text/html'));
      })
      .catch(() => {
        if (active) {
          setGameApkCheckError('The game download could not be checked. Please try again later.');
          setGameApkAvailable(false);
        }
      });
    return () => { active = false; };
  }, [gameApkUrl]);

  return (
    <main className="public-landing">
      <dialog
        ref={menuRef}
        className="landing-menu"
        id="landing-navigation"
        aria-label="Main menu"
        onClose={() => setMenuOpen(false)}
        onClick={handleMenuBackdropClick}
      >
        <div className="landing-menu-header">
          <div className="landing-brand">
            <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
            <span>Riteway<br />Driving School</span>
          </div>
          <button className="landing-menu-close" type="button" onClick={closeMenu} aria-label="Close menu">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="m6 6 12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <nav className="landing-menu-links" aria-label="Main navigation">
          <Link to="#about" onClick={closeMenu}>
            <span className="landing-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5m0-8h.01" />
              </svg>
            </span>
            About
          </Link>
          <Link to="#faq" onClick={closeMenu}>
            <span className="landing-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <circle cx="12" cy="12" r="9" />
                <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4m0 3h.01" />
              </svg>
            </span>
            FAQ
          </Link>
          <Link to="#contact" onClick={closeMenu}>
            <span className="landing-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-1 1v-9.5a9 9 0 0 1 18 0ZM8 9h8m-8 5h5" />
              </svg>
            </span>
            Contact
          </Link>
          <Link to="#download" onClick={closeMenu}>
            <span className="landing-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5" />
              </svg>
            </span>
            Download
          </Link>
          <Link className="landing-menu-login" to="/login" onClick={closeMenu}>
            <span className="landing-menu-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M14 3h6v18h-6M3 12h12m-4-4 4 4-4 4" />
              </svg>
            </span>
            Log in
          </Link>
        </nav>
      </dialog>
      <section className="landing-hero" id="landing-top" aria-labelledby="landing-title">
        <div className="landing-copy">
          <header className="landing-header">
            <button
              className="landing-menu-toggle"
              type="button"
              aria-label="Open menu"
              aria-controls="landing-navigation"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={openMenu}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="landing-brand">
              <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
              <span>Riteway<br />Driving School</span>
            </div>
          </header>

          <div className="landing-intro">
            <p className="landing-eyebrow">LEARN WITH CONFIDENCE</p>
            <h1 id="landing-title">Drive the<br /><span>right way.</span></h1>
            <p className="landing-description">
              Your journey to safer driving starts here. Learn, practice, and keep track of your progress with Riteway.
            </p>
            <div className="landing-actions">
              <Link className="landing-button landing-button-primary" to="/login">Log in to your portal</Link>
              <a className="landing-button landing-button-secondary" href="#download">Download the game</a>
            </div>
            <p className="landing-download-note">
              {gameApkCheckError || (gameApkAvailable
                ? 'Intro2driving is ready to download for Android.'
                : 'Intro2driving for Android is coming soon.')}
            </p>
          </div>
        </div>

        <div className="landing-art">
          <img
            className="landing-scene"
            src={`${import.meta.env.BASE_URL}landing-driving-school.png`}
            alt="Drive the Right Way: a red car in front of Riteway Driving School"
            width="1312"
            height="1873"
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      <section className="landing-about" id="about" aria-labelledby="about-title">
        <div className="landing-about-heading">
          <p className="landing-eyebrow">ABOUT THE GAME</p>
          <h2 id="about-title">Intro2driving</h2>
          <p>
            Intro2driving is a fully immersive 3D simulation built entirely using the Unity Engine.
            The game is designed to help players experience realistic road conditions while strictly
            adhering to official Land Transportation Office (LTO) laws, rules, and regulations.
          </p>
        </div>
        <div className="landing-about-details">
          <article>
            <h3>LTO &amp; Manual Integration</h3>
            <p>
              Every scenario in the game serves as an interactive reference to Philippine traffic
              laws, right-of-way rules, and road safety standards. To provide an authentic testing
              experience, players must navigate these LTO regulations using manual driving mechanics,
              requiring proper clutch control and gear management to successfully pass road assessments.
            </p>
          </article>
          <article className="landing-about-disclaimer">
            <h3>Legal Disclaimer</h3>
            <p>
              This game serves as an educational supplement. While it accurately references LTO
              guidelines and manual vehicle operations, it does not replace official LTO theoretical
              courses or practical examinations.
            </p>
            <p className="landing-about-copyright">
              © 2026. Powered by Unity. All official LTO regulations, traffic symbols, and statutory
              codes remain the property of their respective government bodies.
            </p>
          </article>
        </div>
      </section>

      <section className="landing-faq" id="faq" aria-labelledby="faq-title">
        <div className="landing-faq-heading">
          <p className="landing-eyebrow">NEED A HAND?</p>
          <h2 id="faq-title">Frequently asked questions</h2>
          <p>Quick answers to help you get started.</p>
        </div>
        <div className="landing-faq-list">
          {faqs.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
        <Link className="landing-faq-login" to="/login">Ready to get started? Log in</Link>
      </section>

      <div className="landing-school-sections">
        <section className="landing-download" id="download" aria-labelledby="download-title">
          <div className="landing-game-panel">
            <div className="landing-download-copy">
              <div className="landing-game-brand">
                <img
                  src={`${import.meta.env.BASE_URL}intro2driving-logo.png`}
                  alt="Intro2driving game artwork"
                  width="64"
                  height="64"
                />
                <div>
                  <p>Intro2driving</p>
                  <span>BY RITEWAY DRIVING SCHOOL</span>
                </div>
              </div>
              <h2 id="download-title">A new way to<br /><span>learn the road.</span></h2>
              <p className="landing-game-description">
                A little play. A little practice. Get ready for the road with Intro2driving,
                the Android driving game from Riteway.
              </p>
              <div className="landing-game-platform"><span aria-hidden="true">↓</span> ANDROID GAME <span aria-hidden="true">/</span> APK DOWNLOAD</div>
              {gameApkAvailable
                ? <a className="landing-apk-button" href={gameApkUrl} download="Intro2driving.apk"><span aria-hidden="true">↓</span> Download for Android</a>
                : (
                  <button className="landing-apk-button" type="button" disabled aria-describedby="landing-apk-status">
                    <span aria-hidden="true">↓</span>
                    {gameApkAvailable === null ? 'Checking availability…' : 'Coming soon for Android'}
                  </button>
                )}
              <p className="landing-apk-status" id="landing-apk-status" role="status">
                {gameApkCheckError || (gameApkAvailable === null
                  ? 'Checking the Intro2driving download…'
                  : gameApkAvailable
                    ? 'Your next drive is ready. Download the APK to get started.'
                    : 'Our next stop: Android. The APK will be available here soon.')}
              </p>
            </div>

          </div>

          <div className="landing-install-heading">
            <h3>From download to your first drive.</h3>
            <p>Your quick start, once the game arrives.</p>
          </div>
          <ol className="landing-download-steps">
            <li>
              <span className="landing-step-number" aria-hidden="true">01</span>
              <div><h4>Get the game</h4><p>Download the Intro2driving APK to your Android phone when it becomes available.</p></div>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">02</span>
              <div><h4>Make it yours</h4><p>Open the file to install. If prompted, allow your browser to install the game.</p></div>
            </li>
            <li>
              <span className="landing-step-number" aria-hidden="true">03</span>
              <div><h4>Take the wheel</h4><p>Launch Intro2driving and start your driving practice.</p></div>
            </li>
          </ol>
        </section>

        <section className="landing-contact" id="contact" aria-labelledby="contact-title">
          <div className="landing-contact-heading">
            <p className="landing-eyebrow">LET’S GET YOU ON THE ROAD</p>
            <h2 id="contact-title">Contact the school</h2>
            <p className="landing-section-description">
              Visit our Caloocan branch to learn more. Already a student?{' '}
              <Link to="/login">Log in to your portal</Link> to send the school a message.
            </p>
          </div>
          <dl className="landing-contact-details">
            <div>
              <dt>School</dt>
              <dd>Riteway Driving School - Caloocan, Metro Manila</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                <address>
                  <a href={schoolMapUrl} target="_blank" rel="noopener noreferrer">
                    Unit D #64 JP Bautista Street, Barangay 79, Caloocan, Philippines, 1400
                    <span className="landing-map-link">Open in Google Maps<span className="landing-sr-only"> (opens in a new tab)</span></span>
                  </a>
                </address>
              </dd>
            </div>
          </dl>
          <iframe
            className="landing-contact-map"
            title="Riteway Driving School location in Caloocan, Metro Manila"
            src={schoolMapEmbedUrl}
            width="1064"
            height="400"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </section>

        <footer className="landing-site-footer">
          <div>
            <p>© 2026 Intro2driving, made for Riteway Driving School - Caloocan, Metro Manila.</p>
            <a href="#landing-top">Back to top <span aria-hidden="true">↑</span></a>
          </div>
        </footer>
      </div>
    </main>
  );
}
