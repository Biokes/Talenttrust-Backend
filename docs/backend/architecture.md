# Backend Architecture Summary

The TalentTrust Backend is an Express.js Node.js application written in TypeScript, acting as the API gateway and metadata server for a decentralized freelancer escrow protocol. It follows a **Layered (N-Tier) MVC Pattern**.

## Core Architecture Pattern

- **Presentation Layer (Controllers):** Handles HTTP requests, input validation, and HTTP responses.
- **Business Logic Layer (Services/Modules):** Contains the core application logic, separating business rules from HTTP transport.
- **Integration/Data Layer:** Manages interactions with external services (e.g., Stellar/Soroban via RPC) and databases.
- **Middleware:** Cross-cutting concerns like authentication, error handling, and request logging.

## Application Entry Point
- `src/index.ts` serves as the main entry point, bootstrapping the Express application, registering global middleware, and mounting route handlers.
