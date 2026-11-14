# CList documentation

| Area | Audience | Starting point |
|---|---|---|
| This `docs/` directory | People using CList and service developers seeking an explanation | [How CList publishes your work](publish_structure.md), including the service API and detailed technical reference |
| [ai/](ai/) | AI coding tools working on CList | [Publishing coding instructions](ai/publishing.md); also follow the repository's [AGENTS.md](../AGENTS.md) |

Human documentation belongs directly in this directory, deployed at
`/srv/www/clist.mooc.ca/docs`. Task-specific AI instructions belong in `ai/`.
Keep the human documentation and AI instructions synchronized when behaviour or
contracts change.

Existing architecture and technical references remain at the top level of this
directory, including [the combined publishing guide](publish_structure.md),
[service integration](adding-a-service.md), and [data contracts](data-contracts.md).
They support both audiences. This organization does not relocate or change the
collections editor or its pending work.
