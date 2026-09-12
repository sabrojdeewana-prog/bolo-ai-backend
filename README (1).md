# Bolo AI Backend v1

**Owner:** Sabroj Babu

Bolo AI Backend v1 is a Node.js/Express backend designed for the Bolo AI project. This version uses **Express**, **bcrypt**, and **JWT** for the core backend/authentication flow.

## Features

- Express.js backend server
- User authentication support
- Password hashing with bcrypt
- JWT-based authentication
- Environment-variable configuration
- Simple local development setup
- Suitable as the backend foundation for the Bolo AI project

## Project Files

```text
bolo-ai-backend/
├── server.js
├── package.json
├── .env.example
└── README.md
```

## Requirements

- Node.js
- npm

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/sabrojdeewana-prog/bolo-ai-backend.git
cd bolo-ai-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create your environment file

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then open `.env` and replace the placeholder values with your own configuration.

### 4. Start the backend

```bash
node server.js
```

If `package.json` contains a start script, you can also use:

```bash
npm start
```

The server will use the `PORT` value from `.env` when configured.

## Environment Variables

| Variable | Purpose |
|---|---|
| `PORT` | Port on which the Express server runs |
| `JWT_SECRET` | Secret used to sign and verify JWT tokens |

Example:

```env
PORT=3000
JWT_SECRET=your_private_random_secret
```

Use your own strong secret in the real `.env` file.

## Security Warning

**Never upload your real `.env` file to GitHub.**

Do not commit or publish:

- Real API keys
- Passwords
- JWT secrets
- Database credentials
- Private tokens
- Other production secrets

Keep `.env` local and add it to `.gitignore`.

The `.env.example` file is safe to publish because it contains placeholders only.

## Development

After changing backend code, restart the Node.js server:

```bash
node server.js
```

For production deployment, configure environment variables securely on the hosting platform rather than committing secrets to the repository.

## License

This project is maintained for the Bolo AI project.

**Owner:** Sabroj Babu
