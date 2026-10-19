function storageKey() {
  return "sk.oauth.ticket:" + window.location.pathname;
}

export function consumeOAuthHash() {
  const hash = window.location.hash || "";
  const raw = hash.charAt(0) === "#" ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  let ticket = params.get("ticket");
  let redirect = params.get("redirect");

  if (ticket) {
    try {
      sessionStorage.setItem(
        storageKey(),
        JSON.stringify({ ticket: ticket, redirect: redirect })
      );
    } catch (err) {
      // sessionStorage can throw in private mode; the in-memory return still works.
    }
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search
    );
  } else {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey()) || "null");
      if (stored && typeof stored.ticket === "string") {
        ticket = stored.ticket;
        redirect = stored.redirect;
      }
    } catch (err) {
      ticket = null;
    }
  }

  return { ticket: ticket, redirect: redirect };
}

export function clearOAuthTicket() {
  try {
    sessionStorage.removeItem(storageKey());
  } catch (err) {
    // Ignore storage failures; the hash is already stripped.
  }
}
