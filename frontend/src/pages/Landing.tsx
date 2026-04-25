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
            style={styles.primaryBtn}
            onMouseEnter={(e) => {
              (e.currentTarget.style.transform = 'translateY(-1px)');
              (e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.15)');
            }}
            onMouseLeave={(e) => {
              (e.currentTarget.style.transform = 'translateY(0)');
              (e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)');
            }}
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
                  <div style={{...styles.calcResultValue, color: '#0044FF'}}>{hoursSaved.toLocaleString()} hrs</div>
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
                <svg width="240" height="240" viewBox="0 0 24 24" fill="none" stroke="#E5E7EB" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z"></path>
                  <path d="M5.5 9.5c1.5-2 4-3.5 6.5-3.5s5 1.5 6.5 3.5"></path>
                  <path d="M7 13c1-2.5 3.5-4 5-4s4 1.5 5 4"></path>
                  <path d="M9 16.5c1-1.5 2-2.5 3-2.5s2 1 3 2.5"></path>
                  <path d="M12 22v-3"></path>
                </svg>
              </div>
              <div style={styles.cardTop}>
                <div style={styles.iconCircleLight}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#101828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                </div>
                <div style={styles.verifiedPill}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0044FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
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
              <p style={{...styles.cardBody, color: '#9ca3af'}}>Every candidate carries a unified Reliability Score based on their verification status and historical consistency, allowing your team to focus only on high-signal prospects.</p>
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
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="#0044FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                Plug-and-play ATS extensions
              </li>
              <li style={styles.checkListItem}>
                <div style={styles.checkIconLightWrapper}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="#0044FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                Zero internal biometric storage
              </li>
              <li style={styles.checkListItem}>
                <div style={styles.checkIconLightWrapper}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 3L4.5 8.5L2 6" stroke="#0044FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
            style={{...styles.primaryBtn, marginTop: 24, padding: '16px 32px'}}
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
    backgroundColor: '#FAF9F6', 
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
    border: '2px solid #111827',
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
    border: '2px solid #111827',
    borderRadius: '50%',
    position: 'absolute',
    boxSizing: 'border-box'
  },
  logoRingInner: {
    width: '6px',
    height: '6px',
    border: '2px solid #111827',
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
    backgroundColor: '#F3F4F6',
    padding: '6px 14px',
    borderRadius: '999px',
    border: '1px solid #E5E7EB'
  },
  pulseLight: {
    width: '8px',
    height: '8px',
    backgroundColor: '#10B981',
    borderRadius: '50%',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.6)'
  },
  counterText: {
    fontSize: '12px',
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontWeight: 600,
    color: '#4B5563'
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
    border: '1px solid #E5E7EB',
    borderRadius: '999px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
  },
  checkIconWrapper: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    backgroundColor: '#EBF0FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  eyebrowText: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    color: '#4B5563'
  },
  heroTitle: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '64px',
    fontWeight: 500,
    lineHeight: 1.1,
    letterSpacing: '-1px',
    color: '#111827',
    margin: 0
  },
  heroSubtitle: {
    fontSize: '18px',
    lineHeight: 1.5,
    color: '#6B7280',
    maxWidth: '650px',
    margin: 0
  },
  primaryBtn: {
    backgroundColor: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '999px',
    padding: '16px 28px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
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
    backgroundColor: '#0044FF',
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
    color: '#6B7280'
  },
  trustRatioValue: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#111827'
  },
  marqueeContainer: {
    width: '100%',
    overflow: 'hidden',
    padding: '64px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    borderBottom: '1px solid #E5E7EB',
    backgroundColor: 'white'
  },
  marqueeLabel: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#9CA3AF',
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
    color: '#D1D5DB',
    margin: '0 64px'
  },

  // BENTO BOX STYLES
  bentoSection: {
    width: '100%',
    padding: '80px 24px',
    display: 'flex',
    justifyContent: 'center',
    backgroundColor: '#FAF9F6' // Match warm cream
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
    border: '1px solid #F0F0F0',
    position: 'relative',
    overflow: 'hidden'
  },
  bentoRoiCard: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'space-between'
  },
  bentoRoiTitle: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '44px',
    fontWeight: 500,
    color: '#111827',
    margin: '0 0 12px',
    lineHeight: 1.1
  },
  bentoRoiSubtitle: {
    fontSize: '16px',
    color: '#6B7280',
    marginBottom: '32px'
  },
  bentoCalcTop: {
    marginBottom: '40px'
  },
  bentoCalcBottom: {
    display: 'flex',
    gap: '40px',
    paddingTop: '32px',
    borderTop: '1px solid #F3F4F6'
  },
  calcLabel: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px'
  },
  calcValueHero: {
    fontFamily: 'Playfair Display, serif',
    fontSize: '72px',
    fontWeight: 500,
    color: '#111827',
    lineHeight: 1
  },
  calcResultBlock: {
    display: 'flex',
    flexDirection: 'column'
  },
  calcResultLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px'
  },
  calcResultValue: {
    fontSize: '28px',
    fontFamily: 'Playfair Display, serif',
    fontWeight: 600,
    color: '#111827'
  },

  bentoStepCard1: {
    gridColumn: 'span 1',
    gridRow: 'span 1',
    backgroundColor: '#F8F9FA'
  },
  bentoStepCard2: {
    gridColumn: 'span 1',
    gridRow: 'span 1',
    backgroundColor: '#F8F9FA'
  },
  bentoStepCard3: {
    gridColumn: 'span 2',
    gridRow: 'span 1',
    backgroundColor: '#0F1115', 
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  hiwStepNum: {
    fontFamily: 'ui-monospace, Consolas, monospace',
    fontSize: '12px',
    fontWeight: 700,
    color: '#0044FF',
    marginBottom: '20px'
  },
  bentoCardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#111827',
    marginBottom: '12px'
  },
  bentoCardBody: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: 1.6
  },
  bentoDecorativeCircle: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#0044FF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 10px 20px rgba(0, 68, 255, 0.3)'
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
    color: '#111827',
    margin: '0 0 16px'
  },
  sectionSubtitle: {
    fontSize: '18px',
    color: '#6B7280',
    margin: 0
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    width: '100%'
  },
  lightCard: {
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#0F1115',
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
    backgroundColor: '#1F2937',
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
    color: '#111827',
    letterSpacing: '0.5px'
  },
  cardTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#111827',
    margin: '0 0 16px',
    position: 'relative',
    zIndex: 2
  },
  cardBody: {
    fontSize: '15px',
    lineHeight: 1.6,
    color: '#4B5563',
    margin: '0 0 40px',
    flex: 1,
    position: 'relative',
    zIndex: 2
  },
  cardFooterLight: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#0044FF',
    position: 'relative',
    zIndex: 2
  },
  cardFooterDark: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '1px',
    color: '#9CA3AF'
  },
  wideCard: {
    gridColumn: '1 / -1',
    backgroundColor: 'white',
    borderRadius: '24px',
    padding: '40px',
    display: 'flex',
    alignItems: 'center',
    gap: '40px',
    border: '1px solid #E5E7EB',
    boxShadow: '0 10px 30px rgba(0,0,0,0.02)'
  },
  wideCardLeft: {
    flexShrink: 0
  },
  reliabilityCircle: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '4px solid #0044FF',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  reliabilityValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0044FF',
    lineHeight: 1.1
  },
  reliabilityLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#0044FF',
    letterSpacing: '1px'
  },
  wideCardRight: {
    flex: 1
  },
  darkSplitSection: {
    width: '100%',
    backgroundColor: '#1E293B',
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
    color: '#9CA3AF',
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
    backgroundColor: '#F3F4F6',
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
    color: '#111827',
    margin: '0 0 20px'
  },
  ctaSubtitle: {
    fontSize: '18px',
    color: '#6B7280',
    margin: '0 0 40px',
    maxWidth: '600px'
  },
  ctaFooterText: {
    marginTop: '32px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#9CA3AF',
    letterSpacing: '1px'
  },
  footer: {
    width: '100%',
    padding: '48px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid #E5E7EB',
    boxSizing: 'border-box'
  },
  footerBrand: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#111827'
  },
  footerLinks: {
    display: 'flex',
    gap: '32px'
  },
  footerLink: {
    fontSize: '14px',
    color: '#6B7280',
    cursor: 'pointer'
  },
  footerCopyright: {
    fontSize: '13px',
    color: '#9CA3AF'
  }
};
