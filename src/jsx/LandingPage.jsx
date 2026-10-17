import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../css/LandingPage.css';

const faqs = [
  {
    question: 'How do you protect my personal data?',
    answer: 'Your data is securely stored in encrypted digital databases and locked physical files. Only authorized school administrators and registrar staff have access to your information.',
  },
  {
    question: 'How do I sign in?',
    answer: 'Choose Log in and use the email and password assigned to your school account. If you do not have an account, contact your school administrator.',
  },
  {
    question: 'What should I do if I forgot my password?',
    answer: 'Click Forgot password on the sign-in page, enter your account email, and follow the reset link sent to your inbox.',
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

function DrivingScene() {
  return (
    <svg className="landing-scene" viewBox="0 0 620 650" role="img" aria-labelledby="scene-title">
      <title id="scene-title">A car driving past a school</title>
      <rect width="620" height="650" fill="#ffdda1" />
      <circle cx="72" cy="112" r="52" fill="#fff0c9" opacity=".65" />
      <circle cx="557" cy="158" r="88" fill="#cbb6f2" opacity=".72" />
      <path d="M0 185c26-40 52-40 78 0 26-41 54-41 81 0" fill="#f4c879" opacity=".56" />
      <path d="M0 316h620v220H0z" fill="#f5e4bd" />
      <path d="m45 310 108-61h314l108 61v20H45z" fill="#684c45" />
      <path d="M64 326h492v182H64z" fill="#f4d6a2" />
      <path d="m242 251 68-68 68 68z" fill="#77554a" />
      <path d="M252 248h116v260H252z" fill="#f0d19c" />
      <circle cx="310" cy="232" r="19" fill="#987759" />
      <path d="M310 219v14l10 5" fill="none" stroke="#fff4d4" strokeWidth="3" strokeLinecap="round" />
      <g fill="#8dbbd1" stroke="#729bb0" strokeWidth="3">
        <path d="M92 356h47v48H92zM156 356h47v48h-47zM92 423h47v48H92zM156 423h47v48h-47z" />
        <path d="M417 356h47v48h-47zM481 356h47v48h-47zM417 423h47v48h-47zM481 423h47v48h-47z" />
        <path d="M279 285h62v52h-62zM279 356h62v52h-62z" />
      </g>
      <path d="M278 452h64v56h-64z" fill="#405c6c" />
      <path d="M0 514c112-34 196-20 277 8s205 32 343-10v138H0z" fill="#708c69" />
      <path d="M0 572c130-44 219-31 318 0s191 29 302-8v86H0z" fill="#777775" />
      <path d="M0 621c150-41 265-32 368-3" fill="none" stroke="#f6e3ad" strokeWidth="5" strokeDasharray="24 22" />
      <g transform="translate(48 405)">
        <path d="M0 91c12-44 31-76 64-83 21-5 33 35 49 57l-4 48H0z" fill="#2e6655" />
        <path d="M0 108h116v96H0z" fill="#28634f" />
        <path d="M0 130h116M0 160h116" stroke="#e9c88b" strokeWidth="5" opacity=".6" />
      </g>
      <g transform="translate(193 438)">
        <ellipse cx="206" cy="139" rx="199" ry="20" fill="#292a2b" opacity=".26" />
        <path d="m18 92 38-48 94-39c40-17 150-20 191 4l64 38 42 20 10 55-27 24H33L7 124z" fill="#c9372f" stroke="#742821" strokeWidth="5" strokeLinejoin="round" />
        <path d="m105 45 55-28c37-15 117-17 150 2l36 31-241 11z" fill="#344750" stroke="#742821" strokeWidth="5" strokeLinejoin="round" />
        <path d="m185 23-21 39 114 1 27-40c-33-14-84-14-120 0z" fill="#9ac7d4" />
        <path d="m313 24-25 39 104-4-47-29c-9-4-20-6-32-6z" fill="#9ac7d4" />
        <path d="M16 92 0 108l7 13 29-7" fill="#fff2ce" stroke="#742821" strokeWidth="4" />
        <path d="m412 68 34 10 6 15-34-3" fill="#f7e3ad" stroke="#742821" strokeWidth="4" />
        <path d="m66 100 96 20 162 4 100-30" fill="none" stroke="#8d2c27" strokeWidth="4" opacity=".7" />
        <g fill="#222">
          <circle cx="104" cy="133" r="31" />
          <circle cx="364" cy="133" r="31" />
        </g>
        <g fill="#b9c6c9" stroke="#444" strokeWidth="5">
          <circle cx="104" cy="133" r="16" />
          <circle cx="364" cy="133" r="16" />
        </g>
        <g fill="#52636a">
          <circle cx="104" cy="133" r="5" />
          <circle cx="364" cy="133" r="5" />
        </g>
      </g>
    </svg>
  );
}

export default function LandingPage() {
  const location = useLocation();
  const gameApkUrl = `${import.meta.env.BASE_URL}downloads/drive-the-right-way.apk`;
  const [gameApkAvailable, setGameApkAvailable] = useState(null);
  const [gameApkCheckError, setGameApkCheckError] = useState('');

  useEffect(() => {
    if (location.hash === '#faq') {
      document.getElementById('faq')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [location.hash]);

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
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-copy">
          <header className="landing-header">
            <Link className="landing-brand" to="/" aria-label="Riteway Driving School home">
              <img src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
              <span>Riteway<br />Driving School</span>
            </Link>
            <nav aria-label="Main navigation">
              <a href="#faq">FAQ</a>
              <Link className="landing-nav-login" to="/login">Log in</Link>
            </nav>
          </header>

          <div className="landing-intro">
            <p className="landing-eyebrow">LEARN WITH CONFIDENCE</p>
            <h1 id="landing-title">Drive the<br /><span>right way.</span></h1>
            <p className="landing-description">
              Your journey to safer driving starts here. Learn, practice, and keep track of your progress with Riteway.
            </p>
            <div className="landing-actions">
              <Link className="landing-button landing-button-primary" to="/login">Log in to your portal</Link>
              {gameApkAvailable
                ? <a className="landing-button landing-button-secondary" href={gameApkUrl} download>Download the game</a>
                : (
                  <button className="landing-button landing-button-secondary" type="button" disabled>
                    {gameApkAvailable === null ? 'Checking game download...' : 'Game APK coming soon'}
                  </button>
                )}
            </div>
            <p className="landing-download-note">
              {gameApkCheckError || (gameApkAvailable
                ? 'Android game APK is ready to download.'
                : 'The Android game download will be posted here soon.')}
            </p>
          </div>
          <p className="landing-footer">Riteway Driving School <span>·</span> Drive the right way</p>
        </div>

        <div className="landing-art" aria-hidden="true">
          <div className="landing-art-title">Drive the<br /><span>Right Way</span></div>
          <DrivingScene />
          <img className="landing-art-logo" src={`${import.meta.env.BASE_URL}riteway-logo.png`} alt="" />
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
    </main>
  );
}
