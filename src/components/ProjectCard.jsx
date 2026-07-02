import { renderText } from "../lib/text.jsx";

// A featured project card — the big-screenshot neumorphic tab, driven by data.
export default function ProjectCard({
  title,
  description,
  image,
  link,
  accent = "#C1A1D3",
}) {
  return (
    <div className="tabs">
      <a href={link} target="_blank" rel="noreferrer">
        {image ? (
          <div className="image">
            <img src={image} alt={title} loading="lazy" />
          </div>
        ) : null}
      </a>
      <div className="c_button"></div>
      <div className="tabTitle" style={{ color: accent }}>
        {title}
      </div>
      <div className="tabDesc">{renderText(description, accent)}</div>
    </div>
  );
}
