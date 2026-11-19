# CLAUDE.md

**Pylinka Demo** — port of particles_demo (Particlr) to the Pylinka GPU particle system

# Development Guidelines

## Core Principles

- Keep code simple, readable and maintainable.
- Prefer clarity over cleverness.
- Avoid unnecessary abstraction, complexity and dependencies.
- Don't over-engineer. Implement only what is needed.
- Prefer small, focused functions and components.
- Follow existing project conventions and patterns.
- Use meaningful names for variables, functions and classes.
- Avoid duplication. Reuse code where it genuinely improves clarity.

## Code Quality

- Use TypeScript with strict type checking.
- Avoid `any`. Use explicit types where appropriate.
- Handle errors explicitly. Don't silently swallow exceptions.
- Remove unused code, imports, comments and debugging statements.
- Comment why something is done, not what the code does.
- Keep functions and files reasonably small.

## Testing

- Write tests for new functionality.
- Update tests when modifying existing functionality.
- Test edge cases and error conditions.
- Fix failing tests before considering work complete.
- Don't change or remove tests simply to make them pass.
- Prefer meaningful tests over excessive test coverage.

## Development Workflow

1. Understand the existing code before making changes.
2. Make the smallest change that solves the problem.
3. Run relevant tests after making changes.
4. Check for TypeScript errors and linting issues.
5. Review changes for unnecessary complexity.
6. Summarise what changed and any outstanding issues.

## General

- Don't introduce new dependencies without a good reason.
- Don't modify unrelated code.
- Don't leave TODOs or placeholders unless explicitly requested.
- Never claim something is tested unless the tests have actually been run.
