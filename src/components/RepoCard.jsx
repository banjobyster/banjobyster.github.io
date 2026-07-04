// A compact plate for an auto-discovered GitHub repo, used in the "More on
// GitHub" grid. Staggers in by index once live data resolves.
export default function RepoCard({ repo, index = 0 }) {
  return (
    <a
      className="repoCard"
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
      style={{ "--i": index }}
      data-walk
    >
      <span className="repoTop mono">
        <span className="repoName">{repo.name}</span>
        {repo.stargazers_count > 0 && (
          <span className="repoStars">★ {repo.stargazers_count}</span>
        )}
      </span>
      <span className="repoDesc">{repo.description || "No description yet."}</span>
      {repo.language && (
        <span className="repoLang mono">
          <i className="langDot" aria-hidden="true" />
          {repo.language}
        </span>
      )}
    </a>
  );
}
