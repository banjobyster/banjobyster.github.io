import { renderText } from "../lib/text.jsx";

// A featured project as a device faceplate: dark screen well on the left,
// spec plate on the right, LED strip and port in the project's accent color.
// Hovering (or keyboard focus) powers the device on: LEDs light in sequence,
// the screen brightens, tags tint.
export default function ProjectCard({
  title,
  tagline,
  description,
  image,
  link,
  accent = "#C1A1D3",
  tags,
  vibeCoded = false,
  index = 0,
}) {
  const unit = String(index + 1).padStart(2, "0");
  return (
    <article
      className="device"
      style={{ "--accent": accent }}
      data-walk="top bottom left right"
    >
      <a
        className="deviceScreen"
        href={link}
        target="_blank"
        rel="noreferrer"
        aria-label={`${title} (opens project)`}
        tabIndex={-1}
      >
        <span className="screenGlass">
          {image ? (
            <img src={image} alt="" loading={index > 0 ? "lazy" : "eager"} />
          ) : (
            <span className="screenIdle mono">NO SIGNAL</span>
          )}
        </span>
      </a>
      <div className="deviceBody">
        <div className="deviceMeta mono">
          <span>PRJ {unit}</span>
          <span className="ledStrip" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </div>
        <h3 className="deviceTitle">
          <a href={link} target="_blank" rel="noreferrer">
            {title}
          </a>
        </h3>
        {tagline ? <p className="deviceTagline">{tagline}</p> : null}
        <p className="deviceDesc">{renderText(description, accent)}</p>
        {tags?.length || vibeCoded ? (
          <ul className="deviceTags mono">
            {(tags ?? []).map((t, i) => (
              <li key={t} style={{ "--i": i }}>
                {t}
              </li>
            ))}
            {/* project.json `vibeCoded: true` badges the card alongside its
                languages and sinks it to the end of the featured order */}
            {vibeCoded ? (
              <li className="tagVibe" style={{ "--i": tags?.length ?? 0 }}>
                vibe coded
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {/* The card is the appliance: its cord drops off the bottom edge into
          this wall socket (hung below the card by the fixture CSS). Yank the
          plug and the device loses its signal until someone reseats it. */}
      <span
        className="devicePort fx fxPort"
        data-fixture="port"
        data-fixture-id={`port-${unit}`}
        data-states="linked cut"
        data-state="linked"
        data-transitions="linked>cut cut>linked"
        role="switch"
        aria-checked="true"
        tabIndex={0}
        aria-label={`${title} feed plug`}
        style={{ "--pulse": index + 2 }}
      >
        <i className="fxRing" aria-hidden="true" />
      </span>
      <i className="fxTag mono" aria-hidden="true" />
    </article>
  );
}
