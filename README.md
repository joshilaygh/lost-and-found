# FindIt - Lost and Found

FindIt is a web application for reporting, searching, and matching lost and
found items. Users can manage item reports, upload images, receive
notifications, and communicate about potential matches.

The project is organized as:

- **Frontend:** React 18 with Vite
- **Backend:** ASP.NET Core 9 Web API
- **Database:** MySQL for local development; SQLite is used by the testing
  environment
- **Authentication:** JWT authentication with optional Google sign-in
- **Real-time features:** SignalR messaging and notifications

## Repository structure

```text
.
├── backend/
│   ├── LostAndFoundApp/       # ASP.NET Core API
│   └── LostAndFoundApp.Tests/ # Backend unit and integration tests
├── frontend/
│   └── lostfound-client/      # React/Vite application
├── LostAndFoundApp.sln
└── TESTING.md
```

## Prerequisites

Install the following before running the application:

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js 20 or later](https://nodejs.org/)
- npm
- MySQL Server for normal development

## Backend setup

1. Open a terminal in the backend project:

   ```powershell
   cd backend\LostAndFoundApp
   ```

2. Configure the development connection string and JWT settings with .NET
   user secrets. Replace the example values with your local values:

   ```powershell
   dotnet user-secrets set "ConnectionStrings:DefaultConnection" "server=localhost;user=root;password=YOUR_PASSWORD;database=lostandfounddb"
   dotnet user-secrets set "Jwt:Key" "REPLACE_WITH_A_LONG_RANDOM_SECRET"
   dotnet user-secrets set "Jwt:Issuer" "LostAndFoundApp"
   dotnet user-secrets set "Jwt:Audience" "LostAndFoundAppAudience"
   ```

3. Restore dependencies and start the API:

   ```powershell
   dotnet restore
   dotnet run
   ```

The API is available at:

- HTTP: `http://localhost:5298`
- HTTPS: `https://localhost:7264`

Swagger is available when the API is running in a non-testing environment.

## Frontend setup

1. Open another terminal in the frontend project:

   ```powershell
   cd frontend\lostfound-client
   ```

2. Install dependencies:

   ```powershell
   npm ci
   ```

3. Create a `.env.development` file if one does not already exist:

   ```env
   VITE_API_BASE_URL=http://localhost:5298
   VITE_GOOGLE_CLIENT_ID=your-google-client-id
   ```

   The API base URL defaults to `http://localhost:5298` when it is not set.
   Do not commit secrets or private credentials. Local `.env` files are
   excluded by `.gitignore`.

4. Start the frontend:

   ```powershell
   npm run dev
   ```

Open the application at `http://localhost:5173`.

## Testing

Backend tests:

```powershell
cd backend\LostAndFoundApp.Tests
dotnet restore
dotnet test
```

Frontend unit tests:

```powershell
cd frontend\lostfound-client
npm ci
npm run test
```

Frontend lint and production build:

```powershell
npm run lint
npm run build
```

End-to-end tests require the backend and frontend development servers to be
running in separate terminals:

```powershell
cd frontend\lostfound-client
npx playwright test
```

See [TESTING.md](TESTING.md) for the complete testing guide.

## Useful commands

### Backend

```powershell
cd backend\LostAndFoundApp
dotnet run
```

### Frontend

```powershell
cd frontend\lostfound-client
npm run dev
npm run build
npm run preview
```

## Security notes

- Keep database passwords, JWT keys, and Google credentials out of source
  control.
- Use .NET user secrets or environment variables for local secrets.
- Change all development/default secrets before deploying the application.
- Configure production CORS origins and HTTPS settings before deployment.

## License

No license has been specified for this project yet.
