import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Landing() {
  const nav = useNavigate();
  const [monthlyApplicants, setMonthlyApplicants] = useState(5000);

  const spamBlocked = Math.round(monthlyApplicants * 0.35); 
  const hoursSaved = Math.round(spamBlocked * 0.15); 

  return (
    <div className="landing-page" style={styles.pageContainer}>
      <nav style={styles.nav}>
        <div style={styles.navLogo}>
          <div style={styles.logoIcon}>
            <span style={styles.logoRingMid}></span>
            <span style={styles.logoRingInner}></span>
          </div>
          <span style={styles.logoText}>Impulse</span>
        </div>
      </nav>

      <main style={styles.main}>
        {/* HERO SECTION */}
        <section style={styles.heroSection}>
          <h1 style={styles.heroTitle}>
            Integrity-First Hiring<br />for the Modern Enterprise
          </h1>
          <p style={styles.heroSubtitle}>
            Impulse secures your hiring pipeline by verifying human authenticity at the source. Build teams grounded in verified identity and cryptographic trust.
          </p>

          <button
            type="button"
            onClick={() => nav('/signup')}
            className="btn btn-warm btn-lg"
          >
            Get Started
          </button>

          <div style={styles.heroImageContainer}>
            <img src="/images/office.png" alt="Office Background" style={styles.heroImage} />
            <div style={styles.trustRatioPill}>
              <div style={styles.trustRatioIcon}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              </div>
              <div style={styles.trustRatioTextContent}>
                <span style={styles.trustRatioLabel}>TRUST RATIO</span>
                <span style={styles.trustRatioValue}>100% Verified Humans</span>
              </div>
            </div>
          </div>
        </section>

        {/* ROI CALCULATOR */}
        <section style={styles.bentoSection}>
          <div style={styles.bentoGrid}>
            
            {/* ROI Calculator Card */}
            <div style={{...styles.bentoCard, ...styles.bentoRoiCard}}>
              <h2 style={styles.bentoRoiTitle}>Quantify your wasted effort.</h2>
              <p style={styles.bentoRoiSubtitle}>See how much time you save when every application is tied to a verified human.</p>
              
              <div style={styles.bentoCalcTop}>
                <label style={styles.calcLabel}>Monthly Applications</label>
                <div style={styles.calcValueHero}>{monthlyApplicants.toLocaleString()}</div>
                <input 
                  type="range" 
                  min="500" 
                  max="50000" 
                  step="500"
                  value={monthlyApplicants}
                  onChange={(e) => setMonthlyApplicants(Number(e.target.value))}
                  className="wealth-slider"
                  style={{ marginTop: '16px' }}
                />
              </div>

              <div style={styles.bentoCalcBottom}>
                <div style={styles.calcResultBlock}>
                  <div style={styles.calcResultLabel}>AI/Bot Spam Filtered</div>
                  <div style={styles.calcResultValue}>{spamBlocked.toLocaleString()}</div>
                </div>
                <div style={styles.calcResultBlock}>
                  <div style={styles.calcResultLabel}>Recruiter Hours Saved</div>
                  <div style={{...styles.calcResultValue, color: 'var(--accent)'}}>{hoursSaved.toLocaleString()} hrs</div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 2: STANDARDS */}
        <section style={styles.standardsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={{...styles.sectionTitle, fontFamily: 'Playfair Display, serif'}}>The Verification Standard</h2>
            <p style={styles.sectionSubtitle}>Defining honesty in the digital hiring landscape.</p>
          </div>

          <div style={styles.cardsGrid}>
            <div style={styles.lightCard}>
              <div style={styles.fingerprintWatermark}>
                <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z"></path>
                  <path d="M5.5 9.5c1.5-2 4-3.5 6.5-3.5s5 1.5 6.5 3.5"></path>
                  <path d="M7 13c1-2.5 3.5-4 5-4s4 1.5 5 4"></path>
                  <path d="M9 16.5c1-1.5 2-2.5 3-2.5s2 1 3 2.5"></path>
                  <path d="M12 22v-3"></path>
                </svg>
              </div>
              <div style={styles.cardTop}>
                <div style={styles.iconCircleLight}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-h)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div style={styles.verifiedPill}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                  <span>VERIFIED WORLD ID</span>
                </div>
              </div>
              <h3 style={styles.cardTitle}>Account Uniqueness</h3>
              <p style={styles.cardBody}>One person, one account. By tying applications to a secure biometric protocol, we ensure total honesty and consistency. Candidates cannot create multiple profiles, guaranteeing that the professional history you see is the only one that exists.</p>
              <div style={styles.cardFooterLight}>SECURE TALENT ACQUISITION GUARANTEED</div>
            </div>

            <div style={styles.darkCard}>
              <div style={styles.iconCircleDark}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"></path><path d="M12 20V4"></path><path d="M6 20v-6"></path></svg>
              </div>
              <h3 style={{...styles.cardTitle, color: 'white'}}>Dynamic Reliability Score</h3>
              <p style={{...styles.cardBody, color: 'rgba(255,255,255,0.72)'}}>Every candidate carries a unified Reliability Score based on their verification status and historical consistency, allowing your team to focus only on high-signal prospects.</p>
              <div style={styles.cardFooterDark}>ELIMINATE APPLICATION NOISE</div>
            </div>
            
            <div style={styles.wideCard}>
              <div style={styles.wideCardLeft}>
                <div style={styles.reliabilityCircle}>
                  <span style={styles.reliabilityValue}>90+</span>
                  <span style={styles.reliabilityLabel}>RELIABILITY</span>
                </div>
              </div>
              <div style={styles.wideCardRight}>
                <h3 style={styles.cardTitle}>Verified Credentials Only</h3>
                <p style={styles.cardBody}>Our system validates the person behind the screen before a single line of a resume is read. By ensuring human uniqueness, we restore the value of individual achievement in an AI-saturated market.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* SECTION 3: DARK SPLIT SECTION */}
      <section style={styles.darkSplitSection}>
        <div style={styles.darkSplitContent}>
          <div style={styles.darkSplitLeft}>
            <h2 style={styles.darkSplitTitle}>Enterprise-grade.<br />Developer-friendly.</h2>
            <p style={styles.darkSplitBody}>Impulse is designed to fit seamlessly into any modern corporate infrastructure. We prioritize data sovereignty, ensuring candidate privacy is mathematically guaranteed without adding unnecessary friction to your recruitment flow.</p>
            <ul style={styles.checkList}>
              <li style={styles.checkListItem}>
                <div style={styles.checkIconLightWrapper}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                Plug-and-play ATS extensions
              </li>
              <li style={styles.checkListItem}>
                <div style={styles.checkIconLightWrapper}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                Zero internal biometric storage
              </li>
              <li style={styles.checkListItem}>
                <div style={styles.checkIconLightWrapper}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                GDPR & SOC2 Compliant pathways
              </li>
            </ul>
          </div>
          <div style={styles.darkSplitRight}>
            <img src="/images/office.jpg" alt="Office Space" style={styles.meetingImage} />
          </div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section style={styles.bottomCtaSection}>
        <div style={styles.ctaCard}>
          <h2 style={{...styles.ctaTitle, fontFamily: 'Playfair Display, serif'}}>Restore Trust to Your Hiring Process</h2>
          <p style={styles.ctaSubtitle}>Join the growing network of companies prioritizing human authenticity with World ID.</p>
          <button
            type="button"
            onClick={() => nav('/signup')}
            className="btn btn-warm btn-lg"
            style={{ marginTop: 24 }}
          >
            Get Started with World ID
          </button>
          <div style={styles.ctaFooterText}>VERIFIED IDENTITY REQUIRED FOR ENTERPRISE ACCESS.</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={styles.footer}>
        <div style={styles.footerBrand}>Impulse</div>
        <div style={styles.footerLinks}>
          <span style={styles.footerLink}>Documentation</span>
          <span style={styles.footerLink}>Privacy Policy</span>
          <span style={styles.footerLink}>System Status</span>
        </div>
        <div style={styles.footerCopyright}>© 2026 Impulse.</div>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageContainer: {
    width: '100vw',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'Inter, system-ui, sans-serif',
    backgroundColor: 'var(--bg)',
    margin: 0,
    padding: 0,
    overflowX: 'hidden'
  },
  nav: {
    width: '100%',
    padding: '24px 48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxSizing: 'border-box'
  },
  navLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    width: '24px',
    height: '24px',
    border: '2px solid var(--text-h)',
    borderRadius: '50%',
    position: 'relative',
    boxSizing: 'border-box',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoRingMid: {
    width: '14px',
    height: '14px',
    border: '2px solid var(--text-h)',
    borderRadius: '50%',
    position: 'absolute',
    boxSizing: 'border-box'
  },
  logoRingInner: {
    width: '6px',
    height: '6px',
    border: '2px solid var(--text-h)',
    borderRadius: '50%',
    position: 'absolute',
    boxSizing: 'border-box'
  },
  logoText: {
    fontWeight: 600,
    fontSize: '20px',
    letterSpacing: '-0.5px'
  },
  navLiveCounter: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: 'var(--accent-bg)',
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid var(--border)'
  },
  pulseLight: {
    width: '8px',
    height: '8px',
    backgroundColor: 'var(--accent)',
    borderRadius: '50%',
    boxShadow: '0 0 8px rgba(116, 183, 181, 0.55)'
  },
  counterText: {
    fontSize: '12px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontWeight: 600,
    color: 'var(--text)'
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  heroSection: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 24px 0',
    gap: '24px',
    boxSizing: 'border-box'
  },
  eyebrowContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 12px',
    backgroundColor: 'white',
    border: '1px solid var(--border)',
    borderRadius: '999px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  },
  checkIconWrapper: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyebrowText: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: 'var(--text)'
  },
  heroTitle: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '64px',
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: '-1px',
    color: 'var(--text-h)',
    margin: 0
  },
  heroSubtitle: {
    fontSize: '18px',
    lineHeight: 1.5,
    color: 'var(--text)',
    maxWidth: '650px',
    margin: 0
  },
  heroImageContainer: {
    width: '100%',
    position: 'relative',
    marginTop: '48px',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)'
  },
  heroImage: {
    width: '100%',
    height: '600px',
    objectFit: 'cover',
    display: 'block'
  },
  trustRatioPill: {
    position: 'absolute',
    bottom: '32px',
    left: '32px',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    padding: '16px 24px',
    borderRadius: '999px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
  },
  trustRatioIcon: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  trustRatioTextContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start'
  },
  trustRatioLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--text)'
  },
  trustRatioValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text-h)'
  },
  marqueeContainer: {
    width: '100%',
    overflow: 'hidden',
    padding: '64px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'white'
  },
  marqueeLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--text)',
    marginBottom: '32px'
  },
  marqueeOverlay: {
    width: '100%',
    position: 'relative',
    display: 'flex',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)'
  },
  marqueeContent: {
    display: 'inline-flex',
    animation: 'scroll 30s linear infinite',
  },
  marqueeItem: {
    fontSize: '28px',
    fontFamily: 'Playfair Display, serif',
    fontStyle: 'italic',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 64px'
  },

  // BENTO BOX STYLES
  bentoSection: {
    width: '100%',
    padding: '80px 24px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: 'var(--bg)'
  },
  bentoGrid: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    maxWidth: '1000px'
  },
  bentoCard: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: '32px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 10px 40px rgba(0,0,0,0.03)',
    border: '1px solid var(--border)',
    position: 'relative',
    overflow: 'hidden'
  },
  bentoRoiCard: {
    backgroundColor: 'var(--bg)',
    justifyContent: 'space-between'
  },
  bentoRoiTitle: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '44px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: '0 0 12px',
    lineHeight: 1.1
  },
  bentoRoiSubtitle: {
    fontSize: '16px',
    color: 'var(--text)',
    marginBottom: '32px'
  },
  bentoCalcTop: {
    marginBottom: '40px'
  },
  bentoCalcBottom: {
    display: 'flex',
    gap: '40px',
    paddingTop: '32px',
    borderTop: '1px solid var(--border)'
  },
  calcLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px'
  },
  calcValueHero: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '72px',
    fontWeight: 500,
    color: 'var(--text-h)',
    lineHeight: 1
  },
  calcResultBlock: {
    display: 'flex',
    flexDirection: 'column'
  },
  calcResultLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  calcResultValue: {
    fontSize: '28px',
    fontFamily: 'Playfair Display, serif',
    fontWeight: 600,
    color: 'var(--text-h)'
  },

  bentoStepCard1: {
    gridColumn: 'span 1',
    gridRow: 'span 1',
    backgroundColor: 'var(--accent-bg)'
  },
  bentoStepCard2: {
    gridColumn: 'span 1',
    gridRow: 'span 1',
    backgroundColor: 'var(--accent-bg)'
  },
  bentoStepCard3: {
    gridColumn: 'span 2',
    gridRow: 'span 1',
    backgroundColor: 'var(--brand-ink)', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  hiwStepNum: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--accent)',
    marginBottom: '20px'
  },
  bentoCardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text-h)',
    marginBottom: '12px'
  },
  bentoCardBody: {
    fontSize: '14px',
    color: 'var(--text)',
    lineHeight: 1.6
  },
  bentoDecorativeCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 10px 20px rgba(116, 183, 181, 0.35)'
  },

  // STANDARDS
  standardsSection: {
    width: '100%',
    maxWidth: '1600px',
    padding: '120px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxSizing: 'border-box'
  },
  sectionHeader: {
    textAlign: 'center',
    marginBottom: '64px'
  },
  sectionTitle: {
    fontSize: '48px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: '0 0 16px'
  },
  sectionSubtitle: {
    fontSize: '18px',
    color: 'var(--text)',
    margin: 0
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    width: '100%'
  },
  lightCard: {
    backgroundColor: 'var(--accent-bg)',
    borderRadius: '24px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'hidden'
  },
  fingerprintWatermark: {
    position: 'absolute',
    bottom: '-40px',
    right: '-40px',
    opacity: 0.6,
    pointerEvents: 'none'
  },
  darkCard: {
    backgroundColor: 'var(--brand-ink)',
    borderRadius: '24px',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative'
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    position: 'relative',
    zIndex: 2
  },
  iconCircleLight: {
    width: '40px',
    height: '40px',
    backgroundColor: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
  },
  iconCircleDark: {
    width: '40px',
    height: '40px',
    backgroundColor: 'var(--ink-75)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '32px'
  },
  verifiedPill: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: 'white',
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-h)',
    letterSpacing: '0.5px'
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: 'var(--text-h)',
    margin: '0 0 16px',
    position: 'relative',
    zIndex: 2
  },
  cardBody: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: 'var(--text)',
    margin: '0 0 40px',
    flex: 1,
    position: 'relative',
    zIndex: 2
  },
  cardFooterLight: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'var(--accent)',
    position: 'relative',
    zIndex: 2
  },
  cardFooterDark: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: 'rgba(255,255,255,0.65)'
  },
  wideCard: {
    gridColumn: '1 / -1',
    backgroundColor: 'white',
    borderRadius: '24px',
    padding: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '40px',
    border: '1px solid var(--border)',
    boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
  },
  wideCardLeft: {
    flexShrink: 0
  },
  reliabilityCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '4px solid var(--accent)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reliabilityValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: 'var(--accent)',
    lineHeight: 1.1
  },
  reliabilityLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '1px'
  },
  wideCardRight: {
    flex: 1
  },
  darkSplitSection: {
    width: '100%',
    backgroundColor: 'var(--brand-ink)',
    padding: '120px 24px',
    display: 'flex',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  darkSplitContent: {
    width: '100%',
    maxWidth: '1600px',
    display: 'flex',
    gap: '64px',
    alignItems: 'center'
  },
  darkSplitLeft: {
    flex: 1
  },
  darkSplitTitle: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '48px',
    fontWeight: 500,
    color: 'white',
    lineHeight: 1.1,
    margin: '0 0 24px'
  },
  darkSplitBody: {
    fontSize: '18px',
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.72)',
    margin: '0 0 40px',
    maxWidth: '500px'
  },
  checkList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  checkListItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    color: 'white',
    fontSize: '16px'
  },
  checkIconLightWrapper: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  darkSplitRight: {
    flex: 1
  },
  meetingImage: {
    width: '100%',
    height: 'auto',
    borderRadius: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  bottomCtaSection: {
    width: '100%',
    padding: '120px 24px',
    display: 'flex',
    justifyContent: 'center',
    boxSizing: 'border-box'
  },
  ctaCard: {
    width: '100%',
    maxWidth: '1200px',
    backgroundColor: 'var(--accent-bg)',
    borderRadius: '32px',
    padding: '80px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  },
  ctaTitle: {
    fontSize: '48px',
    fontWeight: 500,
    color: 'var(--text-h)',
    margin: '0 0 20px'
  },
  ctaSubtitle: {
    fontSize: '18px',
    color: 'var(--text)',
    margin: '0 0 40px',
    maxWidth: '600px'
  },
  ctaFooterText: {
    marginTop: '32px',
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '1px'
  },
  footer: {
    width: '100%',
    padding: '48px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border)',
    boxSizing: 'border-box'
  },
  footerBrand: {
    fontWeight: 600,
    fontSize: '14px',
    color: 'var(--text-h)'
  },
  footerLinks: {
    display: 'flex',
    gap: '32px'
  },
  footerLink: {
    fontSize: '14px',
    color: 'var(--text)',
    cursor: 'pointer'
  },
  footerCopyright: {
    fontSize: '13px',
    color: 'var(--text)'
  }
};
