import { renderText } from "../lib/text.jsx";

// A featured project as a device faceplate: dark screen well on the left,
// spec plate on the right, LED strip and port in the project's accent color.
// Hovering (or keyboard focus) powers the device on: LEDs light in sequence,
// the screen brightens, tags tint. The card is robot terrain; hover effects
// never move its rect.
export default function ProjectCard({
  title,
  tagline,
  description,
  image,
  link,
  accent = "#C1A1D3",
  tags,
  index = 0,
}) {
  const unit = String(index + 1).padStart(2, "0");
  return (
    <article className="device" data-terrain="card" style={{ "--accent": accent }}>
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
          <span className="devicePort" aria-hidden="true" />
        </div>
        <h3 className="deviceTitle">
          <a href={link} target="_blank" rel="noreferrer">
            {title}
          </a>
        </h3>
        {tagline ? <p className="deviceTagline">{tagline}</p> : null}
        <p className="deviceDesc">{renderText(description, accent)}</p>
        {tags?.length ? (
          <ul className="deviceTags mono">
            {tags.map((t, i) => (
              <li key={t} style={{ "--i": i }}>
                {t}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
