# Irchad API Gateway

The Irchad API Gateway is a high-performance, centralized backend service built with NestJS that acts as the main entry point for all Irchad platform services. It intelligently routes requests between mobile and web backends while providing comprehensive logging, authentication, and performance monitoring.

## 🚀 Features

- 🌐 **Intelligent Request Routing**: Routes requests to mobile or web backends based on request context
- 🔐 **Centralized Authentication**: JWT-based authentication with custom guards and decorators
- 📊 **Advanced Logging**: Multi-level interceptor-based logging with Fluent Bit integration
- ⚡ **Performance Monitoring**: Database query and request performance tracking
- 🗄️ **Prisma Integration**: Modern database ORM with comprehensive monitoring
- 📈 **Request Tracking**: Complete request lifecycle monitoring
- 🔒 **Security First**: Authentication guards and role-based access control
- 🚀 **Production Ready**: Deployed on Railway with Docker containerization

## 🛠️ Tech Stack

- **Framework**: NestJS (Node.js)
- **Database ORM**: Prisma
- **Authentication**: JWT with custom guards
- **Logging**: Fluent Bit + Custom Interceptors
- **Database**: PostgreSQL
- **Deployment**: Railway (Docker)
- **Monitoring**: Custom interceptors for performance tracking

## 🏗️ Architecture

### Core Modules

- **Auth Module**: Handles authentication, authorization, guards, and decorators
- **Prisma Module**: Database configuration and connection management
- **Logging Module**: Fluent Bit integration with service and controller
- **Interceptors**: Performance, database, and request logging

### Request Flow
```
Client Request → API Gateway → Auth Guard → Proxy Router → Backend (Mobile/Web)
                     ↓
              Logging Interceptors → Fluent Bit → Log Files
```

## 🧪 Getting Started

> **Note**: This project is deployed on Railway and runs in a Docker container. Local development requires the production environment setup.

### Prerequisites
- Docker
- Access to production environment variables
- Railway CLI (optional)

### Environment Variables
```bash
DATABASE_URL="your_database_url"
DIRECT_URL="your_direct_database_url"
JWT_SECRET="your_jwt_secret"
LOG_DIR="/tmp/logs"
PORT=3000
NODE_ENV="production"
MOBILE_BACKEND_URL="your_mobile_backend_url"
WEB_BACKEND_URL="your_web_backend_url"
```

### Docker Deployment
```bash
# Build the Docker image
docker build -t irchad-api-gateway .

# Run the container
docker run -p 3000:3000 --env-file .env irchad-api-gateway
```

## 🔐 Authentication System

### Guards
- **JwtAuthGuard**: Validates JWT tokens
- **RolesGuard**: Role-based access control
- **ApiKeyGuard**: API key validation

### Decorators
- **@Roles()**: Role-based access control
- **@Public()**: Skip authentication for public endpoints

## 📊 Logging System

### Interceptors
- **DbLoggingInterceptor**: Database query performance monitoring
- **PerformanceLoggingInterceptor**: Request/response time and memory usage
- **RequestLoggerInterceptor**: Complete request lifecycle logging

### Fluent Bit Integration
- **Service**: `fluent-logger.service.ts` - Core logging functionality
- **Controller**: `fluent-logger.controller.ts` - Log management endpoints
- **Module**: `fluent-logger.module.ts` - Module configuration

### Log Levels & Files
- **INFO** (`fluent_info.log`): Successful operations and general information
- **WARN** (`fluent_warn.log`): Warning messages and potential issues
- **ERROR** (`fluent_error.log`): Error messages and failed operations
- **ALL** (`fluent_all.log`): Comprehensive log containing all levels

### Performance Metrics
Each log entry includes:
- Request execution time
- Memory usage during operation
- Database query performance
- User context and endpoint information
- Timestamp and trace ID

## 🌐 Proxy System

The gateway intelligently routes requests based on:
- **Client Type**: Mobile app vs web application
- **User Agent**: Automatic detection of request source
- **API Version**: Different versions route to different backends
- **Custom Headers**: Override routing with special headers

### Routing Logic
```typescript
// Example routing configuration
{
  mobile: process.env.MOBILE_BACKEND_URL,
  web: process.env.WEB_BACKEND_URL,
  rules: {
    '/api/v1/mobile/**': 'mobile',
    '/api/v1/web/**': 'web',
    default: 'web'
  }
}
```

## 🗂️ Project Structure

```
/src
  /auth                     # Authentication module
    /decorators            # Custom decorators (@Auth, @Roles, @User)
    /guards                # Auth guards (JWT, Roles, ApiKey)
    /strategies            # Passport strategies
    auth.module.ts         # Auth module configuration
    
  /proxy                    # Request routing module
    proxy.service.ts       # Routing logic
    
  /prisma                   # Database configuration
    prisma.service.ts      # Prisma client setup
    prisma.module.ts       # Database module
    
  /logging                  # Logging system
    db-logging.interceptor.ts
    performance-logging.interceptor.ts
    request-logger.interceptor.ts
    fluent-logger.service.ts   # Core logging service
    fluent-logger.controller.ts # Log management API
    fluent-logger.module.ts    # Logging module
    
  app.module.ts            # Main application module
  main.ts                  # Application entry point

/tmp/logs                      # Log files directory (container)
  fluent_all.log          # All log levels
  fluent_info.log         # Info level logs
  fluent_warn.log         # Warning level logs
  fluent_error.log        # Error level logs

Dockerfile               # Container configuration
```

## 🔗 API Endpoints

### Log Management
```bash
# View logs
GET /logs/all              # All logs
GET /logs/info             # Info logs only
GET /logs/warn             # Warning logs only
GET /logs/error            # Error logs only

# Download logs
GET /logs/download?all=true&format=file    # Download all as ZIP
GET /logs/download?type=error&format=text  # Download specific type as text

# Log metadata
GET /logs/list             # List all log files with metadata
```

### Proxy Endpoints
```bash
# Mobile backend routing
POST /api/v1/mobile/**     # Routes to mobile backend

# Web backend routing  
POST /api/v1/web/**        # Routes to web backend

```

### Authentication
```bash
# Auth endpoints
POST /auth/login           # User login
POST /auth/refresh         # Refresh token
GET /auth/profile          # User profile (requires auth)
```

## 🚀 Deployment

### Railway Configuration
- **Production URL**: `https://apigateway-production-b99d.up.railway.app`
- **Container**: Docker-based deployment
- **Logs**: Persistent log storage in container filesystem
- **Database**: PostgreSQL with connection pooling

### Docker Setup
The application runs in a containerized environment with:
- Automatic log directory creation
- Fluent Bit service initialization
- Performance monitoring setup
- Database connection management

## 📈 Monitoring & Performance

### Database Monitoring
- Query execution time tracking
- Connection pool health
- Slow query detection
- Transaction performance metrics

### Request Performance
- Response time measurement
- Memory usage per request
- Concurrent request handling
- Route-specific performance metrics

### Error Tracking
- Real-time error monitoring
- Error rate analysis
- Failed request patterns
- Database error correlation

## 🔧 Development Notes

### Local Development Limitations
- Project is production-deployed only
- Requires Docker for local testing
- Environment variables must match production
- Database access requires VPN/allowlist

### Key Features
- **Interceptor-based Logging**: All logging handled through NestJS interceptors
- **Intelligent Routing**: Automatic backend selection based on request context
- **Security First**: Comprehensive authentication and authorization
- **Performance Focused**: Optimized for high-throughput scenarios

## 🔒 Security Features

### Authentication Security
- JWT token validation
- Role-based access control
- Rate limiting per user
- Request origin validation

### Logging Security
- Sensitive data filtering
- User information anonymization
- Secure log file access
- Audit trail maintenance

## 📞 Production Support

**Live API Gateway**: [https://apigateway-production-b99d.up.railway.app](https://apigateway-production-b99d.up.railway.app)

**Log Management**: [https://apigateway-production-b99d.up.railway.app/logs](https://apigateway-production-b99d.up.railway.app/logs)

**Health Check**: [https://apigateway-production-b99d.up.railway.app/health](https://apigateway-production-b99d.up.railway.app/health)

## 📄 License

This project is proprietary software developed for the Irchad platform.

---

*The API Gateway is fully operational on Railway with comprehensive authentication, intelligent routing, and advanced logging capabilities.*
