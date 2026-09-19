# Agent marks

Logomarks that label a pull request comment as written by a coding agent rather than typed by the account holder.

The comment carries the mark as an image and the model name as text, so a new model name needs no new file:

```markdown
<img src="https://raw.githubusercontent.com/treet/claude-skills/main/badges/claude-mark.svg" height="14"> **Opus 5**

---
```

`claude-mark.svg` holds Claude's mark in `#D97757`. `openai-mark.svg` holds OpenAI's mark in `#10A37F`. Both come from simple-icons, recoloured to the brand value. `raw.githubusercontent.com` serves an SVG as `image/svg+xml`, which is the content type GitHub requires to render it inside a comment.
