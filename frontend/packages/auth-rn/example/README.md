# Example

This directory shows how a business app can consume `@mini-auth/auth-rn` directly.

## What it demonstrates

- A login screen wired to `createAuthClient().login()`
- A register screen wired to `createAuthClient().register()`
- Switching between login and register without maintaining a second RN UI package

## Notes

The example imports from `../src` so it stays in sync with the workspace source during development.
