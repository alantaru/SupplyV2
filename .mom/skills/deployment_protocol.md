# Skill: Frontend Deployment & Build

## Objective
Ensure the frontend is correctly built and deployed to the EC2 environment after every significant change.

## Protocol
1. **Local Build**: Run `npm run build` in `/frontend`.
2. **Quality Check**: Verify `dist/` directory exists and has no obvious errors.
3. **Transfer**: (Placeholder) Use SCP/SSH protocols as defined in project deployment scripts.
4. **Persistence**: Commit changes to `main` branch with descriptive messages.

## Constraints
- Always use placeholders for AWS keys.
- Never commit `node_modules` or `dist`.
