/** Layered glass pedestal on the studio floor with two slow orbit rings (decorative). */
export function GlassPlatform() {
  return (
    <>
      <div className="hm-floor-shadow" />
      <div className="hm-plane hm-enter hm-anim" style={{ ["--enter-dur" as string]: "900ms", ["--from-y" as string]: "24px", ["--from-z" as string]: "0px" }}>
        <div className="hm-plane-idle hm-anim">
          <div className="hm-ring" style={{ width: "128%", height: "128%" }}>
            <div className="hm-ring-spin hm-anim">
              <span className="hm-node" style={{ left: "50%", top: "-4px" }} />
              <span className="hm-node" style={{ left: "6%", top: "70%" }} />
            </div>
          </div>
          <div className="hm-ring" style={{ width: "104%", height: "104%", borderStyle: "dashed" }}>
            <div className="hm-ring-spin is-reverse hm-anim">
              <span className="hm-node" style={{ right: "4%", top: "28%" }} />
            </div>
          </div>
          <div className="hm-disc hm-disc-edge" style={{ width: "80%", height: "80%", transform: "translateZ(-8px)" }} />
          <div className="hm-disc" style={{ width: "80%", height: "80%" }} />
          <div className="hm-disc hm-disc-edge" style={{ width: "62%", height: "62%", transform: "translateZ(8px)" }} />
          <div className="hm-disc" style={{ width: "62%", height: "62%", transform: "translateZ(16px)" }} />
          <div className="hm-disc hm-disc-edge" style={{ width: "42%", height: "42%", transform: "translateZ(24px)" }} />
          <div className="hm-disc" style={{ width: "42%", height: "42%", transform: "translateZ(32px)" }} />
        </div>
      </div>
    </>
  );
}
