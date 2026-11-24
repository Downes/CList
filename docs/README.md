# CList documentation

| Area | Audience | Starting point |
|---|---|---|
| This `docs/` directory | People using CList and service developers seeking an explanation | [Testing CList](testing.md) and [How CList publishes your work](publish_structure.md), including the service API and detailed technical reference |
| [AI instructions on GitHub](https://github.com/Downes/CList/tree/main/docs/ai) | AI coding tools working on CList | [Testing instructions](https://github.com/Downes/CList/blob/main/docs/ai/testing.md) and [publishing coding instructions](https://github.com/Downes/CList/blob/main/docs/ai/publishing.md); also follow [AGENTS.md](https://github.com/Downes/CList/blob/main/AGENTS.md) |

Human documentation belongs directly in this directory, deployed at
`/srv/www/clist.mooc.ca/docs`. Task-specific AI instructions belong in `ai/`.
Keep the human documentation and AI instructions synchronized when behaviour or
contracts change.

Existing architecture and technical references remain at the top level of this
directory, including [the combined publishing guide](publish_structure.md),
[service integration](adding-a-service.md), [reader workflow](reader-workflow.md),
and [data contracts](data-contracts.md).
They support both audiences. The human testing guide explains how to run checks;
the AI testing instructions define verification and reporting responsibilities.

For the current module boundaries, including calendar and additional editors, see
[Architecture](architecture.md) and [Editor structure](editors_structure.md).
Historical plans and dated test counts describe their recorded checkpoints; use
the latest testing checkpoint for current automated results.
