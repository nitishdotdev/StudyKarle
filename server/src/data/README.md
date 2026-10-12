# Disposable email domain dataset

`disposable-email-domains.json` is a local blocklist of well-known temporary / throwaway email domains.

## Source

Compiled from public disposable-email domain lists commonly used by open-source blockers (Mailinator, Guerrilla Mail, YOPmail, temp-mail, trashmail, and similar providers). It is not a vendor API and is not fetched at runtime.

## Updates

Replace or extend `disposable-email-domains.json` and redeploy the API. Keep entries lowercase, without a leading `@` or trailing dot. Subdomains of a listed domain are also blocked (for example `sub.mailinator.com`).

## Limitations

Detection is best-effort. New disposable providers appear constantly, some legitimate domains are occasionally misclassified, and custom domains used as throwaways cannot be detected from the domain alone. Do not treat this as perfect coverage.

## Fallback

If the dataset file cannot be loaded, detection is skipped (`detection_unavailable`) so existing authentication is not taken down. Malformed emails are still rejected by validators. Recognized disposable addresses are rejected with:

`Temporary email addresses are not supported. Please use a permanent email address.`
