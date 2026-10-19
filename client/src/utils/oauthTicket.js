export function consumeOAuthHash() {
  const hash = window.location.hash || "";
  const raw = hash.charAt(0) === "#" ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const ticket = params.get("ticket");
  const redirect = params.get("redirect");
  if (hash) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    );
  }
  return { ticket: ticket, redirect: redirect };
}
