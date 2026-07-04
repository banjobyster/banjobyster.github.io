// A calm lab bench that fills the hero's lower band: three pieces of decorative
// hardware (an intake crate, a test monitor, a rack tower) in the site's
// beige-lab aesthetic. Purely presentational, no interaction or state, with a
// gentle idle shimmer on the LEDs and the monitor's test pattern.
export default function Bench() {
  return (
    <div className="bench" aria-hidden="true">
      <div className="benchItem crate">
        <span className="crateGrille" />
        <i className="benchLed" />
        <span className="benchLabel mono">STANDBY</span>
      </div>
      <div className="benchItem scope">
        <span className="scopeScreen">
          <span className="scopeStatus mono">STBY</span>
        </span>
        <span className="benchLabel mono">TEST MON</span>
      </div>
      <div className="benchItem tower">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`towerSlot${i === 0 ? " lit" : ""}`}>
            <i />
          </span>
        ))}
        <span className="benchLabel mono">RK-01 · V1.0</span>
      </div>
    </div>
  );
}
