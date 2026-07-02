// A compact card for an auto-discovered GitHub repo (no screenshot). Used in the
// "More on GitHub" section, built from the single repo-list API call.
export default function RepoCard({ repo }) {
  return (
    <a
      className="repoCard"
      href={repo.html_url}
      target="_blank"
      rel="noreferrer"
    >
      <div className="repoName">{repo.name}</div>
      <div className="repoDesc">{repo.description || "No description yet."}</div>
      <div className="repoMeta">
        {repo.language && <span>{repo.language}</span>}
        {repo.stargazers_count > 0 && <span>★ {repo.stargazers_count}</span>}
      </div>
    </a>
  );
}
