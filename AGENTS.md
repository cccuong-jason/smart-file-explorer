# AGENTS.md

## Default Operating Agreement

This repository authorizes the coding agent to use the GitHub operator workflow by default once implementation work is agreed and quality gates are satisfied.

## GitHub Operator Policy

The agent may, without asking again for each individual git step, do the following after one of these conditions is true:
- the user explicitly asks for the change to be finalized, or
- the user has reviewed the work and asked to proceed, or
- the implementation has passed the required quality checks for the scoped task

Allowed autonomous actions after that point:
- create or switch to a branch
- stage files
- create commits
- push the branch to origin
- open or update a pull request
- inspect GitHub Actions, PR checks, and CI logs
- push follow-up fixes needed to make the PR green

Required checks before opening a PR:
- run the relevant automated tests for the change
- run type-checking when the change affects TypeScript or app structure
- run UI or regression tests when the change affects visible behavior
- summarize any known limitation honestly in the PR body

Merge policy:
- the agent must not merge to `main` by default
- the user is the final approver and merger
- the agent should stop after the PR is ready and all checks are green, unless the user explicitly asks the agent to merge

Behavior expectations:
- prefer GitHub CLI for PR and CI operations when available
- prefer small, reviewable commits
- do not bypass failing checks
- do not force-push unless the user explicitly asks for it
- do not rewrite shared branch history unless the user explicitly asks for it

## Release Flow

When a feature is complete and validated, the agent should:
1. ensure tests and checks for the scoped work pass
2. commit the work on the intended branch
3. push the branch
4. open or update the PR to the requested base branch
5. monitor CI and fix issues within scope
6. hand off the final merge to the user
