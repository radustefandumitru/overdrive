# Prompt Caching

Prompt caching lets an LLM runtime reuse work from an unchanged prompt prefix. In practice, the model provider or agent harness may cache the internal key/value state for the stable beginning of a prompt, then only process the changed tail on later turns.

AgenticSupercharge cannot switch prompt caching on or off. Claude Code, Codex/OpenAI-backed runtimes, and similar harnesses own that behavior. AgenticSupercharge can only make itself cache-friendly by keeping broad instructions stable, loading skills selectively, and storing project memory in files instead of repeatedly pasting large context.

## How AgenticSupercharge Helps

- Global instruction blocks are static and do not contain timestamps, session IDs, counters, or per-run text.
- `skill-router` selects only the relevant skill bodies instead of loading the full catalog.
- Router output should use a stable order: clarification/planning first, then domain reasoning, implementation, validation, and handoff/launch checks.
- AS-Workflow stores persistent project state in `.agenticsupercharge/`, so agents can read only the file they need instead of replaying old conversation.
- Hook-provided context stays intentionally short and avoids frequently changing issue counts or detailed status text.

## Hygiene Rules

- Put stable context first: global instructions, selected skills, and durable workflow files.
- Put the changing user request and volatile tool output last.
- Avoid timestamps, random IDs, generated banners, or whitespace churn in broad instruction prefixes.
- After reading a large tool result, summarize the useful bits instead of pasting or re-reading the same output.
- Keep local workflow notes concise. The point is retrieval, not creating another giant prompt.

## Security Note

Some prompt-caching research discusses timing side channels in multi-tenant hosted inference. That is a provider-side concern. AgenticSupercharge is a local developer tool and does not run shared inference infrastructure, so it does not add or solve that class of risk. The practical safety rule here is simpler: do not store secrets, tokens, credentials, private keys, or sensitive personal data in instructions, skills, workflow files, or knowledge vault notes.

## Sources

This guidance is paraphrased from prompt-caching and KV-cache references by Andre Kreidemann, Sankalp Shubham, and Sam Rose / ngrok, plus the already credited `context-optimization` skill source:

- Andre Kreidemann: https://kreidemann.com/blog/prompt-caching
- Sankalp Shubham: https://sankalp.bearblog.dev/how-prompt-caching-works/
- Sam Rose / ngrok: https://ngrok.com/blog/prompt-caching
